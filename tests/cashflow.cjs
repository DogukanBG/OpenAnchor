const assert=require('assert/strict'),fs=require('fs'),DB=require('../electron/database'),Forecast=require('../electron/forecast/service'),health=require('../electron/health')
module.exports=async()=>{
 const db=new DB(fs.mkdtempSync('/private/tmp/openanchor-cashflow-'));db.init()
 try{
  const a=db.getAccounts()[0].id,b=db.addAccount({name:'Savings',currency:'EUR'}).id
  db.addTransaction({account_id:a,date:'2026-05-01',description:'Income',amount:100,type:'income',category:'Salary'})
  const expense=db.addTransaction({account_id:a,date:'2026-05-01',description:'Utility',amount:-25,type:'expense',category:'Utilities'})
  db.addTransaction({account_id:a,date:'2026-05-01',description:'Refund',amount:5,type:'expense',category:'Utilities',refund_for:expense.id})
  db.addTransfer({fromAccountId:a,toAccountId:b,date:'2026-05-01',amount:50})
  const scope={accountId:a,dateFrom:'2026-05-01',dateTo:'2026-05-30'},cash=db.getCashFlow(scope)
  assert.deepEqual(cash.totals,{inflow_minor:10500,outflow_minor:7500,net_minor:3000})
  assert.equal(db.getSummary(scope).expenses,20);assert.equal(db.getSummary(scope).income,100)
  assert.equal(db.getCashFlow({...scope,accountId:b}).totals.net_minor,5000)
  assert.deepEqual(db.getCashFlow({...scope,accountId:undefined,accountIds:[a,b]}).totals,{inflow_minor:10500,outflow_minor:2500,net_minor:8000})
  const report=health(db,scope);assert.equal(report.facts.find(f=>f.id==='net').value,30);assert.equal(report.transaction_ids.length,4)
  db.setSetting('forecast_history_days','30');for(const accountId of [a,b])db.confirmCoverage({...scope,accountId})
  const forecast=new Forecast(db,{}),single=forecast.inputs({},forecast.eligibility({accountId:a})),combined=forecast.inputs({},forecast.eligibility({accountIds:[a,b]}))
  assert.equal(single[0].outflow[0],7500);assert.equal(combined[0].outflow[0],2500);assert.equal(combined[1].inflow[0],0)
  const usd=db.addAccount({name:'Dollar',currency:'USD'}).id;assert.throws(()=>db.getCashFlow({accountIds:[a,usd]}),/one currency/)
  console.log('Transfer boundary, refunds, cash-flow evidence and forecast inputs reconcile')
 }finally{db.close()}
}
