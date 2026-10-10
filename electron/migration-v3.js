const fs=require('fs'),path=require('path')
module.exports=(db,dbPath)=>{
 if(db.prepare('SELECT 1 FROM schema_migrations WHERE version=3').get())return
 const folder=path.join(path.dirname(dbPath),'backups');fs.mkdirSync(folder,{recursive:true})
 db.prepare('VACUUM INTO ?').run(path.join(folder,`before-v3-${Date.now()}.db`))
 db.transaction(()=>{
  db.prepare("INSERT OR IGNORE INTO categories(name,type,color,icon,is_default) VALUES ('Investments','both','#6b8f3f','📈',1)").run()
  db.prepare("UPDATE categories SET type='both' WHERE name='Investments' AND is_default=1").run()
  db.prepare('INSERT INTO schema_migrations(version) VALUES (3)').run()
 })()
}
