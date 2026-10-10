const fs=require('fs'),path=require('path'),assert=require('assert/strict')
module.exports=async({app,window})=>{
 const profile=process.env.OPENANCHOR_TEST_DATA,file=path.join(profile,'synthetic-paypal.csv'),loaded=new Promise(resolve=>window.webContents.once('did-finish-load',resolve))
 const bodies=['/PP.7628.PP/. Demo C afe GmbH, Ihr Einkauf bei Demo Cafe GmbH','/. Demo Ride, Ihr Einkauf b ei Demo Ride','/PP.7628.PP/. , Ihr Ei nkauf bei','/PP.7628.PP/. , Ihr Ei nkauf bei','/. Demo Ride, Ihr Einkauf b ei Demo Ride','/PP.7628.PP/. Demo  Sport GmbH, Ihr Einkauf bei Demo Sp ort GmbH']
 const descriptions=bodies.map((body,i)=>`PayPal Europe S.a.r.l. et Cie S.C.A ${1000000000000+i}${body} End-to-End-Ref.: SYNTHETIC_${i} Mandatsref: SYNTHETIC_MANDATE Gläubiger-ID: SYNTHETIC_PAYPAL SEPA-BASISLASTSCHRIFT wiederholend`)
 fs.writeFileSync(file,'Buchungstag;Buchungstext;Betrag;Empfänger;IBAN\n'+descriptions.map((description,i)=>`0${i+1}.10.2026;${description};-10,00;PayPal Europe;SHARED_PAYPAL`).join('\n'))
 require('electron').dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})
 const timer=setTimeout(()=>{console.error('PayPal UI regression timed out');app.exit(1)},30000),exec=code=>window.webContents.executeJavaScript(code),pause=()=>new Promise(r=>setTimeout(r,400)),click=text=>exec(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)})?.click()`)
 try{
  await loaded;await pause();await click('Import');await pause();await click('Choose CSV, PDF or TXT');await pause()
  await exec(`(()=>{const checkbox=Array.from(document.querySelectorAll('label')).find(l=>l.textContent.includes('Use AI for unresolved')).querySelector('input');if(checkbox.checked)checkbox.click()})()`)
  await click('Extract for review');await pause();await pause()
  const body=await exec('document.body.innerText');assert.ok(body.includes('Demo Cafe GmbH'));assert.ok(body.includes('Demo Sport GmbH'));assert.ok(!body.includes('SYNTHETIC_'))
  const groups=await exec(`Array.from(document.querySelectorAll('.oa-review-group-heading')).map(heading=>({name:heading.querySelector('.oa-review-group-name').textContent,meta:heading.querySelector('.oa-review-group-meta').textContent,rememberDisabled:heading.parentElement.querySelector('input[type=checkbox]').disabled}))`)
  assert.equal(groups.find(g=>g.name==='Demo Ride').meta.startsWith('2 records'),true)
  const unknown=groups.filter(g=>g.name==='PayPal — merchant unavailable');assert.equal(unknown.length,2);assert.ok(unknown.every(g=>g.meta.startsWith('1 records')&&g.rememberDisabled))
  await exec(`document.querySelector('[aria-label="Show original description for Demo Sport GmbH"]').click()`);await pause()
  assert.equal(await exec(`document.querySelector('textarea[aria-label="Transaction description 6"]').value`),descriptions[5]+' · PayPal Europe')
  console.log('Packaged PayPal review: split-word merchants, Demo Ride grouping, separate missing merchants, future-rule guard and untouched original passed')
  clearTimeout(timer);app.exit(0)
 }catch(e){console.error(e);console.error(await exec('document.body.innerText'));clearTimeout(timer);app.exit(1)}
}
if(require.main===module){const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync('/private/tmp/openanchor-paypal-review-'),child=require('child_process').spawn(path.join(root,'dist-electron/mac-arm64/OpenAnchor.app/Contents/MacOS/OpenAnchor'),[],{stdio:'inherit',env:{...process.env,OPENANCHOR_TEST_DATA:profile,OPENANCHOR_SMOKE_SCRIPT:__filename}});child.on('error',e=>{console.error(e);process.exitCode=1});child.on('exit',code=>process.exitCode=code??1)}
