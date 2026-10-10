const assert=require('assert/strict'),path=require('path'),fs=require('fs'),{pathToFileURL}=require('url'),DB=require('../electron/database')
module.exports=async()=>{
 const {matchGermanKeyword:match}=await import(pathToFileURL(path.resolve(__dirname,'../src/utils/german-keywords.mjs')))
 for(const [description,type,category] of [
  ['SEPA Gutschrift Deutschlandstipendium Oktober','income','Scholarships'],['DAAD Stipendienzahlung','income','Scholarships'],['Studienstiftung Forschungsstipendium','income','Scholarships'],['Gehaltsgutschrift Oktober','income','Salary'],
  ['SEPA LASTSCHRIFT REWE1234 BERLIN','expense','Groceries & Food'],['ALDI SÜD Kartenzahlung','expense','Groceries & Food'],['Bäckerei Kamps','expense','Restaurants'],['Baeckerei Kamps','expense','Restaurants'],
  ['DB VERTRIEB Deutschlandticket','expense','Transport'],['STADTWERKE MÜNCHEN Stromabschlag','expense','Utilities'],['Rundfunkbeitrag ARD ZDF Beitragsservice','expense','Utilities'],['HUK-COBURG Versicherungsbeitrag','expense','Insurance'],
  ['Amazon Prime Video','expense','Entertainment'],['AMZN MKTP DE Bestellung','expense','Shopping'],['Uber Eats Bestellung','expense','Restaurants'],['Semesterbeitrag Studentenwerk','expense','Education'],['ETF-Sparplan Trade Republic','expense','Investments'],['ROSSMANN KARTENZAHLUNG','expense','Healthcare']
 ])assert.equal(match(description,type),category,description)
 for(const description of ['SEPA Lastschrift','PAYPAL Zahlung','Kartenzahlung','Expertise Beratung','Shelling Consulting','Jetstream GmbH','Mietwagen Sixt']){if(description==='Mietwagen Sixt')assert.equal(match(description,'expense'),'Transport');else assert.equal(match(description,'expense'),null,description)}
 assert.notEqual(match('Deutschlandstipendium','expense'),'Scholarships')
 const candidates=require('../electron/domain').candidateGroups([1,2,3].map(month=>({id:month,account_id:1,currency:'EUR',merchant_id:1,date:`2026-0${month}-01`,description:'Deutschlandstipendium',category:'Scholarships',type:'income',amount_minor:30000})));assert.equal(candidates.length,1);assert.equal(candidates[0].type,'income')
 const folder=fs.mkdtempSync('/private/tmp/openanchor-scholarship-'),db=new DB(folder);db.init()
 try{const category=db.getCategories().find(c=>c.name==='Scholarships');assert.equal(category.type,'income');const id=category.id,account_id=db.getAccounts()[0].id
  const transaction=db.addTransaction({account_id,date:'2026-10-01',description:'Deutschlandstipendium',amount:300,type:'income',category:'Scholarships'});assert.equal(transaction.category_id,id)
  // Simulate a v3 ledger to exercise the upgrade of existing data.
  db.db.prepare('DELETE FROM transactions WHERE id=?').run(transaction.id);db.db.prepare('DELETE FROM categories WHERE id=?').run(id);db.db.prepare('DELETE FROM schema_migrations WHERE version=4').run();db.close();db.init()
  assert.equal(db.getCategories().filter(c=>c.name==='Scholarships').length,1);assert.ok(fs.readdirSync(path.join(folder,'backups')).some(f=>f.startsWith('before-v4-')))
 }finally{db.close()}
 console.log('German purpose/merchant keywords, false matches and Scholarships migration passed')
}
