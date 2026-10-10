const assert=require('assert/strict'),fs=require('fs'),DB=require('../electron/database'),D=require('../electron/domain')
module.exports=async()=>{const db=new DB(fs.mkdtempSync('/private/tmp/openanchor-import-checks-'));db.init();try{
 const accountId=db.getAccounts()[0].id,tx={date:'2026-09-01',description:'Synthetic purchase',amount:-10,type:'expense',category:'Shopping'},base={accountId,filename:'synthetic.csv',fileHash:D.hash('synthetic checks'),transactions:[tx]}
 assert.equal(db.importChecks(base).ready,true);assert.ok(db.importChecks(base).checks.some(c=>c.id==='coverage'))
 const duplicate={...base,transactions:[tx,{...tx}]},review=db.importReview(duplicate);assert.deepEqual(review.rows[1].duplicate_rows,[0]);assert.equal(db.importChecks(duplicate).ready,false);assert.throws(()=>db.importCommit(duplicate),/overlapping/);assert.equal(db.importHistory().length,0)
 const permitted={...duplicate,transactions:[tx,{...tx,allow_duplicate:true}]};assert.equal(db.importChecks(permitted).ready,true)
 assert.equal(db.importChecks({...base,transactions:[{...tx,date:'bad'}]}).ready,false);assert.equal(db.importChecks({...base,transactions:[{...tx,category_source:'AI suggestion',ai_reviewed:false}]}).ready,false)
 const balanced={...base,opening:{date:'2026-08-31',amount:100},balance:{date:'2026-09-01',amount:90}};assert.equal(db.importChecks(balanced).reconciliation.reconciled,true);assert.equal(db.importChecks({...balanced,balance:{date:'2026-09-01',amount:95}}).ready,false)
 db.confirmCoverage({accountId,dateFrom:'2026-07-01',dateTo:'2026-07-31'});const coverage={dateFrom:'2026-09-01',dateTo:'2026-09-30',verified:true},gap=db.importChecks({...base,coverage});assert.equal(gap.ready,true);assert.deepEqual(gap.gaps,[{dateFrom:'2026-08-01',dateTo:'2026-08-31'}]);assert.equal(db.importChecks({...base,coverage,errors:[{page:2,error:'No text'}]}).ready,false)
 assert.equal(db.importChecks({...base,coverage:{dateFrom:'2026-09-02',dateTo:'2026-09-30',verified:true}}).ready,false)
 db.importCommit({...base,coverage});assert.equal(db.importChecks(base).ready,false);assert.ok(db.importChecks({...base,fileHash:D.hash('different file')}).checks.some(c=>c.id==='duplicates'))
 db.setAccountBalance(accountId,90,'2026-09-01','Synthetic anchor');assert.ok(db.importChecks({...base,fileHash:D.hash('stale balance'),transactions:[{...tx,date:'2026-09-02'}],balance:{date:'2026-09-01',amount:90}}).checks.some(c=>c.id==='stale-balance'))
 console.log('Import preflight: within-file/existing duplicates, review gates, balances, missing periods and failed extraction passed')
 }finally{db.close()}}
