export const healthPeriods=[['dashboard','Dashboard dates'],['month','This month'],['lastMonth','Last month'],['30','Last 30 days'],['90','Last 90 days'],['180','Last 180 days'],['year','This year'],['all','All time'],['custom','Custom dates']]
export function healthRange(period,today,dashboard,custom){
 const day=new Date(today+'T12:00:00Z'),format=d=>d.toISOString().slice(0,10),from=new Date(day)
 if(period==='dashboard')return {dateFrom:dashboard.dateFrom,dateTo:dashboard.dateTo}
 if(period==='custom')return custom
 if(period==='all')return {dateFrom:'1900-01-01',dateTo:today}
 if(period==='lastMonth')return {dateFrom:format(new Date(Date.UTC(day.getUTCFullYear(),day.getUTCMonth()-1,1,12))),dateTo:format(new Date(Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),0,12)))}
 if(period==='month')from.setUTCDate(1)
 else if(period==='year'){from.setUTCMonth(0,1)}
 else if(['30','90','180'].includes(period))from.setUTCDate(from.getUTCDate()-Number(period)+1)
 else throw Error('Invalid report period')
 return {dateFrom:format(from),dateTo:today}
}
