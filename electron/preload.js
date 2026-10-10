const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  onDataChanged:cb=>{const handler=(_,value)=>cb(value);ipcRenderer.on('data:changed',handler);return()=>ipcRenderer.removeListener('data:changed',handler)},
  forecasting:{status:()=>ipcRenderer.invoke('forecasting:status'),setup:options=>ipcRenderer.invoke('forecasting:setup',options),eligibility:scope=>ipcRenderer.invoke('forecasting:eligibility',scope),start:input=>ipcRenderer.invoke('forecasting:start',input),cached:input=>ipcRenderer.invoke('forecasting:cached',input),cancel:id=>ipcRenderer.invoke('forecasting:cancel',id),onProgress:cb=>{const handler=(_,value)=>cb(value);ipcRenderer.on('forecasting:progress',handler);return()=>ipcRenderer.removeListener('forecasting:progress',handler)}},
  imports: {
    identity:file=>ipcRenderer.invoke('imports:identity',file),parseCSV:(text,options)=>ipcRenderer.invoke('imports:parseCSV',text,options),reconciliation:input=>ipcRenderer.invoke('imports:reconciliation',input),
    checks:input=>ipcRenderer.invoke('imports:checks',input),review:input=>ipcRenderer.invoke('imports:review',input),commit:input=>ipcRenderer.invoke('imports:commit',input),history:()=>ipcRenderer.invoke('imports:history'),undo:id=>ipcRenderer.invoke('imports:undo',id),confirmCoverage:input=>ipcRenderer.invoke('imports:confirmCoverage',input),coverage:id=>ipcRenderer.invoke('imports:coverage',id)
  },
  categorization: {keywords:()=>ipcRenderer.invoke('categorization:keywords'),saveKeywords:input=>ipcRenderer.invoke('categorization:saveKeywords',input),suggest:tx=>ipcRenderer.invoke('categorization:suggest',tx),preview:id=>ipcRenderer.invoke('categorization:preview',{id}),correct:input=>ipcRenderer.invoke('categorization:correct',input),rules:()=>ipcRenderer.invoke('categorization:rules'),deleteRule:id=>ipcRenderer.invoke('categorization:deleteRule',id),merchants:()=>ipcRenderer.invoke('categorization:merchants'),alias:input=>ipcRenderer.invoke('categorization:alias',input)},
  spending:{aggregate:scope=>ipcRenderer.invoke('spending:aggregate',scope),transactions:scope=>ipcRenderer.invoke('transactions:getAll',scope)},
  recurring:{preview:input=>ipcRenderer.invoke('recurring:preview',input),candidates:id=>ipcRenderer.invoke('recurring:candidates',id),list:id=>ipcRenderer.invoke('recurring:list',id),save:input=>ipcRenderer.invoke('recurring:save',input),dismiss:key=>ipcRenderer.invoke('recurring:dismiss',key)},
  planning:{calendar:input=>ipcRenderer.invoke('planning:calendar',input),alerts:input=>ipcRenderer.invoke('planning:alerts',input),expected:input=>ipcRenderer.invoke('planning:expected',input),get:(id,month)=>ipcRenderer.invoke('planning:get',id,month),save:input=>ipcRenderer.invoke('planning:save',input),copy:input=>ipcRenderer.invoke('planning:copy',input),events:id=>ipcRenderer.invoke('planning:events',id),saveEvent:input=>ipcRenderer.invoke('planning:saveEvent',input),deleteEvent:id=>ipcRenderer.invoke('planning:deleteEvent',id)},
  evidence:{health:scope=>ipcRenderer.invoke('evidence:health',scope),query:input=>ipcRenderer.invoke('evidence:query',input)},
  data:{wipe:input=>ipcRenderer.invoke('data:wipe',input),backup:()=>ipcRenderer.invoke('data:backup'),restore:()=>ipcRenderer.invoke('data:restore'),export:scope=>ipcRenderer.invoke('data:export',scope)},
  // Transactions
  transactions: {
    getAll: (filters) => ipcRenderer.invoke('transactions:getAll', filters),
    transfer:input=>ipcRenderer.invoke('transactions:transfer',input),
    add: (tx) => ipcRenderer.invoke('transactions:add', tx),
    update: (id, tx) => ipcRenderer.invoke('transactions:update', id, tx),
    delete: (id) => ipcRenderer.invoke('transactions:delete', id),
    bulkAdd:    (txs) => ipcRenderer.invoke('transactions:bulkAdd', txs),
    bulkDelete:         (ids)              => ipcRenderer.invoke('transactions:bulkDelete', ids),
    bulkCategorize:     (ids, category)    => ipcRenderer.invoke('transactions:bulkCategorize', ids, category),
    bulkUpdateCategory: (ids, category) => ipcRenderer.invoke('transactions:bulkUpdateCategory', ids, category)
  },

  // Categories
  categories: {
    getAll: () => ipcRenderer.invoke('categories:getAll'),
    add: (cat) => ipcRenderer.invoke('categories:add', cat),
    delete: (id,replacement) => ipcRenderer.invoke('categories:delete', id,replacement)
  },

  // Accounts
  accounts: {
    getAll: () => ipcRenderer.invoke('accounts:getAll'),
    add: (account) => ipcRenderer.invoke('accounts:add', account),
    update: (id, patch) => ipcRenderer.invoke('accounts:update', id, patch),
    delete: (id) => ipcRenderer.invoke('accounts:delete', id),
    setBalance: (id, amount, date, label) => ipcRenderer.invoke('accounts:setBalance', id, amount, date, label),
    setBalanceIfNewer: (id, amount, date, label) => ipcRenderer.invoke('accounts:setBalanceIfNewer', id, amount, date, label)
  },

  // Settings
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll')
  },

  // Stats
  stats: {
    dateBounds:id=>ipcRenderer.invoke('stats:dateBounds',id),
    getCashFlow: scope=>ipcRenderer.invoke('stats:getCashFlow',scope),
    getSummary: (filters) => ipcRenderer.invoke('stats:getSummary', filters),
    getTimeSeries: (filters) => ipcRenderer.invoke('stats:getTimeSeries', filters),
    getCategoryBreakdown: (filters) => ipcRenderer.invoke('stats:getCategoryBreakdown', filters),
    getDayOfWeekBreakdown: (filters) => ipcRenderer.invoke('stats:getDayOfWeekBreakdown', filters)
  },

  // Budgets
  budgets: {
    getAll: (accountId) => ipcRenderer.invoke('budgets:getAll', accountId),
    save: (budget) => ipcRenderer.invoke('budgets:save', budget),
    delete: (id) => ipcRenderer.invoke('budgets:delete', id),
    setCap: (accountId, cap) => ipcRenderer.invoke('budgets:setCap', accountId, cap)
  },

  // Files
  file: {
    openDialog: () => ipcRenderer.invoke('file:openDialog'),
    extractText: (path) => ipcRenderer.invoke('file:extractText', path)
  },

  // Merchants
  merchants: {
    getAll:      (filters) => ipcRenderer.invoke('merchants:getAll', filters),
    getHistory:  (description, filters) => ipcRenderer.invoke('merchants:getHistory', description, filters)
  },

  // Chats
  chats: {
    getAll:        ()              => ipcRenderer.invoke('chats:getAll'),
    createScoped:input=>ipcRenderer.invoke('chats:createScoped',input),truncate:input=>ipcRenderer.invoke('chats:truncate',input),addEvidence:input=>ipcRenderer.invoke('chats:addEvidence',input),
    create:        (title, spanLabel, spanDays) => ipcRenderer.invoke('chats:create', title, spanLabel, spanDays),
    updateTitle:   (id, title)     => ipcRenderer.invoke('chats:updateTitle', id, title),
    delete:        (id)            => ipcRenderer.invoke('chats:delete', id),
    getMessages:   (chatId)        => ipcRenderer.invoke('chats:getMessages', chatId),
    addMessage:    (chatId, role, content) => ipcRenderer.invoke('chats:addMessage', chatId, role, content)
  },

  llama: {status:()=>ipcRenderer.invoke('llama:status'),chooseModel:()=>ipcRenderer.invoke('llama:chooseModel'),chooseBinary:()=>ipcRenderer.invoke('llama:chooseBinary'),start:()=>ipcRenderer.invoke('llama:start'),stop:()=>ipcRenderer.invoke('llama:stop')},
  // Ollama
  ollama: {
    listModels: (config) => ipcRenderer.invoke('ollama:listModels',config),
    isRunning: () => ipcRenderer.invoke('ollama:isRunning'),
    generate: (opts) => ipcRenderer.invoke('ollama:generate', opts),
    chat: (opts) => ipcRenderer.invoke('ollama:chat', opts),
    stop: (id) => ipcRenderer.send('ollama:stop',id),
    onToken: (cb) => {
      const handler=(_,token,requestId)=>cb(token,requestId)
      ipcRenderer.on('ollama:token',handler)
      return () => ipcRenderer.removeListener('ollama:token',handler)
    }
  }
})
