const assert=require('assert/strict'),fs=require('fs'),path=require('path')
module.exports=async({app,window})=>{
 const loaded=new Promise(r=>window.webContents.once('did-finish-load',r)),exec=code=>window.webContents.executeJavaScript(code),pause=()=>new Promise(r=>setTimeout(r,100)),wait=async predicate=>{for(let i=0;i<100;i++){if(await exec(predicate))return;await pause()}throw Error('UI condition failed: '+predicate)},click=text=>exec(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)})?.click()`),timer=setTimeout(()=>app.exit(1),30000)
 try{
  await loaded
  await exec(`(async()=>{const account_id=(await window.api.accounts.getAll())[0].id;window.auditTx=await window.api.transactions.add({account_id,date:'2026-10-01',description:'Synthetic rent',amount:-100,type:'expense',category:'Housing & Rent'})})()`)
  await click('Recurring');await wait(`document.body.innerText.includes('Add manually')`);await click('Add manually');await wait(`!!document.querySelector('[aria-label="Recurring merchant"]')`)
  await exec(`(()=>{const field=document.querySelector('[aria-label="Recurring merchant"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(field,String(window.auditTx.merchant_id));field.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await wait(`Array.from(document.querySelectorAll('label')).some(l=>l.textContent.includes('2026-10-01')&&l.querySelector('input[type=checkbox]'))`)
  await exec(`(()=>{const label=Array.from(document.querySelectorAll('label')).find(l=>l.textContent.includes('2026-10-01')&&l.querySelector('input[type=checkbox]'));label.querySelector('input').click();const field=Array.from(document.querySelectorAll('label')).find(l=>l.textContent.startsWith('Name')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'Synthetic linked rent');field.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  await exec(`(()=>{const field=Array.from(document.querySelectorAll('label')).find(l=>l.textContent.startsWith('Signed expected amount')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'-100');field.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await click('Confirm');await wait(`document.body.innerText.includes('Synthetic linked rent · monthly')`)
  assert.ok(await exec(`(async()=>{return (await window.api.transactions.getAll({id:window.auditTx.id}))[0].recurring_id})()`))
  console.log('Packaged audit UI: merchant selection, past-payment preview, explicit linking and schedule save passed');clearTimeout(timer);app.exit(0)
 }catch(error){console.error(error);console.error(await exec('document.body.innerText'));clearTimeout(timer);app.exit(1)}
}
if(require.main===module){const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync('/private/tmp/openanchor-audit-ui-'),child=require('child_process').spawn(path.join(root,'dist-electron/mac-arm64/OpenAnchor.app/Contents/MacOS/OpenAnchor'),[],{stdio:'inherit',env:{...process.env,OPENANCHOR_TEST_DATA:profile,OPENANCHOR_SMOKE_SCRIPT:__filename}});child.on('error',e=>{console.error(e);process.exitCode=1});child.on('exit',code=>process.exitCode=code??1)}
