const path = require('path')
const Database = require('better-sqlite3')

const DEFAULT_CATEGORIES = [
  { name: 'Housing & Rent', type: 'expense', color: '#8c6239', icon: '🏠' },
  { name: 'Groceries & Food', type: 'expense', color: '#7d9455', icon: '🛒' },
  { name: 'Restaurants', type: 'expense', color: '#b8503a', icon: '🍽️' },
  { name: 'Transport', type: 'expense', color: '#5b7fa6', icon: '🚗' },
  { name: 'Healthcare', type: 'expense', color: '#b5647f', icon: '🏥' },
  { name: 'Entertainment', type: 'expense', color: '#8a6ba3', icon: '🎬' },
  { name: 'Leisure & Sports', type: 'expense', color: '#6b8f3f', icon: '⚽' },
  { name: 'Shopping', type: 'expense', color: '#a3563f', icon: '🛍️' },
  { name: 'Vacation & Travel', type: 'expense', color: '#4f8a7b', icon: '✈️' },
  { name: 'Utilities', type: 'expense', color: '#7a7263', icon: '💡' },
  { name: 'Insurance', type: 'expense', color: '#5f7d6e', icon: '🛡️' },
  { name: 'Education', type: 'expense', color: '#c9a227', icon: '📚' },
  { name: 'Subscriptions', type: 'expense', color: '#d18f5c', icon: '📱' },
  { name: 'Scholarships', type: 'income', color: '#2875e8', icon: '🎓' },
  { name: 'Salary', type: 'income', color: '#c17f4a', icon: '💼' },
  { name: 'Freelance', type: 'income', color: '#4f8a7b', icon: '💻' },
  { name: 'Investments', type: 'both', color: '#6b8f3f', icon: '📈' },
  { name: 'Gifts Received', type: 'income', color: '#b5647f', icon: '🎁' },
  { name: 'Other Income', type: 'income', color: '#7d9455', icon: '💰' },
  { name: 'Other Expense', type: 'expense', color: '#7a7263', icon: '📋' },
  { name: 'Transfers', type: 'both', color: '#8a6ba3', icon: '🔄' }
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
      CREATE TABLE IF NOT EXISTS accounts (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT    NOT NULL,
        currency      TEXT    NOT NULL DEFAULT 'EUR',
        balance       TEXT    DEFAULT '',
        balance_date  TEXT    DEFAULT '',
        balance_label TEXT    DEFAULT '',
        is_default    INTEGER DEFAULT 0,
        created_at    TEXT    DEFAULT (datetime('now'))
      );

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

      CREATE TABLE IF NOT EXISTS budgets (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        category   TEXT    NOT NULL,
        amount     REAL    NOT NULL,
        created_at TEXT    DEFAULT (datetime('now')),
        UNIQUE(account_id, category)
      );
    `)

    // Older databases don't have this column yet. SQLite can't add a
    // column "if not exists", so check for it first.
    const txColumns = this.db.prepare("PRAGMA table_info(transactions)").all()
    if (!txColumns.some(c => c.name === 'account_id')) {
      this.db.exec('ALTER TABLE transactions ADD COLUMN account_id INTEGER REFERENCES accounts(id)')
    }

    // Envelope budgeting is optional, so this stays empty until used.
    const accountColumns = this.db.prepare("PRAGMA table_info(accounts)").all()
    if (!accountColumns.some(c => c.name === 'monthly_budget_cap')) {
      this.db.exec('ALTER TABLE accounts ADD COLUMN monthly_budget_cap REAL')
    }

    this._migrateDefaultAccount()

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
      ['ai_provider', 'ollama'],
      ['ollama_url', 'http://127.0.0.1:11434'],
      ['custom_base_url', 'http://127.0.0.1:8080'],
      ['theme', 'light'],
      ['accent_color', 'caramel'],
      ['accent_custom', '#c68a4e'],
      ['account_balance', ''],
      ['account_balance_date', ''],
      ['account_balance_label', ''],
      ['user_name', ''],
      ['user_memory', '']
    ]
    const upsert = this.db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)')
    for (const [k, v] of defaults) upsert.run(k, v)
  }

  // The app used to support only one account, tracked as loose settings
  // (currency, account_balance, ...). The first time this runs after
  // updating, this turns that into a real "Main Account" row and points
  // every existing transaction at it, so nothing is lost.
  _migrateDefaultAccount() {
    const accountCount = this.db.prepare('SELECT COUNT(*) as n FROM accounts').get().n
    if (accountCount > 0) return

    const currency = this.getSetting('currency') || 'EUR'
    const balance = this.getSetting('account_balance') || ''
    const balanceDate = this.getSetting('account_balance_date') || ''
    const balanceLabel = this.getSetting('account_balance_label') || ''

    const result = this.db.prepare(
      'INSERT INTO accounts (name, currency, balance, balance_date, balance_label, is_default) VALUES (?,?,?,?,?,1)'
    ).run('Main Account', currency, balance, balanceDate, balanceLabel)

    this.db.prepare('UPDATE transactions SET account_id = ? WHERE account_id IS NULL')
      .run(result.lastInsertRowid)
  }

  // ── Accounts ────────────────────────────────────────────────────────────────
  getAccounts() {
    return this.db.prepare('SELECT * FROM accounts ORDER BY is_default DESC, name ASC').all()
  }

  addAccount(account) {
    const stmt = this.db.prepare(
      'INSERT INTO accounts (name, currency, balance, balance_date, balance_label) VALUES (?,?,?,?,?)'
    )
    const result = stmt.run(
      account.name, account.currency || 'EUR',
      account.balance || '', account.balance_date || '', account.balance_label || ''
    )
    return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid)
  }

  updateAccount(id, patch) {
    const stmt = this.db.prepare('UPDATE accounts SET name = ?, currency = ? WHERE id = ?')
    stmt.run(patch.name, patch.currency, id)
    return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id)
  }

  deleteAccount(id) {
    const account = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id)
    if (!account) return { success: false, error: 'Account not found' }

    const txCount = this.db.prepare('SELECT COUNT(*) as n FROM transactions WHERE account_id = ?').get(id).n
    if (txCount > 0) {
      return { success: false, error: `Cannot delete an account with ${txCount} transaction${txCount === 1 ? '' : 's'}. Delete or move them first.` }
    }

    this.db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
    return { success: true }
  }

  // Force-set an account's balance regardless of date (manual entry).
  setAccountBalance(id, amount, date, label = 'Manual entry') {
    this.db.prepare('UPDATE accounts SET balance = ?, balance_date = ?, balance_label = ? WHERE id = ?')
      .run(String(amount), date, label, id)
    return { updated: true, amount, date }
  }

  // Only overwrite an account's balance if the incoming date is newer —
  // used when importing a statement, so an older file can't clobber a
  // more recent balance.
  setAccountBalanceIfNewer(id, amount, date, label = '') {
    const account = this.db.prepare('SELECT balance_date FROM accounts WHERE id = ?').get(id)
    if (!account) return { updated: false, error: 'Account not found' }
    if (!account.balance_date || date > account.balance_date) {
      this.setAccountBalance(id, amount, date, label)
      return { updated: true, amount, date }
    }
    return { updated: false, stored_date: account.balance_date }
  }

  // ── Budgets ─────────────────────────────────────────────────────────────────
  getBudgets(accountId) {
    return this.db.prepare(
      'SELECT * FROM budgets WHERE account_id = ? ORDER BY category ASC'
    ).all(accountId)
  }

  // One budget per category per account. Saving the same category twice
  // updates the amount instead of making a duplicate row.
  saveBudget(budget) {
    this.db.prepare(`
      INSERT INTO budgets (account_id, category, amount) VALUES (?,?,?)
      ON CONFLICT(account_id, category) DO UPDATE SET amount = excluded.amount
    `).run(budget.account_id, budget.category, budget.amount)
    return this.db.prepare('SELECT * FROM budgets WHERE account_id = ? AND category = ?')
      .get(budget.account_id, budget.category)
  }

  deleteBudget(id) {
    this.db.prepare('DELETE FROM budgets WHERE id = ?').run(id)
    return { success: true }
  }

  // The optional overall monthly cap for envelope budgeting.
  setBudgetCap(accountId, cap) {
    this.db.prepare('UPDATE accounts SET monthly_budget_cap = ? WHERE id = ?')
      .run(cap === null || cap === '' ? null : Number(cap), accountId)
    return { success: true }
  }

  // ── Transactions ────────────────────────────────────────────────────────────
  getTransactions(filters = {}) {
    let sql = 'SELECT * FROM transactions WHERE 1=1'
    const params = []

    if (filters.dateFrom) { sql += ' AND date >= ?'; params.push(filters.dateFrom) }
    if (filters.dateTo) { sql += ' AND date <= ?'; params.push(filters.dateTo) }
    if (filters.category) { sql += ' AND category = ?'; params.push(filters.category) }
    if (filters.type) { sql += ' AND type = ?'; params.push(filters.type) }
    if (filters.accountId) { sql += ' AND account_id = ?'; params.push(filters.accountId) }
    if (filters.search) {
      sql += ' AND (description LIKE ? OR notes LIKE ?)'
      params.push(`%${filters.search}%`, `%${filters.search}%`)
    }
    if (filters.uncategorized) {
      sql += " AND (category IS NULL OR category = '')"
    }

    sql += ' ORDER BY date DESC, id DESC'
    if (filters.limit) { sql += ' LIMIT ?'; params.push(filters.limit) }

    return this.db.prepare(sql).all(...params)
  }

  addTransaction(tx) {
    const stmt = this.db.prepare(
      'INSERT INTO transactions (date, description, amount, category, type, source, notes, account_id) VALUES (?,?,?,?,?,?,?,?)'
    )
    const result = stmt.run(
      tx.date, tx.description, tx.amount, tx.category || null,
      tx.type, tx.source || 'manual', tx.notes || '', tx.account_id || null
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

  bulkCategorizeTransactions(ids, category) {
    const stmt = this.db.prepare('UPDATE transactions SET category = ? WHERE id = ?')
    const run = this.db.transaction((idList) => {
      for (const id of idList) stmt.run(category, id)
    })
    run(ids)
    return { updated: ids.length, category }
  }

  bulkDeleteTransactions(ids) {
    const del = this.db.transaction((idList) => {
      const stmt = this.db.prepare('DELETE FROM transactions WHERE id = ?')
      for (const id of idList) stmt.run(id)
    })
    del(ids)
    return { deleted: ids.length }
  }

  bulkUpdateCategory(ids, category) {
    const upd = this.db.transaction((idList) => {
      const stmt = this.db.prepare('UPDATE transactions SET category = ? WHERE id = ?')
      for (const id of idList) stmt.run(category, id)
    })
    upd(ids)
    return { updated: ids.length }
  }

  bulkAddTransactions(txs) {
    const stmt = this.db.prepare(
      'INSERT INTO transactions (date, description, amount, category, type, source, notes, account_id) VALUES (?,?,?,?,?,?,?,?)'
    )
    const insertMany = this.db.transaction((items) => {
      const inserted = []
      for (const tx of items) {
        const r = stmt.run(
          tx.date, tx.description, tx.amount, tx.category || null,
          tx.type, tx.source || 'upload', tx.notes || '', tx.account_id || null
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
  // The functions below all build a WHERE clause the same way: start from
  // "1=1" (always true), then append " AND ..." only for filters that were
  // actually given. This keeps optional filters out of the SQL entirely
  // instead of using empty placeholders.
  getSummary(filters = {}) {
    let where = '1=1'
    const params = []
    if (filters.dateFrom) { where += ' AND date >= ?'; params.push(filters.dateFrom) }
    if (filters.dateTo) { where += ' AND date <= ?'; params.push(filters.dateTo) }
    if (filters.category) { where += ' AND category = ?'; params.push(filters.category) }
    if (filters.accountId) { where += ' AND account_id = ?'; params.push(filters.accountId) }

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
    const { groupBy = 'month', dateFrom, dateTo, category, accountId } = filters

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
    if (accountId) { where += ' AND account_id = ?'; params.push(accountId) }

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
    if (filters.accountId) { where += ' AND account_id = ?'; params.push(filters.accountId) }

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

  // Total expenses grouped by day of the week.
  // SQLite's strftime('%w') gives '0' for Sunday through '6' for Saturday.
  getDayOfWeekBreakdown(filters = {}) {
    let where = "1=1 AND type='expense'"
    const params = []
    if (filters.dateFrom) { where += ' AND date >= ?'; params.push(filters.dateFrom) }
    if (filters.dateTo) { where += ' AND date <= ?'; params.push(filters.dateTo) }
    if (filters.accountId) { where += ' AND account_id = ?'; params.push(filters.accountId) }

    return this.db.prepare(`
      SELECT CAST(strftime('%w', date) AS INTEGER) as weekday,
             SUM(ABS(amount)) as total,
             COUNT(*) as count
      FROM transactions
      WHERE ${where}
      GROUP BY weekday ORDER BY weekday ASC
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
    if (filters.accountId) { where += ' AND account_id = ?'; params.push(filters.accountId) }

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
    if (filters.accountId) { where += ' AND account_id = ?'; params.push(filters.accountId) }

    return this.db.prepare(`
      SELECT * FROM transactions
      WHERE ${where}
      ORDER BY date DESC
    `).all(...params)
  }

}

module.exports = require('./ledger')(FinanceDB)
