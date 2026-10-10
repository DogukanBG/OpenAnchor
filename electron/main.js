const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const https = require('https')

const isDev = process.env.NODE_ENV === 'development'
// Synthetic runs isolate Chromium storage as well as the financial database.
if(process.env.OPENANCHOR_TEST_DATA){
  if(!path.isAbsolute(process.env.OPENANCHOR_TEST_DATA))throw new Error('Test profile must be an absolute path')
  app.setPath('userData',process.env.OPENANCHOR_TEST_DATA)
}

// Track active streaming request so we can abort it
let activeStreamReq = null

// ─── Database ────────────────────────────────────────────────────────────────
const Database = require('./database')
let db

// ─── Window ──────────────────────────────────────────────────────────────────
let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#f5f7fb',
    icon:path.join(__dirname,'../assets/icons/openanchor-blue.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({action:'deny'}))
  mainWindow.webContents.on('will-navigate', (event,url) => { const allowed=isDev?new URL(url).origin==='http://localhost:5173':url===require('url').pathToFileURL(path.join(__dirname,'../dist/index.html')).href;if(!allowed)event.preventDefault() })
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details,callback)=>{
    if(isDev&&details.url.startsWith('http://localhost:5173'))callback({responseHeaders:{...details.responseHeaders,'Content-Security-Policy':["default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws://localhost:5173; object-src 'none'; base-uri 'none';"]}})
    else callback({responseHeaders:details.responseHeaders})
  })
  session.defaultSession.setPermissionRequestHandler((_,__,callback)=>callback(false))
  // Init database
  const userDataPath = process.env.OPENANCHOR_TEST_DATA || app.getPath('userData')
  db = new Database(userDataPath)
  db.init()

  if(process.platform==='darwin')app.dock.setIcon(path.join(__dirname,'../assets/icons/openanchor-blue.png'))
  createWindow()
  // A host-provided smoke harness runs only with an explicitly isolated test profile.
  if(process.env.OPENANCHOR_TEST_DATA && process.env.OPENANCHOR_SMOKE_SCRIPT)require(path.resolve(process.env.OPENANCHOR_SMOKE_SCRIPT))({app,window:mainWindow,root:path.resolve(__dirname,'..')})

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Every privileged request must originate from this app's main frame.
const register = ipcMain.handle.bind(ipcMain)
ipcMain.handle = (channel,handler) => register(channel,async (event,...args) => {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== event.sender.mainFrame) throw new Error('Untrusted request')
  const url=event.senderFrame.url
  if (isDev ? new URL(url).origin !== 'http://localhost:5173' : url !== require('url').pathToFileURL(path.join(__dirname,'../dist/index.html')).href) throw new Error('Untrusted origin')
  const result=await handler(event,...args)
  const mutations=['transactions:add','transactions:update','transactions:delete','transactions:bulkAdd','transactions:bulkDelete','transactions:bulkCategorize','transactions:bulkUpdateCategory','transactions:transfer','categories:add','categories:delete','accounts:add','accounts:update','accounts:delete','accounts:setBalance','accounts:setBalanceIfNewer','settings:set','imports:commit','imports:undo','imports:confirmCoverage','categorization:correct','categorization:saveKeywords','categorization:alias','recurring:save','planning:save','planning:copy','planning:saveEvent','planning:deleteEvent','data:restore','data:wipe']
  if(mutations.includes(channel)){if(forecastService?.active)forecastRuntime?.stop(Error('Data changed; forecast cancelled'));if(!event.sender.isDestroyed())event.sender.send('data:changed',{ledger:db.getSetting('ledger_revision'),schedule:db.getSetting('schedule_revision')})}
  return result
})
const authorizedFiles=new Set()
// ─── IPC: Transactions ───────────────────────────────────────────────────────
ipcMain.handle('transactions:getAll', (_, filters) => db.getTransactions(filters))
ipcMain.handle('transactions:add', (_, tx) => db.addTransaction(tx))
ipcMain.handle('transactions:update', (_, id, tx) => db.updateTransaction(id, tx))
ipcMain.handle('transactions:delete', (_, id) => db.deleteTransaction(id))
ipcMain.handle('transactions:bulkAdd',    (_, txs) => db.bulkAddTransactions(txs))
ipcMain.handle('transactions:bulkDelete',     (_, ids)           => db.bulkDeleteTransactions(ids))
ipcMain.handle('transactions:bulkCategorize', (_, ids, category) => db.bulkCategorizeTransactions(ids, category))
ipcMain.handle('transactions:bulkUpdateCategory', (_, ids, category) => db.bulkUpdateCategory(ids, category))

