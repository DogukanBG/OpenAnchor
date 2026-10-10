const {app,BrowserWindow}=require('electron'),fs=require('fs'),assert=require('assert/strict')
process.env.OPENANCHOR_TEST_DATA=fs.mkdtempSync('/private/tmp/openanchor-health-ui-');require('../electron/main')
app.whenReady().then(async()=>{
 const window=BrowserWindow.getAllWindows()[0],timer=setTimeout(()=>app.exit(1),30000),exec=code=>window.webContents.executeJavaScript(code),pause=()=>new Promise(r=>setTimeout(r,500))
 try{
 await new Promise(resolve=>window.webContents.once('did-finish-load',resolve));await pause()
 await exec(`(async()=>{const accountId=(await window.api.accounts.getAll())[0].id;await window.api.transactions.add({account_id:accountId,date:'2026-09-03',description:'September synthetic',amount:-75,type:'expense',category:'Shopping'});await window.api.transactions.add({account_id:accountId,date:'2026-10-01',description:'October synthetic',amount:-10,type:'expense',category:'Shopping'})})()`);await pause()
 assert.equal(await exec(`document.querySelector('[aria-label="Financial health period"]').value`),'month')
 await exec(`const periodInput=document.querySelector('[aria-label="Financial health period"]');periodInput.value='custom';periodInput.dispatchEvent(new Event('change',{bubbles:true}))`);await pause()
 await exec(`(()=>{for(const [label,value] of [['Financial health from date','2026-09-01'],['Financial health through date','2026-09-30']]){const input=document.querySelector('[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))}})()`);await pause();await pause()
 const report=await exec(`Array.from(document.querySelectorAll('section')).find(s=>s.textContent.includes('Financial health report')).innerText`);assert.ok(report.includes('2026-09-01 – 2026-09-30'));assert.ok(report.includes('75'))
 await exec(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Inspect supporting records')).click()`);await pause();const records=await exec(`Array.from(document.querySelectorAll('section')).find(s=>s.textContent.includes('Financial health report')).innerText`);assert.ok(records.includes('September synthetic'));assert.ok(!records.includes('October synthetic'))
 await exec(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Spending').click()`);await pause();await exec(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Overview').click()`);await pause();assert.equal(await exec(`document.querySelector('[aria-label="Financial health period"]').value`),'custom');assert.equal(await exec(`document.querySelector('[aria-label="Financial health from date"]').value`),'2026-09-01')
 await exec(`const allPeriod=document.querySelector('[aria-label="Financial health period"]');allPeriod.value='all';allPeriod.dispatchEvent(new Event('change',{bubbles:true}))`);await pause();const all=await exec(`Array.from(document.querySelectorAll('section')).find(s=>s.textContent.includes('Financial health report')).innerText`);assert.ok(all.includes('2026-09-03'));assert.ok(all.includes('85'))
 console.log('Financial health custom periods, scoped records, all-time boundaries and remembered choice passed');clearTimeout(timer);app.exit(0)
 }catch(e){console.error(e);clearTimeout(timer);app.exit(1)}
})
