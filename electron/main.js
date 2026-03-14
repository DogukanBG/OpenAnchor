const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const https = require('https')

const isDev = process.env.NODE_ENV === 'development'

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
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  // Init database
  const userDataPath = app.getPath('userData')
  db = new Database(userDataPath)
  db.init()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC: Transactions ───────────────────────────────────────────────────────
ipcMain.handle('transactions:getAll', (_, filters) => db.getTransactions(filters))
ipcMain.handle('transactions:add', (_, tx) => db.addTransaction(tx))
ipcMain.handle('transactions:update', (_, id, tx) => db.updateTransaction(id, tx))
ipcMain.handle('transactions:delete', (_, id) => db.deleteTransaction(id))
ipcMain.handle('transactions:bulkAdd',    (_, txs) => db.bulkAddTransactions(txs))
ipcMain.handle('transactions:bulkDelete', (_, ids) => db.bulkDeleteTransactions(ids))

// ─── IPC: Categories ─────────────────────────────────────────────────────────
ipcMain.handle('categories:getAll', () => db.getCategories())
ipcMain.handle('categories:add', (_, cat) => db.addCategory(cat))
ipcMain.handle('categories:delete', (_, id) => db.deleteCategory(id))

// ─── IPC: Settings ───────────────────────────────────────────────────────────
ipcMain.handle('settings:get', (_, key) => db.getSetting(key))
ipcMain.handle('settings:set', (_, key, value) => db.setSetting(key, value))
ipcMain.handle('settings:getAll', () => db.getAllSettings())

// ─── IPC: Stats ──────────────────────────────────────────────────────────────
ipcMain.handle('stats:getSummary', (_, filters) => db.getSummary(filters))
ipcMain.handle('stats:getTimeSeries', (_, filters) => db.getTimeSeries(filters))
ipcMain.handle('stats:getCategoryBreakdown', (_, filters) => db.getCategoryBreakdown(filters))

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
  return result.filePaths[0]
})

ipcMain.handle('file:extractText', async (_, filePath) => {
  const ext = path.extname(filePath).toLowerCase()

  if (ext === '.csv' || ext === '.txt') {
    // Return as single-page array for uniform handling
    return { pages: [fs.readFileSync(filePath, 'utf-8')], pageCount: 1 }
  }

  if (ext === '.pdf') {
    try {
      const pdfParse = require('pdf-parse')
      const buffer = fs.readFileSync(filePath)
      const pages = []

      // Use render_page callback to capture text per page
      const options = {
        pagerender: function(pageData) {
          return pageData.getTextContent().then(function(textContent) {
            let text = ''
            let lastY = null
            for (const item of textContent.items) {
              // Add newline when Y position changes significantly (new line)
              if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) {
                text += '\n'
              }
              text += item.str
              lastY = item.transform[5]
            }
            pages.push(text)
            return text
          })
        }
      }

      const data = await pdfParse(buffer, options)
      // Fallback: if pagerender didn't fire (some PDFs), split full text by form feed
      if (pages.length === 0) {
        const byFormFeed = data.text.split('\f').filter(p => p.trim().length > 0)
        return { pages: byFormFeed.length > 1 ? byFormFeed : [data.text], pageCount: data.numpages }
      }

      return { pages, pageCount: data.numpages }
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

// ─── IPC: Balance ────────────────────────────────────────────────────────────
ipcMain.handle('balance:get', () => db.getBalance())
ipcMain.handle('balance:setIfNewer', (_, balance, date) => db.setBalanceIfNewer(balance, date))

// ─── IPC: Ollama ─────────────────────────────────────────────────────────────
ipcMain.handle('ollama:listModels', async () => {
  try {
    const data = await ollamaRequest('GET', '/api/tags')
    return data.models || []
  } catch (err) {
    return []
  }
})

ipcMain.handle('ollama:isRunning', async () => {
  try {
    await ollamaRequest('GET', '/api/tags')
    return true
  } catch {
    return false
  }
})

ipcMain.handle('ollama:generate', async (event, { model, prompt, system }) => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      prompt,
      system: system || '',
      stream: false,
      options: { temperature: 0.1, num_predict: 4096 }
    })

    const options = {
      hostname: '127.0.0.1',
      port: 11434,
      path: '/api/generate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          resolve(parsed.response || '')
        } catch {
          resolve(data)
        }
      })
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
})

// Streaming chat for AI assistant
ipcMain.handle('ollama:chat', async (event, { model, messages, system }) => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages
      ],
      stream: true,
      options: { temperature: 0.7, num_predict: 2048 }
    })

    const options = {
      hostname: '127.0.0.1',
      port: 11434,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }

    let fullResponse = ''
    const req = http.request(options, (res) => {
      res.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line)
            if (parsed.message?.content) {
              fullResponse += parsed.message.content
              // Stream token to renderer
              event.sender.send('ollama:token', parsed.message.content)
            }
          } catch {}
        }
      })
      res.on('end', () => resolve(fullResponse))
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
})

// ─── Helper ──────────────────────────────────────────────────────────────────
function ollamaRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 11434,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(data) }
      })
    })

    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}