// ─── IPC: Categories ─────────────────────────────────────────────────────────
ipcMain.handle('categories:getAll', () => db.getCategories())
ipcMain.handle('categories:add', (_, cat) => db.addCategory(cat))
ipcMain.handle('categories:delete', (_, id, replacement) => db.deleteCategory(id,replacement))

// ─── IPC: Accounts ───────────────────────────────────────────────────────────
ipcMain.handle('accounts:getAll', () => db.getAccounts())
ipcMain.handle('accounts:add', (_, account) => db.addAccount(account))
ipcMain.handle('accounts:update', (_, id, patch) => db.updateAccount(id, patch))
ipcMain.handle('accounts:delete', (_, id) => db.deleteAccount(id))
ipcMain.handle('accounts:setBalance', (_, id, amount, date, label) => db.setAccountBalance(id, amount, date, label))
ipcMain.handle('accounts:setBalanceIfNewer', (_, id, amount, date, label) => db.setAccountBalanceIfNewer(id, amount, date, label))

// ─── IPC: Settings ───────────────────────────────────────────────────────────
ipcMain.handle('settings:get', (_, key) => db.getSetting(key))
ipcMain.handle('settings:set', (_, key, value) => db.setSetting(key, value))
ipcMain.handle('settings:getAll', () => db.getAllSettings())

// ─── IPC: Stats ──────────────────────────────────────────────────────────────
ipcMain.handle('stats:dateBounds',(_,id)=>db.dateBounds(id))
ipcMain.handle('stats:getCashFlow',(_,scope)=>db.getCashFlow(scope))
ipcMain.handle('stats:getSummary', (_, filters) => db.getSummary(filters))
ipcMain.handle('stats:getTimeSeries', (_, filters) => db.getTimeSeries(filters))
ipcMain.handle('stats:getCategoryBreakdown', (_, filters) => db.getCategoryBreakdown(filters))
ipcMain.handle('stats:getDayOfWeekBreakdown', (_, filters) => db.getDayOfWeekBreakdown(filters))

// ─── IPC: Budgets ────────────────────────────────────────────────────────────
ipcMain.handle('budgets:getAll', (_, accountId) => db.getBudgets(accountId))
ipcMain.handle('budgets:save', (_, budget) => db.saveBudget(budget))
ipcMain.handle('budgets:delete', (_, id) => db.deleteBudget(id))
ipcMain.handle('budgets:setCap', (_, accountId, cap) => db.setBudgetCap(accountId, cap))

// ─── IPC: File Parsing ───────────────────────────────────────────────────────
ipcMain.handle('file:openDialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Bank Statement',
    filters: [
      { name: 'Supported Files', extensions: ['pdf', 'csv', 'txt'] },
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'CSV', extensions: ['csv'] },
      { name: 'Text', extensions: ['txt'] }
    ],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  authorizedFiles.add(result.filePaths[0]);return result.filePaths[0]
})

ipcMain.handle('file:extractText', async (_, filePath) => {
  if(!authorizedFiles.has(filePath))throw new Error('Choose the source through the file picker')
  if(fs.statSync(filePath).size>50*1024*1024)throw new Error('File exceeds 50 MB limit')
  const ext = path.extname(filePath).toLowerCase()

  if (ext === '.txt') {
    return { pages: [fs.readFileSync(filePath, 'utf-8')], pageCount: 1, type: 'text' }
  }

  if (ext === '.csv') {
    // Return raw text — parsing is done in the frontend
    return { pages: [fs.readFileSync(filePath, 'utf-8')], pageCount: 1 }
  }

  if (ext === '.pdf') {
    try {
      const pdfParse = require('pdf-parse')
      const buffer = fs.readFileSync(filePath)
      return await require('./pdf-extraction')(buffer,pdfParse)
    } catch (err) {
      throw new Error(`PDF parse error: ${err.message}`)
    }
  }

  throw new Error(`Unsupported file type: ${ext}`)
})

