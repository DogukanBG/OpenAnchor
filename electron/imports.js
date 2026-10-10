const {parse}=require('csv-parse/sync')
const D=require('./domain')
function parseDate(value, format) {
  const text=String(value||'').trim()
  if(format==='iso')return D.date(text)
  const match=text.match(format==='dmy'?/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/:/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  D.assert(match,'Date does not match the selected format')
  return D.date(`${match[3]}-${String(match[format==='mdy'?1:2]).padStart(2,'0')}-${String(match[format==='mdy'?2:1]).padStart(2,'0')}`)
}
function csv(text,{decimal='de',dateFormat='dmy',delimiter=';',currency='EUR'}={}) {
  D.assert(['de','en'].includes(decimal)&&['dmy','mdy','iso'].includes(dateFormat)&&[';',',','\t'].includes(delimiter),'Invalid CSV format')
  const records=parse(text,{bom:true,delimiter,skip_empty_lines:true,relax_column_count:true,info:true})
  D.assert(records.length>1,'CSV needs a header and at least one row')
  const headers=records.shift().record.map(D.normalized)
  const find=names=>headers.findIndex(h=>names.includes(h))
  const dateIndex=find(['date','datum','buchungstag','buchungsdatum']),amountIndex=find(['amount','betrag','umsatz']),descriptionIndex=find(['description','beschreibung','buchungstext','verwendungszweck','text']),counterpartyIndex=find(['iban','counterparty','gegenkonto']),currencyIndex=find(['currency','währung','waehrung'])
  const senderIndex=find(['sender']),recipientIndex=find(['empfänger','empfaenger']),purposeIndex=find(['verwendungszweck'])
  const cell=(record,index)=>index>=0?record[index].trim():''
  D.assert(dateIndex>=0&&amountIndex>=0&&descriptionIndex>=0,'CSV requires date, amount and description columns')
  const transactions=[],errors=[];let balance=null,opening=null
  for(const {record,info} of records) {
    try {
      D.assert(record.length===headers.length,'Column count differs from header')
      if(currencyIndex>=0)D.assert(record[currencyIndex].trim()===currency,'Row currency differs from the selected account')
      const date=parseDate(record[dateIndex],dateFormat),amount_minor=D.minor(record[amountIndex],currency,decimal)
      const bookingText=cell(record,descriptionIndex),sender=cell(record,senderIndex),recipient=cell(record,recipientIndex),purpose=cell(record,purposeIndex)
      const description=[...new Set([bookingText,amount_minor<0?recipient:sender,purpose].filter(Boolean))].join(' · ')
      D.assert(description,'Description is required')
      if(/^(closing balance|kontostand|neuer saldo|endsaldo)$/i.test(bookingText)){balance={amount:D.major(amount_minor,currency),date};continue}
      if(/^(opening balance|anfangssaldo|alter kontostand)$/i.test(bookingText)){opening={amount:D.major(amount_minor,currency),date};continue}
      transactions.push({date,description,currency,amount_minor,amount:D.major(amount_minor,currency),type:amount_minor<0?'expense':'income',counterparty:cell(record,counterpartyIndex)||null,sender,recipient,purpose,raw_columns:Object.fromEntries(headers.map((header,index)=>[header,record[index]])),source_page:1,source_row:info.lines,category:null,selected:true})
    } catch(error){errors.push({row:info.lines,error:error.message,original:record})}
  }
  return {transactions,errors,balance,opening}
}
function reconciliation(input,currency) {
  if(!input.opening||!input.balance)return {available:false}
  const opening=D.minor(input.opening.amount,currency,input.opening.amount_locale||'en'),closing=D.minor(input.balance.amount,currency,input.balance.amount_locale||'en')
  D.date(input.opening.date);D.date(input.balance.date)
  const movement=input.transactions.filter(t=>t.date>input.opening.date&&t.date<=input.balance.date).reduce((sum,t)=>sum+(t.amount_minor??D.minor(t.amount,currency,t.amount_locale||'en')),0)
  return {available:true,opening_minor:opening,closing_minor:closing,movement_minor:movement,difference_minor:closing-opening-movement,reconciled:closing===opening+movement}
}
module.exports={csv,parseDate,reconciliation}
