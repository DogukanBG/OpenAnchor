const path = require('path')
const Database = require('better-sqlite3')

const DEFAULT_CATEGORIES = [
  { name: 'Housing & Rent', type: 'expense', color: '#6366f1', icon: '🏠' },
  { name: 'Groceries & Food', type: 'expense', color: '#f97316', icon: '🛒' },
  { name: 'Restaurants', type: 'expense', color: '#f59e0b', icon: '🍽️' },
  { name: 'Transport', type: 'expense', color: '#3b82f6', icon: '🚗' },
  { name: 'Healthcare', type: 'expense', color: '#ec4899', icon: '🏥' },
  { name: 'Entertainment', type: 'expense', color: '#8b5cf6', icon: '🎬' },
  { name: 'Leisure & Sports', type: 'expense', color: '#06b6d4', icon: '⚽' },
  { name: 'Shopping', type: 'expense', color: '#f43f5e', icon: '🛍️' },
  { name: 'Vacation & Travel', type: 'expense', color: '#14b8a6', icon: '✈️' },
  { name: 'Utilities', type: 'expense', color: '#64748b', icon: '💡' },
  { name: 'Insurance', type: 'expense', color: '#0ea5e9', icon: '🛡️' },
  { name: 'Education', type: 'expense', color: '#a855f7', icon: '📚' },
  { name: 'Subscriptions', type: 'expense', color: '#d946ef', icon: '📱' },
  { name: 'Salary', type: 'income', color: '#3dd68c', icon: '💼' },
  { name: 'Freelance', type: 'income', color: '#22d3ee', icon: '💻' },
  { name: 'Investments', type: 'income', color: '#84cc16', icon: '📈' },
  { name: 'Gifts Received', type: 'income', color: '#fbbf24', icon: '🎁' },
  { name: 'Other Income', type: 'income', color: '#a3e635', icon: '💰' },
  { name: 'Other Expense', type: 'expense', color: '#78716c', icon: '📋' },
  { name: 'Transfers', type: 'both', color: '#94a3b8', icon: '🔄' }
]

class FinanceDB {
  constructor(userDataPath) {
    this.dbPath = path.join(userDataPath, 'finance.db')
    this.db = null
  }

  init() {
    this.db = new Database(this.dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this._migrate()
  }

  _migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        date        TEXT    NOT NULL,
        description TEXT    NOT NULL,
        amount      REAL    NOT NULL,
        category    TEXT,
        type        TEXT    CHECK(type IN ('income','expense')) NOT NULL,
        source      TEXT    DEFAULT 'manual',
        notes       TEXT    DEFAULT '',
        created_at  TEXT    DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_tx_date     ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category);
      CREATE INDEX IF NOT EXISTS idx_tx_type     ON transactions(type);