// ─── IPC: Merchants ──────────────────────────────────────────────────────────
ipcMain.handle('merchants:getAll',    (_, filters)             => db.getMerchants(filters))
ipcMain.handle('merchants:getHistory',(_, description, filters)=> db.getMerchantHistory(description, filters))

// ─── IPC: Chats ──────────────────────────────────────────────────────────────
ipcMain.handle('chats:getAll',      ()                     => db.getChats())
ipcMain.handle('chats:create',      (_, title, sl, sd)     => db.createChat(title, sl, sd))
ipcMain.handle('chats:updateTitle', (_, id, title)         => db.updateChatTitle(id, title))
ipcMain.handle('chats:delete',      (_, id)                => db.deleteChat(id))
ipcMain.handle('chats:getMessages', (_, chatId)            => db.getChatMessages(chatId))
ipcMain.handle('chats:addMessage',  (_, chatId, role, msg) => db.addChatMessage(chatId, role, msg))

// Provider requests retain their originating request IDs and URL prefixes.
const Providers=require('./providers')
let localLlama
function llama(){return localLlama||(localLlama=new (require('./llama-local'))(db))}
ipcMain.handle('llama:status',()=>llama().status())
ipcMain.handle('llama:chooseModel',async()=>{const result=await dialog.showOpenDialog(mainWindow,{properties:['openFile'],filters:[{name:'GGUF checkpoint',extensions:['gguf']}]});return result.canceled?null:llama().selectModel(result.filePaths[0])})
ipcMain.handle('llama:chooseBinary',async()=>{const result=await dialog.showOpenDialog(mainWindow,{properties:['openFile'],title:'Choose llama-server executable'});if(result.canceled)return null;const file=result.filePaths[0];fs.accessSync(file,fs.constants.X_OK);db.setSetting('llama_binary',file);return llama().status()})
ipcMain.handle('llama:start',async()=>{const result=await llama().start();mainWindow?.webContents.send('data:changed',{});return result})
ipcMain.handle('llama:stop',()=>llama().stop())
const provider=()=>new Providers(db)
let providers
function ai(){return providers||(providers=provider())}
ipcMain.handle('ollama:listModels',(_,config)=>config?new Providers(db,config).models():ai().models())
ipcMain.handle('ollama:isRunning',()=>ai().running())
ipcMain.handle('ollama:generate',(_,opts)=>ai().generate(opts))
ipcMain.handle('ollama:chat',(event,opts)=>ai().chat(opts,(token,requestId)=>{if(!event.sender.isDestroyed())event.sender.send('ollama:token',token,requestId)}))
ipcMain.on('ollama:stop',(event,id)=>{if(mainWindow&&event.sender===mainWindow.webContents)ai().cancel(id)})

