const fs=require('fs'),path=require('path'),D=require('./domain')
const SQLite=require('better-sqlite3')
module.exports={
 wipe(db,input){
  D.assert(input?.confirmation==='WIPE','Type WIPE to confirm resetting financial data')
  const root=path.dirname(db.dbPath),stage=fs.mkdtempSync(path.join(root,'.wipe-')),Fresh=require('./database'),fresh=new Fresh(stage)
  const keys=['ai_provider','ollama_url','custom_base_url','extraction_model','assistant_model','ollama_extraction_model','ollama_assistant_model','custom_extraction_model','custom_assistant_model','llama_model_path','llama_binary','theme','accent_color','accent_custom','currency','date_format'],saved=Object.fromEntries(keys.map(key=>[key,db.getSetting(key)]).filter(([,value])=>value!==null))
  let closed=false
  try{
   fresh.init();for(const [key,value] of Object.entries(saved))fresh.setSetting(key,value);fresh.setSetting('forecast_enabled','false');fresh.db.pragma('wal_checkpoint(TRUNCATE)');fresh.close()
   const backups=path.join(root,'backups');fs.mkdirSync(backups,{recursive:true});const recoveryBackup=path.join(backups,`before-wipe-${require('crypto').randomUUID()}.db`);module.exports.backup(db,recoveryBackup)
   db.db.pragma('wal_checkpoint(TRUNCATE)');db.close();closed=true
   for(const suffix of ['-wal','-shm'])fs.rmSync(db.dbPath+suffix,{force:true})
   fs.renameSync(fresh.dbPath,db.dbPath);db.init();closed=false
   return {wiped:true,modelsPreserved:true,recoveryBackup}
  }finally{if(fresh.db?.open)fresh.close();if(closed)db.init();fs.rmSync(stage,{recursive:true,force:true})}
 },
 backup(db,destination){D.assert(!fs.existsSync(destination),'Choose a new backup file');db.db.prepare('VACUUM INTO ?').run(destination);return {path:destination}},
 restore(db,source){const check=new SQLite(source,{readonly:true,fileMustExist:true});try{D.assert(check.pragma('integrity_check',{simple:true})==='ok','Backup failed integrity check');D.assert(check.prepare("SELECT name FROM sqlite_master WHERE name='transactions'").get(),'Not an OpenAnchor backup');const version=check.prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'").get()?check.prepare('SELECT MAX(version) v FROM schema_migrations').get().v:0;D.assert(version<=4,'Backup was created by a newer version')}finally{check.close()}
 const folder=path.join(path.dirname(db.dbPath),'backups');fs.mkdirSync(folder,{recursive:true});const safety=path.join(folder,`before-restore-${require('crypto').randomUUID()}.db`);db.db.prepare('VACUUM INTO ?').run(safety)
 const stage=fs.mkdtempSync(path.join(path.dirname(db.dbPath),'.restore-')),candidate=new (require('./database'))(stage)
 let closed=false
 try{
  const snapshot=new SQLite(source,{readonly:true,fileMustExist:true});try{snapshot.prepare('VACUUM INTO ?').run(candidate.dbPath)}finally{snapshot.close()}candidate.init();
  for(const table of db.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()){const columns=new Set(candidate.db.prepare('SELECT name FROM pragma_table_info(?)').all(table.name).map(c=>c.name));D.assert(db.db.prepare('SELECT name FROM pragma_table_info(?)').all(table.name).every(c=>columns.has(c.name)),`Backup is missing required fields in ${table.name}`)}
  candidate.getTransactions({includeInvalid:true});candidate.getAccounts();candidate.db.pragma('foreign_key_check').forEach(()=>{throw Error('Backup has invalid references')});candidate.db.pragma('wal_checkpoint(TRUNCATE)');candidate.close()
  db.db.pragma('wal_checkpoint(TRUNCATE)');db.close();closed=true
  for(const suffix of ['-wal','-shm'])fs.rmSync(db.dbPath+suffix,{force:true})
  fs.renameSync(candidate.dbPath,db.dbPath);db.init();db.bump();db.bump(true);closed=false
  return {restored:true,safetyBackup:safety}
 }catch(error){if(closed){if(db.db?.open)db.close();for(const suffix of ['-wal','-shm'])fs.rmSync(db.dbPath+suffix,{force:true});fs.copyFileSync(safety,db.dbPath);db.init()}throw error}
 finally{if(candidate.db?.open)candidate.close();fs.rmSync(stage,{recursive:true,force:true})}},
 export(db,destination,scope){const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const rows=db.getTransactions(scope);const columns=['id','account_id','currency','date','description','amount','category','type','transfer_id','import_batch_id','source_page','counterparty','category_source'];fs.writeFileSync(destination,[columns.join(','),...rows.map(t=>columns.map(k=>quote(t[k])).join(','))].join('\r\n'));return {exported:rows.length}}
}
