const D=require('./domain')
module.exports=(db,scope)=>{
 if(scope.dateFrom==='1900-01-01'){
  db.account(scope.accountId);D.date(scope.dateTo)
  const first=db.db.prepare('SELECT MIN(date) date FROM transactions WHERE account_id=? AND validation_error IS NULL AND date<=?').get(scope.accountId,scope.dateTo).date
  const starts=[first,...db.coverage(scope.accountId).filter(c=>c.date_from<=scope.dateTo).map(c=>c.date_from)].filter(Boolean).sort()
  scope={...scope,dateFrom:starts[0]||scope.dateTo}
 }
 const evidence=db.evidence({analysis:'summary',scope}),summary=db.getSummary(scope),cash=db.getCashFlow(scope),duration=D.days(scope.dateFrom,scope.dateTo)+1,prior={accountId:scope.accountId,dateTo:D.addDays(scope.dateFrom,-1),dateFrom:D.addDays(scope.dateFrom,-duration)},currentCoverage=D.intervalCoverage(db.coverage(scope.accountId),scope.dateTo,duration),priorCoverage=D.intervalCoverage(db.coverage(scope.accountId),prior.dateTo,duration),comparison=currentCoverage.eligible&&priorCoverage.eligible?db.getSummary(prior):null,categories=db.getCategoryBreakdown({...scope,type:'expense'}),month=db.planGet(scope.accountId,scope.dateTo.slice(0,7))
 const facts=[{id:'income',label:'Recorded income',value:summary.income,unit:'money'},{id:'spending',label:'Recorded spending',value:summary.expenses,unit:'money'},{id:'net',label:'Net account cash flow',value:D.major(cash.totals.net_minor,cash.currency),unit:'money'}]
 if(comparison&&comparison.expenses>0)facts.push({id:'spending_change',label:'Spending change versus previous equal-length period',value:(summary.expenses/comparison.expenses-1)*100,unit:'percent'})
 const alerts=[];if(summary.net<0)alerts.push({text:'Recorded spending exceeds income in this period.',fact_ids:['income','spending']})
 const monthStart=D.monthRange(month.month).dateFrom,monthSpending=scope.dateFrom<=monthStart?db.getCategoryBreakdown({accountId:scope.accountId,dateFrom:monthStart,dateTo:scope.dateTo,type:'expense'}):[]
 for(const limit of scope.dateFrom<=monthStart?month.allocations:[]){const actual=monthSpending.find(c=>c.category===limit.category)?.total_minor||0;if(actual>limit.amount_minor){const id='budget_'+limit.category_id;facts.push({id,label:`${limit.category} over monthly limit through ${scope.dateTo}`,value:D.major(actual-limit.amount_minor,evidence.currency),unit:'money'});alerts.push({text:`${limit.category} exceeds the saved monthly limit.`,fact_ids:[id]})}}
 const commitments=db.recurringList(scope.accountId).filter(s=>s.status==='active');if(!currentCoverage.eligible)alerts.push({text:'Coverage is incomplete; recorded totals may not represent the whole period.',fact_ids:[]})
 const transaction_ids=[...new Set([...evidence.transaction_ids,...cash.transaction_ids])]
 return {...evidence,transaction_ids,count:transaction_ids.length,analysis:'health',facts,categories,alerts,comparison,comparison_scope:prior,complete:currentCoverage.eligible,budget_month:month.month,commitments,comparison_unavailable:comparison?null:'A comparison requires complete verified coverage in both periods.'}
}
