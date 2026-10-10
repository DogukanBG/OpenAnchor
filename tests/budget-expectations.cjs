const assert=require('assert/strict'),fs=require('fs'),DB=require('../electron/database'),D=require('../electron/domain')
module.exports=async()=>{
 const db=new DB(fs.mkdtempSync('/private/tmp/openanchor-budget-estimates-'));db.init()
 try{
 const accountId=db.getAccounts()[0].id,month='2026-10',from=D.addDays('2026-09-30',-119),groceries=db.category('Groceries & Food').id,investments=db.category('Investments').id
 const add=(date,amount,category,description='Synthetic spending',extra={})=>db.addTransaction({account_id:accountId,date,amount,category,description,type:'expense',...extra})
 const purchase=add(from,-140,'Groceries & Food');add('2026-09-02',20,'Groceries & Food','Synthetic refund',{refund_for:purchase.id});add('2026-09-03',-240,'Investments');add('2026-09-04',-60,null)
 db.addTransaction({account_id:accountId,date:'2026-09-05',amount:3000,type:'income',category:'Salary',description:'Synthetic income'})
 add('2026-10-01',-9000,'Groceries & Food','Target-month spending excluded from estimate')
 const other=db.addAccount({name:'Other currency',currency:'USD'});db.addTransaction({account_id:other.id,date:'2026-09-01',amount:-999,type:'expense',category:'Groceries & Food',description:'Other account excluded'})
 const own=db.addAccount({name:'Savings',currency:'EUR'});db.addTransfer({fromAccountId:accountId,toAccountId:own.id,date:'2026-09-06',amount:100,description:'Internal transfer'})
 let estimate=db.planExpectedSpending({accountId,month});assert.equal(estimate.lookbackDays,120);assert.equal(estimate.eligible,false);assert.equal(estimate.expected_total_minor,null)
 db.confirmCoverage({accountId,dateFrom:from,dateTo:'2026-09-30'});estimate=db.planExpectedSpending({accountId,month});assert.equal(estimate.eligible,true);assert.equal(estimate.targetDays,31);assert.equal(estimate.history.dateFrom,from);assert.equal(estimate.history_total_minor,42000);assert.equal(estimate.expected_total_minor,10850)
 assert.equal(estimate.categories.find(c=>c.category_id===groceries).expected_minor,3100);assert.equal(estimate.categories.find(c=>c.category_id===investments).expected_minor,6200);assert.equal(estimate.categories.find(c=>c.category_id===null).expected_minor,1550);assert.equal(estimate.categories.reduce((sum,c)=>sum+c.expected_minor,0),estimate.expected_total_minor)
 const short=db.planExpectedSpending({accountId,month,lookbackDays:30});assert.equal(short.history.dateFrom,'2026-09-01');assert.equal(short.categories.find(c=>c.category_id===groceries).expected_minor,-2067,'Refund-only short history remains a net credit')
 assert.throws(()=>db.planExpectedSpending({accountId,month,lookbackDays:0}),/history days/);assert.throws(()=>db.planExpectedSpending({accountId,month,lookbackDays:2.5}),/history days/)
 db.db.prepare('DELETE FROM coverage WHERE account_id=?').run(accountId);db.confirmCoverage({accountId,dateFrom:from,dateTo:'2026-09-10'});db.confirmCoverage({accountId,dateFrom:'2026-09-12',dateTo:'2026-09-30'});const gap=db.planExpectedSpending({accountId,month});assert.equal(gap.eligible,false);assert.equal(gap.history.missingDays,1);assert.equal(gap.expected_total_minor,null)
 db.confirmCoverage({accountId,dateFrom:'2026-09-11',dateTo:'2026-09-11'});db.planSave({account_id:accountId,month,income_minor:100000,savings_minor:0,buffer_minor:0,cap_minor:null,allocations:[{category_id:groceries,amount_minor:1000},{category_id:investments,amount_minor:1000}]})
 const alerts=db.planAlerts({accountId,month});assert.ok(alerts.alerts.some(a=>a.kind==='over-limit'&&a.category_id===groceries));assert.ok(alerts.alerts.some(a=>a.kind==='expected-over-limit'&&a.category_id===investments))
 const rent=db.recurringSave({account_id:accountId,name:'Synthetic rent',category:'Housing & Rent',type:'expense',cadence:'monthly',next_date:'2026-10-01',effective_from:'2026-10-01',amount:-100,status:'active'}),salary=db.recurringSave({account_id:accountId,name:'Synthetic salary',category:'Salary',type:'income',cadence:'monthly',next_date:'2026-10-25',effective_from:'2026-10-01',amount:3000,status:'active'})
 const paid=add('2026-10-02',-100,'Housing & Rent');db.db.prepare('UPDATE transactions SET recurring_id=? WHERE id=?').run(rent.id,paid.id);db.saveEvent({account_id:accountId,name:'Synthetic one-off',date:'2026-10-15',amount:-20})
 const calendar=db.planCalendar({accountId,month});assert.equal(calendar.events.length,3);assert.equal(calendar.events.find(e=>e.series_id===rent.id).status,'paid');assert.equal(calendar.events.find(e=>e.series_id===salary.id).type,'income');assert.equal(calendar.income_minor,300000);assert.equal(calendar.outflow_minor,12000);assert.equal(db.getTransactions({accountId}).filter(t=>t.description==='Synthetic one-off').length,0)
 const empty=db.planExpectedSpending({accountId:own.id,month,lookbackDays:120});assert.equal(empty.eligible,false);db.confirmCoverage({accountId:own.id,dateFrom:from,dateTo:'2026-09-30'});assert.equal(db.planExpectedSpending({accountId:own.id,month}).expected_total_minor,0,'Covered zero-spending days count in denominator')
 db.confirmCoverage({accountId:own.id,dateFrom:'2023-10-01',dateTo:'2024-01-31'});assert.equal(db.planExpectedSpending({accountId:own.id,month:'2024-02'}).targetDays,29)
 console.log('Historical monthly category estimates, lookback/coverage/refunds/transfers/currency boundaries, budget alerts and bill/income calendar passed')
 }finally{db.close()}
}
