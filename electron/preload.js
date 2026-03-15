const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Transactions
  transactions: {
    getAll: (filters) => ipcRenderer.invoke('transactions:getAll', filters),
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
    delete: (id) => ipcRenderer.invoke('categories:delete', id)
  },

  // Settings
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll')
  },

  // Stats
  stats: {
    getSummary: (filters) => ipcRenderer.invoke('stats:getSummary', filters),
    getTimeSeries: (filters) => ipcRenderer.invoke('stats:getTimeSeries', filters),
    getCategoryBreakdown: (filters) => ipcRenderer.invoke('stats:getCategoryBreakdown', filters)
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
    create:        (title, spanLabel, spanDays) => ipcRenderer.invoke('chats:create', title, spanLabel, spanDays),
    updateTitle:   (id, title)     => ipcRenderer.invoke('chats:updateTitle', id, title),
    delete:        (id)            => ipcRenderer.invoke('chats:delete', id),
    getMessages:   (chatId)        => ipcRenderer.invoke('chats:getMessages', chatId),
    addMessage:    (chatId, role, content) => ipcRenderer.invoke('chats:addMessage', chatId, role, content)
  },

  // Balance
  balance: {
    get: () => ipcRenderer.invoke('balance:get'),
    set: (amount, date, label) => ipcRenderer.invoke('balance:set', amount, date, label),
    setIfNewer: (amount, date, label) => ipcRenderer.invoke('balance:setIfNewer', amount, date, label)
  },

  // Ollama
  ollama: {
    listModels: () => ipcRenderer.invoke('ollama:listModels'),
    isRunning: () => ipcRenderer.invoke('ollama:isRunning'),
    generate: (opts) => ipcRenderer.invoke('ollama:generate', opts),
    chat: (opts) => ipcRenderer.invoke('ollama:chat', opts),
    stop: () => ipcRenderer.send('ollama:stop'),
    onToken: (cb) => {
      ipcRenderer.on('ollama:token', (_, token) => cb(token))
      return () => ipcRenderer.removeAllListeners('ollama:token')
    }
  }
})
