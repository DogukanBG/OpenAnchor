const D=require('../domain')
module.exports=(evidence,result,scope)=>{
 const days=result?.days.filter(d=>d.date>=scope.dateFrom&&d.date<=scope.dateTo)||[]
 evidence.facts=[];evidence.transaction_ids=[]
 if(!days.length){evidence.unavailable='No current eligible forecast overlaps the requested dates.';return evidence}
 const scale=10**D.precision(result.currency)
 evidence.facts=[['Predicted inflows','inflow_minor'],['Predicted outflows','outflow_minor'],['Predicted net flow','net_minor']].map(([label,key])=>({label,value:days.reduce((n,d)=>n+d[key],0)/scale}))
 evidence.forecast={origin:result.origin,modelRevision:result.modelRevision,dateFrom:days[0].date,dateTo:days.at(-1).date,days:days.length}
 evidence.scheduled_records=result.accounts.flatMap(a=>a.days.filter(d=>d.date>=scope.dateFrom&&d.date<=scope.dateTo).flatMap(d=>d.scheduled.records))
 return evidence
}