const Imports=require('./imports'),DataManagement=require('./data-management')
ipcMain.handle('imports:identity',(_,file)=>{if(!authorizedFiles.has(file))throw new Error('Choose a file first');return {filename:path.basename(file),fileHash:require('./domain').hash(fs.readFileSync(file))}})
ipcMain.handle('imports:parseCSV',(_,text,options)=>Imports.csv(text,options))
ipcMain.handle('imports:reconciliation',(_,input)=>Imports.reconciliation(input,db.account(input.accountId).currency))
for(const [channel,method] of Object.entries({
 'imports:checks':'importChecks','imports:review':'importReview','imports:commit':'importCommit','imports:history':'importHistory','imports:undo':'importUndo','imports:confirmCoverage':'confirmCoverage','imports:coverage':'coverage',
 'categorization:keywords':'categoryKeywords','categorization:saveKeywords':'saveCategoryKeywords','categorization:suggest':'suggestCategory','categorization:preview':'correctionPreview','categorization:correct':'correctCategory','categorization:rules':'categoryRules','categorization:deleteRule':'deleteRule','categorization:merchants':'getMerchantList','categorization:alias':'setMerchantAlias',
 'spending:aggregate':'spending','recurring:candidates':'recurringCandidates','recurring:list':'recurringList','recurring:preview':'recurringPreview','recurring:save':'recurringSave','recurring:dismiss':'recurringDismiss',
 'planning:calendar':'planCalendar','planning:alerts':'planAlerts','planning:expected':'planExpectedSpending','planning:save':'planSave','planning:copy':'planCopy','planning:events':'plannedEvents','planning:saveEvent':'saveEvent','planning:deleteEvent':'deleteEvent','chats:createScoped':'createScopedChat','chats:truncate':'truncateChat','chats:addEvidence':'addMessageWithEvidence','transactions:transfer':'addTransfer'
}))ipcMain.handle(channel,(_, ...args)=>db[method](...args))
ipcMain.handle('data:wipe',(_,input)=>{if(input?.confirmation!=='WIPE')throw Error('Type WIPE to confirm resetting financial data');forecastRuntime?.stop();providers?.cancel();const result=DataManagement.wipe(db,input);forecastService=null;return result})
for(const action of ['backup','restore','export'])ipcMain.handle('data:'+action,async (_,scope)=>{
 const choice=action==='restore'?await dialog.showOpenDialog(mainWindow,{title:'Restore OpenAnchor backup',filters:[{name:'Database backup',extensions:['db']}],properties:['openFile']}):await dialog.showSaveDialog(mainWindow,{title:action==='backup'?'Save backup':'Export transactions',defaultPath:action==='backup'?`OpenAnchor-${Date.now()}.db`:'OpenAnchor-transactions.csv'})
 if(choice.canceled)return {cancelled:true}
 return DataManagement[action](db,action==='restore'?choice.filePaths[0]:choice.filePath,scope)
})

const {Runtime}=require('./forecast/runtime'),ForecastService=require('./forecast/service')
let forecastRuntime,forecastService
function forecasting(){if(!forecastService){forecastRuntime=new Runtime(path.join(path.dirname(db.dbPath),'chronos-2'));forecastRuntime.on('progress',value=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('forecasting:progress',value)});forecastService=new ForecastService(db,forecastRuntime)}return forecastService}
ipcMain.handle('planning:get',(_,accountId,month)=>{
 const plan=db.planGet(accountId,month),cached=forecasting().cached({accountId,horizon:Number(db.getSetting('forecast_horizon')||90)})
 if(cached){const days=cached.days.filter(d=>d.date.startsWith(month));if(days.length)plan.forecast_context={origin:cached.origin,modelRevision:cached.modelRevision,dateFrom:days[0].date,dateTo:days[days.length-1].date,days:days.length,inflow_minor:days.reduce((sum,d)=>sum+d.inflow_minor,0),outflow_minor:days.reduce((sum,d)=>sum+d.outflow_minor,0),net_minor:days.reduce((sum,d)=>sum+d.net_minor,0)}}
 return plan
})
ipcMain.handle('forecasting:status',()=>{forecasting();return forecastRuntime.status()})
ipcMain.handle('forecasting:setup',async(_,options={})=>{forecasting();if(options.useExistingPython){const choice=await dialog.showOpenDialog(mainWindow,{title:'Choose an existing Apple Silicon Python 3.12 executable',properties:['openFile']});if(choice.canceled)return forecastRuntime.status();return forecastRuntime.setup({existingPython:choice.filePaths[0]})}return forecastRuntime.setup()})
ipcMain.handle('forecasting:eligibility',(_,scope)=>forecasting().eligibility(scope))
ipcMain.handle('forecasting:start',(_,input)=>forecasting().start(input))
ipcMain.handle('forecasting:cached',(_,input)=>forecasting().cached(input))
ipcMain.handle('forecasting:cancel',(_,id)=>{forecasting().cancel(id);return {cancelled:true}})
app.on('before-quit',()=>{forecastRuntime?.stop();providers?.cancel();localLlama?.stop();db?.close()})

ipcMain.handle('evidence:query',(_,query)=>{const evidence=db.evidence(query);if(query.analysis==='forecast'){const result=forecasting().cached({accountId:query.scope.accountId,horizon:Number(db.getSetting('forecast_horizon')||90)});return require('./forecast/evidence')(evidence,result,query.scope)}return evidence})

ipcMain.handle('evidence:health',(_,scope)=>require('./health')(db,scope))
