const assert=require('assert/strict'),extract=require('../electron/pdf-extraction')
module.exports=async()=>{
 const result=await extract(Buffer.from('synthetic'),async(_,options)=>{
  await options.pagerender({pageNumber:2,getTextContent:async()=>{throw Error('Damaged page')}})
  await options.pagerender({pageNumber:1,getTextContent:async()=>({items:[{str:'Opening balance',transform:[0,0,0,0,0,10]},{str:'0.00',transform:[0,0,0,0,0,10]}]})})
  return {numpages:3,text:''}
 })
 assert.equal(result.pages.length,3);assert.match(result.pages[0],/Opening balance 0.00/);assert.equal(result.pages[1],'');assert.deepEqual(result.errors.map(e=>e.page),[2,3]);console.log('PDF failures retain source pages and missing-page evidence')
}
