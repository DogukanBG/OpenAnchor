const fs = require('fs')
const path = require('path')
const D = require('./domain')
function migrate(db, dbPath) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)')
  if (db.prepare('SELECT 1 FROM schema_migrations WHERE version=1').get()) return
  // VACUUM INTO creates a consistent snapshot even while the source uses WAL.
  const dir = path.join(path.dirname(dbPath), 'backups'); fs.mkdirSync(dir, { recursive: true })
  const backup = path.join(dir, `before-v1-${Date.now()}.db`)
  db.prepare('VACUUM INTO ?').run(backup)
  db.transaction(() => {
    const add = (table, column, definition) => { if (!db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`) }
    for (const [name, type] of Object.entries({ amount_minor: 'INTEGER', category_id: 'INTEGER REFERENCES categories(id)', merchant_id: 'INTEGER REFERENCES merchants(id)', transfer_id: 'TEXT', recurring_id: 'INTEGER', import_batch_id: 'INTEGER', source_page: 'INTEGER', counterparty: 'TEXT', category_source: "TEXT DEFAULT 'legacy'", validation_error: 'TEXT', raw_json: 'TEXT', refund_for: 'INTEGER' })) add('transactions', name, type)
    add('accounts', 'balance_minor', 'INTEGER'); add('accounts', 'balance_error', 'TEXT')
    add('chats', 'scope_json', 'TEXT'); add('chats', 'context_revision', 'INTEGER')
    add('chat_messages', 'evidence_json', 'TEXT')
    db.exec(`
      CREATE TABLE merchants(id INTEGER PRIMARY KEY, name TEXT NOT NULL, identity TEXT NOT NULL UNIQUE, category_id INTEGER REFERENCES categories(id));
      CREATE TABLE merchant_aliases(alias TEXT PRIMARY KEY, merchant_id INTEGER NOT NULL REFERENCES merchants(id));
      CREATE TABLE category_rules(id INTEGER PRIMARY KEY, account_id INTEGER REFERENCES accounts(id), identity TEXT NOT NULL, type TEXT NOT NULL, category_id INTEGER NOT NULL REFERENCES categories(id), UNIQUE(account_id,identity,type));
      CREATE TABLE import_batches(id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id), filename TEXT NOT NULL, file_hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, undone INTEGER NOT NULL DEFAULT 0, previous_balance_json TEXT, accepted_balance_json TEXT, errors_json TEXT);
      CREATE UNIQUE INDEX import_hash_active ON import_batches(account_id,file_hash) WHERE undone=0;
      CREATE TABLE coverage(id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id), date_from TEXT NOT NULL, date_to TEXT NOT NULL, batch_id INTEGER REFERENCES import_batches(id), verified INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE recurring_series(id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id), merchant_id INTEGER REFERENCES merchants(id), name TEXT NOT NULL, category_id INTEGER REFERENCES categories(id), type TEXT NOT NULL, cadence TEXT NOT NULL, next_date TEXT NOT NULL, amount_minor INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active', effective_from TEXT NOT NULL, effective_to TEXT, manual INTEGER DEFAULT 0);
      CREATE TABLE recurring_versions(id INTEGER PRIMARY KEY, series_id INTEGER NOT NULL REFERENCES recurring_series(id), snapshot_json TEXT NOT NULL, changed_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE recurring_dismissals(candidate_key TEXT PRIMARY KEY);
      CREATE TABLE budget_plans(id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id), month TEXT NOT NULL, income_minor INTEGER NOT NULL DEFAULT 0, savings_minor INTEGER NOT NULL DEFAULT 0, buffer_minor INTEGER NOT NULL DEFAULT 0, cap_minor INTEGER, UNIQUE(account_id,month));
      CREATE TABLE budget_allocations(id INTEGER PRIMARY KEY, plan_id INTEGER NOT NULL REFERENCES budget_plans(id) ON DELETE CASCADE, category_id INTEGER NOT NULL REFERENCES categories(id), amount_minor INTEGER NOT NULL, UNIQUE(plan_id,category_id));
      CREATE TABLE planned_events(id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id), name TEXT NOT NULL, date TEXT NOT NULL, amount_minor INTEGER NOT NULL);
      CREATE TABLE forecast_cache(cache_key TEXT PRIMARY KEY, result_json TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE audit_log(id INTEGER PRIMARY KEY, action TEXT NOT NULL, record_id INTEGER, snapshot_json TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX idx_tx_account_date ON transactions(account_id,date);
      CREATE INDEX idx_tx_merchant ON transactions(merchant_id,date);
      CREATE INDEX idx_coverage_account ON coverage(account_id,date_to);
    `)
    const merchants = new Map()
    for (const tx of db.prepare('SELECT * FROM transactions').all()) {
      let error = null, amount = null
      const account = db.prepare('SELECT * FROM accounts WHERE id=?').get(tx.account_id)
      const cat = tx.category ? db.prepare('SELECT * FROM categories WHERE name=?').get(tx.category) : null
      try {
        D.date(tx.date); D.assert(account, 'Missing account'); D.assert(Number.isFinite(tx.amount), 'Invalid amount')
        const p = D.precision(account.currency)
        amount = D.minor(tx.amount,account.currency)
        D.assert(Number.isSafeInteger(amount), 'Invalid amount')
        D.assert(tx.type === 'expense' ? amount <= 0 : amount >= 0, 'Amount direction disagrees with transaction type')
        D.assert(['expense','income'].includes(tx.type),'Invalid legacy transaction type');D.assert(!tx.category || cat && (cat.type===tx.type || cat.type==='both'), 'Unknown or incompatible legacy category')
      } catch (e) { error = e.message }
      const identity = D.normalized(tx.description)
      if (!merchants.has(identity)) merchants.set(identity, db.prepare('INSERT INTO merchants(name,identity) VALUES (?,?)').run(tx.description || 'Unknown', identity).lastInsertRowid)
      db.prepare('UPDATE transactions SET amount_minor=?,category_id=?,merchant_id=?,validation_error=?,raw_json=? WHERE id=?').run(amount,cat?.id || null,merchants.get(identity),error,JSON.stringify(tx),tx.id)
    }
    for (const acc of db.prepare('SELECT * FROM accounts').all()) {
      let amount = null, error = null
      if (acc.balance !== '' && acc.balance !== null) { try { D.date(acc.balance_date); amount = D.minor(acc.balance,acc.currency) } catch (e) { error = e.message } }
      db.prepare('UPDATE accounts SET balance_minor=?,balance_error=? WHERE id=?').run(amount,error,acc.id)
    }
    for (const b of db.prepare('SELECT * FROM budgets').all()) {
      const acc = db.prepare('SELECT * FROM accounts WHERE id=?').get(b.account_id); const cat = db.prepare('SELECT id FROM categories WHERE name=?').get(b.category)
      if (!acc || !cat || !Number.isFinite(b.amount) || b.amount < 0) continue
      const m = D.today().slice(0,7)
      db.prepare('INSERT OR IGNORE INTO budget_plans(account_id,month) VALUES (?,?)').run(acc.id,m)
      const plan = db.prepare('SELECT id FROM budget_plans WHERE account_id=? AND month=?').get(acc.id,m)
      db.prepare('INSERT OR IGNORE INTO budget_allocations(plan_id,category_id,amount_minor) VALUES (?,?,?)').run(plan.id,cat.id,Math.round(b.amount*10**D.precision(acc.currency)))
    }
    for (const acc of db.prepare('SELECT * FROM accounts WHERE monthly_budget_cap IS NOT NULL').all()) {
      db.prepare('INSERT OR IGNORE INTO budget_plans(account_id,month) VALUES (?,?)').run(acc.id,D.today().slice(0,7))
      db.prepare('UPDATE budget_plans SET cap_minor=? WHERE account_id=? AND month=?').run(Math.round(acc.monthly_budget_cap*10**D.precision(acc.currency)),acc.id,D.today().slice(0,7))
    }
    for (const [key,value] of [['ledger_revision','1'],['schedule_revision','1'],['forecast_enabled','false'],['forecast_history_days','180'],['forecast_horizon','90']]) db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)').run(key,value)
    db.prepare('INSERT INTO schema_migrations(version) VALUES (1)').run()
  })()
}
module.exports = migrate
