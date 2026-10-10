const assert=require('assert/strict'),fs=require('fs'),DB=require('../electron/database')
module.exports=async()=>{
 const {preprocessTransactionText:parse,processedMerchantKey:key}=await import('../electron/transaction-text.mjs'),{matchGermanKeyword}=await import('../electron/keywords.mjs')
 const original='PayPal Europe S.a.r.l. et Cie S.C.A 1000000000100/PP.7628.PP/. Demo Deut sche Bahn, Ihr Einkauf bei Demo Deutsche B ahn End-to-End-Ref.: 1000000000100 Mandatsref: SYNTHETIC_MANDATE Gläubiger-ID: SYNTHETIC_CREDITOR SEPA-BASISLASTSCHRIFT wiederholend'
 assert.equal(parse(original).display_description,'Demo Deutsche Bahn');assert.equal(matchGermanKeyword(parse(original).categorization_description,'expense'),'Transport')
 for(const merchant of ['Netflix.com','Lieferando','REWE Online','Acme Handmade Studio','Foo Bar GmbH']){const raw=`PayPal Europe 123/PP.123.PP/. ${merchant}, Ihr Einkauf bei ${merchant} End-to-End-Ref.: 123`;assert.equal(parse(raw).merchant_suggestion,merchant);assert.ok(!parse(raw).categorization_description.includes('End-to-End'));assert.ok(!parse(raw).display_description.includes('Demo Deutsche Bahn'))}
 assert.equal(parse('PayPal Überweisung an Freunde End-to-End-Ref.: XYZ').merchant_suggestion,null);assert.equal(parse('PAYPAL Lastschrift').merchant_suggestion,null);assert.equal(parse('PayPal Ihr Einkauf bei Acme GmbH, Stromabschlag End-to-End-Ref.: XYZ').categorization_description,'Acme GmbH · Stromabschlag');assert.equal(key('PayPal Ihr Einkauf bei Netflix'),key('PayPal Ihr Einkauf bei Netflix End-to-End-Ref.: different'));assert.notEqual(key('PayPal Ihr Einkauf bei Netflix'),key('PayPal Ihr Einkauf bei REWE'))
 assert.equal(parse('REWE 123 End-to-End-Ref.: NETFLIX').categorization_description,'REWE 123');assert.equal(parse('Acme Hand-\nmade Studio').display_description,'Acme Handmade Studio')
 const paypal=(reference,body)=>`PayPal Europe S.a.r.l. et Cie S.C.A ${reference}${body} End-to-End-Ref.: ${reference} Mandatsref: SYNTHETIC_MANDATE Gläubiger-ID: SYNTHETIC_CREDITOR SEPA-BASISLASTSCHRIFT wiederholend`
 const examples=[
 paypal('1000000000001','/PP.7628.PP/. Demo C afe GmbH, Ihr Einkauf bei Demo Cafe GmbH'),
 paypal('1000000000002','/. Demo Ride, Ihr Einkauf b ei Demo Ride'),
 paypal('1000000000003','/PP.7628.PP/. , Ihr Ei nkauf bei'),
 paypal('1000000000004','/PP.7628.PP/. , Ihr Ei nkauf bei'),
 paypal('1000000000005','/. Demo Ride, Ihr Einkauf b ei Demo Ride'),
 paypal('1000000000006','/PP.7628.PP/. Demo  Sport GmbH, Ihr Einkauf bei Demo Sp ort GmbH')]
 assert.deepEqual(examples.map(raw=>parse(raw).merchant_suggestion),['Demo Cafe GmbH','Demo Ride',null,null,'Demo Ride','Demo Sport GmbH'])
 const {reviewGroups,applyReviewCategory}=await import('../src/utils/import-review.mjs')
 const reviewRows=examples.map(description=>({description,type:'expense',amount:-10,selected:true,counterparty:'LU_SHARED_PAYPAL',recipient:'PayPal Europe'}))
 const review=reviewGroups(reviewRows);assert.equal(review.length,5);assert.deepEqual(review.find(g=>g.label==='Demo Ride').indices,[1,4]);assert.equal(review.filter(g=>g.unknown_merchant).length,2)
 assert.equal(applyReviewCategory(reviewRows,[2],{name:'Shopping',type:'expense'},true)[2].save_rule,false)
 const db=new DB(fs.mkdtempSync('/private/tmp/openanchor-text-'));db.init();try{const account_id=db.getAccounts()[0].id,a=db.addTransaction({account_id,date:'2026-10-01',description:original,amount:-10,type:'expense',category:'Transport'}),b=db.addTransaction({account_id,date:'2026-10-02',description:original.replaceAll('1000000000100','999999999'),amount:-20,type:'expense',category:'Transport'});const other=db.addTransaction({account_id,date:'2026-10-03',description:'PayPal Europe 111/PP.123.PP/. Netflix, Ihr Einkauf bei Netflix End-to-End-Ref.: 111',amount:-5,type:'expense',category:'Entertainment'});assert.equal(db.getTransactions({id:a.id})[0].description,original);const spending=db.spending({accountId:account_id,dimension:'merchant'});assert.equal(spending.rows.length,2);const group=spending.rows.find(r=>r.name==='Demo Deutsche Bahn');assert.equal(group.total_minor,3000);assert.equal(group.count,2);const details=db.getTransactions({accountId:account_id,processedMerchant:group.processed_merchant});assert.deepEqual(new Set(details.map(r=>r.id)),new Set([a.id,b.id]));assert.ok(!details.some(r=>r.id===other.id));db.correctCategory({id:a.id,category:'Transport',mode:'future'});assert.equal(db.suggestCategory({account_id,date:'2026-10-04',description:original.replaceAll('1000000000100','888888'),amount:-10,type:'expense'}).category,'Transport');assert.notEqual(db.suggestCategory({account_id,description:'PayPal Ihr Einkauf bei Netflix',type:'expense'})?.category,'Transport')
 const saved=reviewRows.map((row,i)=>db.addTransaction({...row,account_id,date:`2026-09-${String(i+1).padStart(2,'0')}`,category:i===0?'Restaurants':'Transport',category_source:'manual'}))
 assert.notEqual(saved[0].merchant_id,saved[1].merchant_id);assert.equal(saved[1].merchant_id,saved[4].merchant_id);assert.notEqual(saved[2].merchant_id,saved[3].merchant_id)
 // Simulate an old ledger whose merchant and rule used the shared PayPal identifier.
 const shared=db.db.prepare('INSERT INTO merchants(name,identity,category_id) VALUES (?,?,?)').run('PayPal Europe','legacy-shared-paypal',db.category('Restaurants').id).lastInsertRowid
 for(const tx of saved)db.db.prepare('UPDATE transactions SET merchant_id=? WHERE id=?').run(shared,tx.id)
 db.db.prepare('INSERT INTO category_rules(account_id,identity,type,category_id) VALUES (?,?,?,?)').run(account_id,'counterparty:'+require('../electron/domain').normalized('LU_SHARED_PAYPAL'),'expense',db.category('Restaurants').id)
 assert.equal(db.suggestCategory({...reviewRows[1],account_id,merchant_id:shared}).category,'Transport')
 assert.equal(db.suggestCategory({...reviewRows[2],account_id,merchant_id:shared}),null)
 assert.deepEqual(new Set(db.correctionPreview({id:saved[1].id}).map(t=>t.id)),new Set([saved[1].id,saved[4].id]))
 assert.deepEqual(db.correctionPreview({id:saved[2].id}).map(t=>t.id),[saved[2].id])
 assert.throws(()=>db.correctCategory({id:saved[2].id,category:'Shopping',mode:'future'}),/Identify the PayPal merchant/)
 const clustered=db.spending({accountId:account_id,dimension:'merchant',dateFrom:'2026-09-01',dateTo:'2026-09-30'});assert.equal(clustered.rows.length,5);assert.equal(clustered.rows.find(r=>r.name==='Demo Ride').count,2);assert.equal(clustered.rows.filter(r=>r.transaction_id).length,2)
 assert.equal(clustered.totals[0].amount_minor,6000);for(const row of clustered.rows){const detail=db.getTransactions({accountId:account_id,...(row.transaction_id?{id:row.transaction_id}:{processedMerchant:row.processed_merchant})});assert.equal(detail.reduce((sum,t)=>sum-t.amount_minor,0),row.total_minor)}
 for(let i=0;i<saved.length;i++)assert.equal(db.getTransactions({id:saved[i].id})[0].description,examples[i])
 }finally{db.close()}
 console.log('Generic PayPal merchant extraction, repeated word-break repair, raw preservation, exact merchant grouping and scoped rules passed')
}
