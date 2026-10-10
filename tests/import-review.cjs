const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{pathToFileURL}=require('url'),DB=require('../electron/database'),D=require('../electron/domain')
module.exports=async()=>{
 const {reviewGroups,applyReviewCategory,pendingAI,reviewAISuggestions}=await import(pathToFileURL(path.resolve(__dirname,'../src/utils/import-review.mjs')))
 const proposed=[{selected:true,type:'expense',recipient:'Shop',description:'Order',amount:-10,category:'Shopping',category_source:'AI suggestion',ai_reviewed:false},{selected:true,type:'expense',recipient:'Shop',description:'Order 2',amount:-12,category:'Utilities',category_source:'AI suggestion',ai_reviewed:false}]
 assert.equal(reviewGroups(proposed).length,2,'Different AI suggestions must remain separate for review')
 assert.equal(pendingAI(proposed[0]),true)
 const accepted=reviewAISuggestions(proposed,[0],true);assert.equal(accepted[0].category_source,'AI suggestion');assert.equal(accepted[0].ai_reviewed,true);assert.equal(reviewGroups(accepted).length,1)
 const rejected=reviewAISuggestions(proposed,[0],false);assert.equal(rejected[0].category,null);assert.equal(rejected[0].ai_suggested_category,'Shopping');assert.equal(pendingAI(rejected[0]),false)
 const corrected=applyReviewCategory(proposed,[0],{name:'Utilities',type:'expense'});assert.equal(corrected[0].ai_suggested_category,'Shopping');assert.equal(corrected[0].category,'Utilities')
 const rows=[{selected:true,type:'expense',recipient:'Stadtwerke',description:'Bill Jan',amount:-50},{selected:true,type:'expense',recipient:'Stadtwerke',description:'Bill Feb',amount:-55},{selected:true,type:'income',sender:'Stadtwerke',description:'Income',amount:20},{selected:true,type:'expense',recipient:'Shop',error:'Bad date'},{selected:false,type:'expense',recipient:'Shop'}]
 const groups=reviewGroups(rows);assert.equal(groups.length,2);assert.deepEqual(groups[0].indices,[0,1])
 const assigned=applyReviewCategory(rows,[0,1,2,3,4],{name:'Utilities',type:'expense'},true);assert.equal(assigned[1].category,'Utilities');assert.equal(assigned[1].category_source,'manual');assert.equal(assigned[2].category,undefined);assert.equal(assigned[3].category,undefined);assert.equal(assigned[4].category,undefined)
 const folder=fs.mkdtempSync('/private/tmp/openanchor-review-'),db=new DB(folder);db.init()
 try{const accountId=db.getAccounts()[0].id
 assert.throws(()=>db.importCommit({accountId,filename:'ai.csv',fileHash:D.hash('unreviewed-ai'),transactions:[{...proposed[0],date:'2026-01-01'}]}),/Accept, change or reject/)
 assert.equal(db.importHistory().length,0,'Rejected AI review must not create an import batch')
 db.importCommit({accountId,filename:'accepted-ai.csv',fileHash:D.hash('accepted-ai'),transactions:[{...accepted[0],date:'2026-01-01'}]})
 assert.equal(db.getCategories().find(c=>c.name==='Investments').type,'both')
 const cat=db.addCategory({name:'ETF purchases',type:'expense'});assert.ok(cat.id)
 db.importCommit({accountId,filename:'group.csv',fileHash:D.hash('groups'),transactions:[{...assigned[0],date:'2026-01-01',category:'Utilities',save_rule:true}]})
 assert.equal(db.suggestCategory({account_id:accountId,type:'expense',recipient:'Stadtwerke',description:'Bill March'}).category,'Utilities')
 const override=db.addTransaction({account_id:accountId,date:'2026-02-01',type:'expense',recipient:'Stadtwerke',description:'One-off',amount:-5,category:'Shopping',category_source:'manual',source:'upload'});assert.equal(override.category,'Shopping')
 const investment=db.addTransaction({account_id:accountId,date:'2026-01-02',description:'ETF',type:'expense',amount:-100,category:'Investments'});assert.equal(investment.category,'Investments')
 assert.equal(db.db.prepare('SELECT MAX(version) v FROM schema_migrations').get().v,4)
 }finally{db.close()}
 console.log('Grouped review, future rules, manual overrides and investment purchases passed')
}
