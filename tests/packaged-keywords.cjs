const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{spawn}=require('child_process')
module.exports=async({app,window})=>{
 const timer=setTimeout(()=>app.exit(1),30000)
 try{
  await new Promise(resolve=>window.webContents.once('did-finish-load',resolve))
  const result=await window.webContents.executeJavaScript(`(async()=>{const configs=await window.api.categorization.keywords();const category=configs.find(c=>c.category==='Scholarships');const saved=await window.api.categorization.saveKeywords({categoryId:category.category_id,keywords:['Synthetic Foundation']});const accountId=(await window.api.accounts.getAll())[0].id;await window.api.imports.commit({accountId,filename:'synthetic.csv',fileHash:'a'.repeat(64),transactions:[{date:'2026-10-01',description:'Synthetic format check',type:'expense',amount:'-10,25',amount_locale:'de',category:'Shopping'}],balance:{date:'2026-10-01',amount:'-10,25',amount_locale:'de'}});return {config:saved.find(c=>c.category_id===category.category_id),rows:await window.api.transactions.getAll({}),accounts:await window.api.accounts.getAll()}})()`)
  assert.ok(result.config.builtin.includes('stipendium'));assert.deepEqual(result.config.keywords,['Synthetic Foundation']);assert.equal(result.rows[0].amount_minor,-1025);assert.equal(result.accounts[0].balance_minor,-1025);console.log('Packaged app keywords and German edited amount/balance commit passed');clearTimeout(timer);app.exit(0)
 }catch(e){console.error(e);clearTimeout(timer);app.exit(1)}
}
if(require.main===module){const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync('/private/tmp/openanchor-packaged-keywords-'),child=spawn(path.join(root,'dist-electron/mac-arm64/OpenAnchor.app/Contents/MacOS/OpenAnchor'),[],{stdio:'inherit',env:{...process.env,OPENANCHOR_TEST_DATA:profile,OPENANCHOR_SMOKE_SCRIPT:__filename}});child.on('error',e=>{console.error(e);process.exitCode=1});child.on('exit',code=>{process.exitCode=code??1})}
