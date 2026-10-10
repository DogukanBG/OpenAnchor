const assert=require('assert/strict'),path=require('path'),{pathToFileURL}=require('url')
module.exports=async()=>{
 const {categorySchema,parseCategoryResponse}=await import(pathToFileURL(path.resolve(__dirname,'../src/utils/category-response.mjs')))
 const transactions=[{type:'expense'},{type:'income'}],categories=[{name:'Shopping',type:'expense'},{name:'Salary',type:'income'},{name:'Investments',type:'both'}]
 const schema=categorySchema(transactions,categories);assert.deepEqual(schema.required,['0','1']);assert.deepEqual(schema.properties['0'].enum,['Shopping','Investments'])
 const valid='{"0":"Shopping","1":"Salary"}'
 assert.equal(parseCategoryResponse(valid,transactions,categories)['1'],'Salary')
 assert.equal(parseCategoryResponse('<think>{"wrong":"reasoning"}</think>\n```json\n'+valid+'\n```',transactions,categories)['0'],'Shopping')
 assert.throws(()=>parseCategoryResponse('{"0":"Salary","1":"Salary"}',transactions,categories),/compatible/)
 assert.throws(()=>parseCategoryResponse('{"0":"Shopping"}',transactions,categories),/complete/)
 assert.throws(()=>parseCategoryResponse('No JSON response',transactions,categories),/JSON/)
 assert.throws(()=>parseCategoryResponse('{"0":"Shopping","1":"Invented"}',transactions,categories),/compatible/)
 console.log('Strict category schema, reasoning/fence handling and response validation passed')
}
