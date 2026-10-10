const assert=require('assert/strict'),fs=require('fs'),D=require('../electron/domain'),DB=require('../electron/database'),I=require('../electron/imports'),Data=require('../electron/data-management')
const folder=fs.mkdtempSync('/private/tmp/openanchor-test-'),db=new DB(folder);db.init();const a=db.getAccounts()[0].id
try {
 assert.equal(D.minor('-1.234,56','EUR','de'),-123456);assert.equal(D.minor('-12.34'),-1234);assert.equal(D.minor('0','JPY'),0);assert.throws(()=>D.date('2026-02-31'));assert.throws(()=>D.minor('12.345'))
 const parsed=I.csv('date;description;amount\n01.01.2026;"Two\nlines";-12,34\n31.02.2026;Bad;2,00');assert.equal(parsed.transactions[0].amount_minor,-1234);assert.equal(parsed.errors.length,1)
 db.setAccountBalance(a,0,'2026-01-01');assert.equal(db.getAccounts()[0].balance,'0');db.setAccountBalance(a,-10,'2026-01-02');assert.equal(db.getAccounts()[0].balance,'-10')
 const t=db.addTransaction({account_id:a,date:'2026-01-01',description:'Rent',amount:-1000,type:'expense',category:'Housing & Rent'})
 const b=db.addAccount({name:'Savings',currency:'EUR'}).id;db.updateTransaction(t.id,{account_id:b});assert.equal(db.getTransactions({id:t.id})[0].account_id,b)
 db.addTransfer({fromAccountId:a,toAccountId:b,date:'2026-01-02',amount:100});assert.equal(db.getSummary({accountId:a}).expenses,0)
 assert.throws(()=>db.bulkAddTransactions([{account_id:a,date:'2026-01-03',description:'OK',amount:-1,type:'expense'},{account_id:a,date:'invalid',description:'Bad',amount:-1,type:'expense'}]));assert.equal(db.getTransactions({accountId:a}).filter(t=>!t.transfer_id).length,0)
 const input={accountId:a,filename:'fixture.csv',fileHash:D.hash('fixture'),transactions:[{date:'2026-01-03',description:'Electricity',amount:-42.5,type:'expense',category:'Utilities'}],coverage:{verified:true,dateFrom:'2026-01-01',dateTo:'2026-01-31'},balance:{date:'2026-01-31',amount:0}}
 const result=db.importCommit(input);assert.equal(result.inserted,1);assert.equal(db.getSummary({accountId:a}).expenses,42.5);assert.throws(()=>db.importCommit(input));db.importUndo(result.batchId);assert.equal(db.getAccounts()[0].balance,'-10');assert.equal(db.coverage(a).length,0)
 assert.equal(D.intervalCoverage([{date_from:'2026-01-01',date_to:'2026-06-28'}],'2026-06-28',180).eligible,false);assert.equal(D.intervalCoverage([{date_from:'2026-01-01',date_to:'2026-06-29'}],'2026-06-29',180).eligible,true)
 assert.equal(D.nextOccurrence('2026-01-31','monthly'), '2026-02-28');assert.equal(D.nextOccurrence('2026-01-31','monthly',2),'2026-03-31')
 const groceries=[0,1,2].map(i=>({id:i,account_id:a,merchant_id:1,date:D.addDays('2026-01-01',i*7),description:'Groceries',category:'Groceries & Food',type:'expense',amount_minor:-1000}));assert.equal(D.candidateGroups(groceries).length,0)
 const rent=groceries.map((t,i)=>({...t,date:D.nextOccurrence('2026-01-31','monthly',i),description:'Rent',category:'Housing & Rent'}));assert.equal(D.candidateGroups(rent)[0].cadence,'monthly')
 const custom=db.addCategory({name:'Test category',type:'expense',color:'#000000',icon:'x'});const c=typeof custom==='number'?custom:custom.id;const row=db.addTransaction({account_id:a,date:'2026-02-01',description:'Test',amount:-1,type:'expense',category:'Test category'});assert.equal(db.deleteCategory(c).success,false)
 db.correctCategory({id:row.id,category:'Utilities',mode:'future'});assert.equal(db.suggestCategory({account_id:a,description:'Test',type:'expense'}).category,'Utilities')
 assert.throws(()=>db.addTransaction({account_id:a,date:'2026-02-01',description:'Invalid',amount:-1,type:'expense',category:'Salary'}))
 const sp=db.spending({accountId:a,dimension:'merchant'});assert.equal(sp.rows.reduce((sum,g)=>sum+g.total_minor,0),100)
 Data.backup(db,folder+'/backup.db');db.addTransaction({account_id:a,date:'2026-02-02',description:'Temporary',amount:-2,type:'expense'});Data.restore(db,folder+'/backup.db');assert.equal(db.getTransactions({search:'Temporary'}).length,0)
 console.log('Ledger, imports, recurrence and recovery checks passed')
}finally{db.close()}