      CREATE TABLE IF NOT EXISTS categories (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT UNIQUE NOT NULL,
        type       TEXT CHECK(type IN ('income','expense','both')) DEFAULT 'expense',
        color      TEXT DEFAULT '#64748b',
        icon       TEXT DEFAULT '📋',
        is_default INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS chats (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        title      TEXT NOT NULL DEFAULT 'New Chat',
        span_label TEXT NOT NULL DEFAULT '1 Month',
        span_days  INTEGER NOT NULL DEFAULT 30,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id    INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        role       TEXT NOT NULL CHECK(role IN ('user','assistant')),
        content    TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages(chat_id);
    `)

    // Seed default categories if empty
    const count = this.db.prepare('SELECT COUNT(*) as n FROM categories').get()
    if (count.n === 0) {
      const insert = this.db.prepare(
        'INSERT OR IGNORE INTO categories (name, type, color, icon, is_default) VALUES (?,?,?,?,1)'
      )
      const insertMany = this.db.transaction((cats) => {
        for (const c of cats) insert.run(c.name, c.type, c.color, c.icon)
      })
      insertMany(DEFAULT_CATEGORIES)
    }

    // Default settings
    const defaults = [
      ['extraction_model', ''],
      ['assistant_model', ''],
      ['currency', 'EUR'],
      ['date_format', 'DD.MM.YYYY'],
      ['ollama_url', 'http://127.0.0.1:11434'],
      ['theme', 'dark'],
      ['accent_color', 'green'],
      ['accent_custom', '#3dd68c'],
      ['account_balance', ''],
      ['account_balance_date', ''],
      ['account_balance_label', ''],
      ['user_name', ''],
      ['user_memory', '']
    ]
    const upsert = this.db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)')
    for (const [k, v] of defaults) upsert.run(k, v)
  }

  // ── Transactions ────────────────────────────────────────────────────────────
  getTransactions(filters = {}) {
    let sql = 'SELECT * FROM transactions WHERE 1=1'
    const params = []

    if (filters.dateFrom) { sql += ' AND date >= ?'; params.push(filters.dateFrom) }
    if (filters.dateTo) { sql += ' AND date <= ?'; params.push(filters.dateTo) }
    if (filters.category) { sql += ' AND category = ?'; params.push(filters.category) }
    if (filters.type) { sql += ' AND type = ?'; params.push(filters.type) }
    if (filters.search) {
      sql += ' AND (description LIKE ? OR notes LIKE ?)'
      params.push(`%${filters.search}%`, `%${filters.search}%`)
    }

    sql += ' ORDER BY date DESC, id DESC'
    if (filters.limit) { sql += ' LIMIT ?'; params.push(filters.limit) }

    return this.db.prepare(sql).all(...params)
  }

  addTransaction(tx) {
    const stmt = this.db.prepare(
      'INSERT INTO transactions (date, description, amount, category, type, source, notes) VALUES (?,?,?,?,?,?,?)'
    )
    const result = stmt.run(
      tx.date, tx.description, tx.amount, tx.category || null,
      tx.type, tx.source || 'manual', tx.notes || ''
    )
    return this.db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid)
  }

  updateTransaction(id, tx) {
    const stmt = this.db.prepare(
      'UPDATE transactions SET date=?, description=?, amount=?, category=?, type=?, notes=? WHERE id=?'
    )
    stmt.run(tx.date, tx.description, tx.amount, tx.category || null, tx.type, tx.notes || '', id)
    return this.db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)
  }

  deleteTransaction(id) {
    this.db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
    return { success: true }
  }

  bulkDeleteTransactions(ids) {
    const del = this.db.transaction((idList) => {
      const stmt = this.db.prepare('DELETE FROM transactions WHERE id = ?')
      for (const id of idList) stmt.run(id)
    })
    del(ids)
    return { deleted: ids.length }
  }

  bulkAddTransactions(txs) {
    const stmt = this.db.prepare(
      'INSERT INTO transactions (date, description, amount, category, type, source, notes) VALUES (?,?,?,?,?,?,?)'
    )
    const insertMany = this.db.transaction((items) => {
      const inserted = []
      for (const tx of items) {
        const r = stmt.run(
          tx.date, tx.description, tx.amount, tx.category || null,
          tx.type, tx.source || 'upload', tx.notes || ''
        )
        inserted.push(r.lastInsertRowid)
      }
      return inserted
    })
    const ids = insertMany(txs)
    return { inserted: ids.length }
  }

  // ── Categories ──────────────────────────────────────────────────────────────
  getCategories() {
    return this.db.prepare('SELECT * FROM categories ORDER BY is_default DESC, name ASC').all()
  }

  addCategory(cat) {
    const stmt = this.db.prepare(
      'INSERT INTO categories (name, type, color, icon, is_default) VALUES (?,?,?,?,0)'
    )
    const result = stmt.run(cat.name, cat.type || 'expense', cat.color || '#64748b', cat.icon || '📋')
    return this.db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid)
  }

  deleteCategory(id) {
    const cat = this.db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
    if (!cat) return { success: false, error: 'Category not found' }
    if (cat.is_default) return { success: false, error: 'Cannot delete default category' }
    this.db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    return { success: true }
  }

  // ── Settings ────────────────────────────────────────────────────────────────
  getSetting(key) {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
    return row ? row.value : null
  }

  setSetting(key, value) {
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)').run(key, value)
    return { success: true }
  }

  getAllSettings() {
    const rows = this.db.prepare('SELECT key, value FROM settings').all()
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  }

  // ── Stats ───────────────────────────────────────────────────────────────────
  getSummary(filters = {}) {
    let where = '1=1'
    const params = []
    if (filters.dateFrom) { where += ' AND date >= ?'; params.push(filters.dateFrom) }
    if (filters.dateTo) { where += ' AND date <= ?'; params.push(filters.dateTo) }
    if (filters.category) { where += ' AND category = ?'; params.push(filters.category) }

    const income = this.db.prepare(
      `SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE ${where} AND type='income'`
    ).get(...params).total

    const expenses = this.db.prepare(
      `SELECT COALESCE(SUM(ABS(amount)),0) as total FROM transactions WHERE ${where} AND type='expense'`
    ).get(...params).total

    const count = this.db.prepare(
      `SELECT COUNT(*) as n FROM transactions WHERE ${where}`
    ).get(...params).n

    return { income, expenses, net: income - expenses, count }
  }

  getTimeSeries(filters = {}) {
    const { groupBy = 'month', dateFrom, dateTo, category, type } = filters

    const formatMap = {
      day: '%Y-%m-%d',
      week: '%Y-W%W',
      month: '%Y-%m',
      year: '%Y'
    }
    const fmt = formatMap[groupBy] || '%Y-%m'

    let where = '1=1'
    const params = []
    if (dateFrom) { where += ' AND date >= ?'; params.push(dateFrom) }
    if (dateTo) { where += ' AND date <= ?'; params.push(dateTo) }
    if (category) { where += ' AND category = ?'; params.push(category) }

    const income = this.db.prepare(`
      SELECT strftime('${fmt}', date) as period,
             SUM(amount) as total
      FROM transactions
      WHERE ${where} AND type='income'
      GROUP BY period ORDER BY period ASC
    `).all(...params)

    const expenses = this.db.prepare(`
      SELECT strftime('${fmt}', date) as period,
             SUM(ABS(amount)) as total
      FROM transactions
      WHERE ${where} AND type='expense'
      GROUP BY period ORDER BY period ASC
    `).all(...params)

    return { income, expenses }
  }

  getCategoryBreakdown(filters = {}) {
    let where = '1=1'
    const params = []
    if (filters.dateFrom) { where += ' AND date >= ?'; params.push(filters.dateFrom) }
    if (filters.dateTo) { where += ' AND date <= ?'; params.push(filters.dateTo) }
    if (filters.type) { where += ' AND type = ?'; params.push(filters.type) }

    return this.db.prepare(`
      SELECT category,
             type,
             SUM(ABS(amount)) as total,
             COUNT(*) as count
      FROM transactions
      WHERE ${where}
      GROUP BY category, type
      ORDER BY total DESC
    `).all(...params)
  }

  // ── Chats ───────────────────────────────────────────────────────────────────
  getChats() {
    return this.db.prepare(
      'SELECT * FROM chats ORDER BY updated_at DESC'
    ).all()
  }

  createChat(title, spanLabel, spanDays) {
    const r = this.db.prepare(
      'INSERT INTO chats (title, span_label, span_days) VALUES (?,?,?)'
    ).run(title, spanLabel, spanDays)
    return this.db.prepare('SELECT * FROM chats WHERE id = ?').get(r.lastInsertRowid)
  }

  updateChatTitle(id, title) {
    this.db.prepare("UPDATE chats SET title=?, updated_at=datetime('now') WHERE id=?").run(title, id)
    return { success: true }
  }

  deleteChat(id) {
    this.db.prepare('DELETE FROM chats WHERE id = ?').run(id)
    return { success: true }
  }

  getChatMessages(chatId) {
    return this.db.prepare(
      'SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY id ASC'
    ).all(chatId)
  }

  addChatMessage(chatId, role, content) {
    const r = this.db.prepare(
      'INSERT INTO chat_messages (chat_id, role, content) VALUES (?,?,?)'
    ).run(chatId, role, content)
    // Bump chat updated_at
    this.db.prepare("UPDATE chats SET updated_at=datetime('now') WHERE id=?").run(chatId)
    return r.lastInsertRowid
  }

  // ── Merchants ───────────────────────────────────────────────────────────────
  getMerchants(filters = {}) {
    let where = '1=1'
    const params = []
    if (filters.dateFrom) { where += ' AND date >= ?'; params.push(filters.dateFrom) }
    if (filters.dateTo)   { where += ' AND date <= ?'; params.push(filters.dateTo) }
    if (filters.type)     { where += ' AND type = ?'; params.push(filters.type) }

    // Group by normalized description (trim, lowercase for grouping but show original)
    return this.db.prepare(`
      SELECT
        description,
        type,
        category,
        COUNT(*) as count,
        SUM(ABS(amount)) as total,
        AVG(ABS(amount)) as avg,
        MIN(ABS(amount)) as min_amount,
        MAX(ABS(amount)) as max_amount,
        MIN(date) as first_date,
        MAX(date) as last_date
      FROM transactions
      WHERE ${where}
      GROUP BY LOWER(TRIM(description)), type
      ORDER BY total DESC
    `).all(...params)
  }

  getMerchantHistory(description, filters = {}) {
    let where = 'LOWER(TRIM(description)) = LOWER(TRIM(?))'
    const params = [description]
    if (filters.dateFrom) { where += ' AND date >= ?'; params.push(filters.dateFrom) }
    if (filters.dateTo)   { where += ' AND date <= ?'; params.push(filters.dateTo) }

    return this.db.prepare(`
      SELECT * FROM transactions
      WHERE ${where}
      ORDER BY date DESC
    `).all(...params)
  }

  // ── Balance ─────────────────────────────────────────────────────────────────
  getBalance() {
    return {
      amount:  this.getSetting('account_balance'),
      date:    this.getSetting('account_balance_date'),
      label:   this.getSetting('account_balance_label')
    }
  }

  // Only overwrite stored balance if the incoming date is newer
  setBalanceIfNewer(amount, date, label = '') {
    const stored = this.getSetting('account_balance_date')
    if (!stored || date > stored) {
      this.setSetting('account_balance', String(amount))
      this.setSetting('account_balance_date', date)
      this.setSetting('account_balance_label', label)
      return { updated: true, amount, date }
    }
    return { updated: false, stored_date: stored }
  }
}

module.exports = FinanceDB
