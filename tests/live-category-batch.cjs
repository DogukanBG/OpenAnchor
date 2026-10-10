const path=require('path'),{pathToFileURL}=require('url'),Providers=require('../electron/providers')
;(async()=>{
 const {categorySchema,parseCategoryResponse}=await import(pathToFileURL(path.resolve(__dirname,'../src/utils/category-response.mjs')))
 const categories=[{name:'Shopping',type:'expense'},{name:'Utilities',type:'expense'},{name:'Other Expense',type:'expense'},{name:'Salary',type:'income'},{name:'Other Income',type:'income'},{name:'Investments',type:'both'}]
 const transactions=Array.from({length:16},(_,i)=>({type:i%4===0?'income':'expense',description:i%4===0?'Synthetic monthly salary':i%4===1?'Synthetic clothing store':i%4===2?'Synthetic electricity bill':'Synthetic ETF purchase'}))
 const client=new Providers({getSetting:k=>k==='ai_provider'?'ollama':'http://127.0.0.1:11434'})
 for(const model of process.argv.slice(2)){
  const prompt='Categorize each synthetic transaction. Return ONLY JSON mapping every index to an allowed category. Available categories: '+categories.map(c=>c.name).join(', ')+'\n'+transactions.map((t,i)=>JSON.stringify({index:i,...t})).join('\n')
  const response=await client.generate({model,prompt,jsonSchema:categorySchema(transactions,categories)}),result=parseCategoryResponse(response,transactions,categories)
  console.log(`${model}: ${Object.keys(result).length}/16 complete compatible categories returned using structured output`)
 }
})().catch(error=>{console.error(error.message);process.exitCode=1})
