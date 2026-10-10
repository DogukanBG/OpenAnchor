import {preprocessTransactionText} from './transaction-text.mjs'
const normalize=value=>String(value||'').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g,' ')
export const pendingAI=row=>row.category_source==='AI suggestion'&&row.ai_reviewed!==true
export function reviewAISuggestions(rows,indices,accept){const selected=new Set(indices);return rows.map((row,index)=>selected.has(index)&&row.selected&&!row.error&&pendingAI(row)?{...row,ai_reviewed:accept,ai_suggested_category:row.ai_suggested_category||row.category,...(accept?{}:{category:null,category_source:'review',save_rule:false})}:row)}
export function reviewGroups(rows){const groups=new Map();rows.forEach((row,index)=>{
 if(!row.selected||(row.category&&!pendingAI(row))||row.error)return
 const parsed=preprocessTransactionText(row.description),unknown=parsed.payment_processor&&!parsed.merchant_suggestion
 const party=parsed.payment_processor?(parsed.merchant_suggestion||`unknown-paypal-row:${index}`):row.counterparty||(row.type==='expense'?row.recipient:row.sender)||row.description
 const suggestion=pendingAI(row)?row.category:null
 const key=JSON.stringify([row.type,normalize(party),suggestion])
 if(!groups.has(key))groups.set(key,{key,label:parsed.payment_processor?parsed.display_description:(row.type==='expense'?row.recipient:row.sender)||parsed.display_description,unknown_merchant:!!unknown,type:row.type,suggestion,indices:[],total:0})
 const group=groups.get(key);group.indices.push(index);group.total+=Number(row.amount)||0
 });return [...groups.values()].sort((a,b)=>b.indices.length-a.indices.length)}
export function applyReviewCategory(rows,indices,category,saveRule=false){const selected=new Set(indices);return rows.map((row,index)=>selected.has(index)&&row.selected&&!row.error&&(category.type==='both'||category.type===row.type)?{...row,ai_suggested_category:row.ai_suggested_category||(pendingAI(row)?row.category:undefined),ai_reviewed:true,category:category.name,category_source:'manual',save_rule:saveRule&&!(preprocessTransactionText(row.description).payment_processor&&!preprocessTransactionText(row.description).merchant_suggestion)}:row)}
