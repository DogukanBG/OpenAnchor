const assert=require('assert/strict'),fs=require('fs'),path=require('path'),DB=require('../electron/database'),Data=require('../electron/data-management')
module.exports=async()=>{
 const {keywordSuggestion,matchGermanKeyword}=await import('../electron/keywords.mjs'),folder=fs.mkdtempSync('/private/tmp/openanchor-keywords-'),db=new DB(folder);db.init()
 try{
 const category=name=>db.getCategories().find(c=>c.name===name),education=category('Education'),shopping=category('Shopping'),scholarships=category('Scholarships')
 assert.ok((await db.categoryKeywords()).find(c=>c.category_id===scholarships.id).builtin.includes('stipendium'))
 await db.saveCategoryKeywords({categoryId:education.id,keywords:['CampusVendor','Müller Förderung','Mueller Foerderung','semesterbeitrag','REWE']})
 let configs=await db.categoryKeywords();assert.deepEqual(configs.find(c=>c.category_id===education.id).keywords,['CampusVendor','Mueller Foerderung','REWE'])
 assert.equal(matchGermanKeyword('REWE1234 Berlin','expense',configs),'Education');assert.equal(matchGermanKeyword('CampusVendor invoice','income',configs),null);assert.equal(matchGermanKeyword('CampusVendorPlus invoice','expense',configs),null)
 await assert.rejects(db.saveCategoryKeywords({categoryId:shopping.id,keywords:['campusvendor']}),/already belongs/)
 for(const keywords of [[''],['---'],['a'.repeat(101)],Array(101).fill('word')])await assert.rejects(db.saveCategoryKeywords({categoryId:education.id,keywords}))
 await assert.rejects(db.saveCategoryKeywords({categoryId:99999,keywords:['Term']}));assert.throws(()=>db.setSetting('category_keywords','{}'),/keyword editor/)
 await db.saveCategoryKeywords({categoryId:scholarships.id,keywords:['CampusVendor']});configs=await db.categoryKeywords();assert.equal(matchGermanKeyword('CampusVendor','income',configs),'Scholarships')
 const tx=db.addTransaction({account_id:db.getAccounts()[0].id,date:'2026-10-01',description:'REWE1234',type:'expense',amount:-10,category:'Shopping'});await db.saveCategoryKeywords({categoryId:education.id,keywords:['CampusVendor','REWE','alpha']});assert.equal(db.getTransactions({id:tx.id})[0].category,'Shopping')
 await db.saveCategoryKeywords({categoryId:shopping.id,keywords:['bravo']});assert.deepEqual(keywordSuggestion('alpha bravo','expense',await db.categoryKeywords()),{category:null,category_source:'conflicting custom keywords'})
 const custom=db.addCategory({name:'Custom keyword category',type:'expense',color:'#2875e8',icon:'📋'});await db.saveCategoryKeywords({categoryId:custom.id,keywords:['UniqueVendor']});assert.equal(db.deleteCategory(custom.id,shopping.id).success,true);assert.ok((await db.categoryKeywords()).find(c=>c.category_id===shopping.id).keywords.includes('UniqueVendor'))
 const backup=path.join(folder,'keywords.db');Data.backup(db,backup);await db.saveCategoryKeywords({categoryId:education.id,keywords:[]});Data.restore(db,backup);assert.ok((await db.categoryKeywords()).find(c=>c.category_id===education.id).keywords.includes('REWE'))
 db.close();db.init();assert.equal(matchGermanKeyword('REWE','expense',await db.categoryKeywords()),'Education')
 console.log('Custom keywords: German normalization, priority, direction, conflicts, validation, persistence, deletion and recovery passed')
 }finally{db.close()}
}
