const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Transactions
  transactions: {
    getAll: (filters) => ipcRenderer.invoke('transactions:getAll', filters),
    add: (tx) => ipcRenderer.invoke('transactions:add', tx),
    update: (id, tx) => ipcRenderer.invoke('transactions:update', id, tx),
    delete: (id) => ipcRenderer.invoke('transactions:delete', id),
    bulkAdd: (txs) => ipcRenderer.invoke('transactions:bulkAdd', txs)
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

  // Balance
  balance: {
    get: () => ipcRenderer.invoke('balance:get'),
    setIfNewer: (amount, date, label) => ipcRenderer.invoke('balance:setIfNewer', amount, date, label)
  },

  // Ollama
  ollama: {
    listModels: () => ipcRenderer.invoke('ollama:listModels'),
    isRunning: () => ipcRenderer.invoke('ollama:isRunning'),
    generate: (opts) => ipcRenderer.invoke('ollama:generate', opts),
    chat: (opts) => ipcRenderer.invoke('ollama:chat', opts),
    onToken: (cb) => {
      ipcRenderer.on('ollama:token', (_, token) => cb(token))
      return () => ipcRenderer.removeAllListeners('ollama:token')
    }
  }
})
