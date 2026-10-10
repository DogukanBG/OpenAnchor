const assert=require('assert/strict'),fs=require('fs'),DB=require('../electron/database'),D=require('../electron/domain'),I=require('../electron/imports')
module.exports=async()=>{
 const db=new DB(fs.mkdtempSync('/private/tmp/openanchor-amount-formats-'));db.init()
 try{
 const accountId=db.getAccounts()[0].id
 for(const [locale,opening,amount,closing,expected] of [['de','2.000,00','-1.234,56','765,44',76544],['en','2,000.00','-1,234.56','765.44',76544],['de','0,00','-10,25','-10,25',-1025]]){
  const input={accountId,filename:`${locale}-${expected}.csv`,fileHash:D.hash(`${locale}-${expected}`),opening:{date:'2026-09-01',amount:opening,amount_locale:locale},balance:{date:'2026-10-01',amount:closing,amount_locale:locale},transactions:[{date:'2026-10-01',description:`Synthetic ${locale} ${expected}`,type:'expense',amount,amount_locale:locale,category:'Shopping'}]}
  assert.equal(I.reconciliation(input,'EUR').reconciled,true);assert.equal(db.importReview(input).rows[0].error,null)
  db.setAccountBalance(accountId,0,'2026-09-01');const result=db.importCommit(input);assert.equal(result.balance.updated,true);assert.equal(db.account(accountId).balance_minor,expected);assert.equal(db.getTransactions({batchId:result.batchId})[0].amount_minor,D.minor(amount,'EUR',locale));db.importUndo(result.batchId)
 }
 assert.equal(D.minor(-1234.56,'EUR','de'),-123456)
 const invalid={accountId,filename:'bad.csv',fileHash:D.hash('bad'),transactions:[{date:'2026-10-01',description:'Synthetic valid',type:'expense',amount:-10}],balance:{date:'2026-10-01',amount:'1,23,45',amount_locale:'de'}}
 const before=db.importHistory().length;assert.throws(()=>db.importCommit(invalid),/Invalid German/);assert.equal(db.importHistory().length,before);assert.equal(db.getTransactions({search:'Synthetic valid'}).length,0)
 console.log('German/English edited amounts and balances reconcile, commit exactly, undo and reject invalid formats atomically')
 }finally{db.close()}
}
