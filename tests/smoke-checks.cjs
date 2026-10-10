const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{nativeImage}=require('electron')
module.exports=async({app,window,root})=>{
 if(process.env.OPENANCHOR_SMOKE_PYTHON)require('electron').dialog.showOpenDialog=async()=>({canceled:false,filePaths:[process.env.OPENANCHOR_SMOKE_PYTHON]})
 const timeout=setTimeout(()=>{console.error('App smoke timed out');app.exit(1)},300000)
 try{
  await new Promise((resolve,reject)=>{window.webContents.once('did-finish-load',resolve);window.webContents.once('did-fail-load',(_,code,message)=>reject(Error(message)))})
  const errors=[];window.webContents.on('console-message',details=>{if(details.level==='error')errors.push(details.message)})
  assert.equal(window.webContents.getLastWebPreferences().sandbox,true);assert.equal(app.getPath('userData'),process.env.OPENANCHOR_TEST_DATA)
  assert.equal(nativeImage.createFromPath(path.join(root,'assets/icons/openanchor-blue.png')).isEmpty(),false)
  const results=await window.webContents.executeJavaScript(`(async()=>{
   const id=(await window.api.accounts.getAll())[0].id;
   await window.api.transactions.add({account_id:id,date:'2026-10-01',description:'Synthetic salary',amount:3000,type:'income',category:'Salary'});
   await window.api.transactions.add({account_id:id,date:'2026-10-02',description:'Synthetic utility',amount:-42.5,type:'expense',category:'Utilities'});
   await window.api.imports.confirmCoverage({accountId:id,dateFrom:'2026-04-07',dateTo:'2026-10-03'});
   const eligibility=await window.api.forecasting.eligibility({accountId:id});
   const aggregate=await window.api.spending.aggregate({accountId:id,dateFrom:'2026-10-01',dateTo:'2026-10-03',dimension:'merchant'});
   return {id,eligibility,total:aggregate.totals[0].total};
  })()`)
  assert.ok(await window.webContents.executeJavaScript("Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent.trim()==='Categories').querySelector('svg path')!==null"),'Categories navigation icon is missing');
  assert.equal(results.total,42.5);assert.equal(results.eligibility.eligible,true)
  for(const title of ['Transactions','Budgets','Spending','Recurring','Import','Assistant','Categories','Settings','Overview']){
   await window.webContents.executeJavaScript(`document.querySelectorAll('nav button').forEach(b=>{if(b.textContent.trim()==='${title}')b.click()})`)
   await new Promise(r=>setTimeout(r,350));const body=await window.webContents.executeJavaScript('document.body.innerText')
   assert.ok(body.length>50,`Empty screen ${title}`);assert.ok(!body.includes('Untrusted request'),`IPC failure ${title}`)
  }
  assert.ok((await window.webContents.executeJavaScript('document.body.innerText')).includes('Financial health report'))
  assert.ok(!(await window.webContents.executeJavaScript('document.body.innerText')).includes('Forecast starts'))
  if(process.env.OPENANCHOR_SMOKE_FORECAST==='1'){
   const status=await window.webContents.executeJavaScript('window.api.forecasting.setup('+JSON.stringify({useExistingPython:!!process.env.OPENANCHOR_SMOKE_PYTHON})+')');assert.equal(status.installed,true)
   const forecast=await window.webContents.executeJavaScript(`(async()=>{await window.api.settings.set('forecast_horizon','30');await window.api.settings.set('forecast_enabled','true');return await window.api.forecasting.start({accountId:${results.id},horizon:30,requestId:'packaged-synthetic'})})()`)
   assert.equal(forecast.days.length,30);assert.equal(forecast.origin,'2026-10-03');assert.ok(forecast.days.every(d=>d.net_minor===d.inflow_minor-d.outflow_minor));const budget=await window.webContents.executeJavaScript('window.api.planning.get('+results.id+',"2026-10")');assert.equal(budget.forecast_context.days,28);assert.equal(budget.forecast_context.net_minor,forecast.days.filter(d=>d.date.startsWith('2026-10')).reduce((sum,d)=>sum+d.net_minor,0))
   await window.webContents.executeJavaScript("document.querySelectorAll('nav button').forEach(b=>{if(b.textContent.trim()==='Settings')b.click()})");await new Promise(r=>setTimeout(r,200));await window.webContents.executeJavaScript("document.querySelectorAll('nav button').forEach(b=>{if(b.textContent.trim()==='Overview')b.click()})");
   await new Promise(r=>setTimeout(r,800));assert.ok((await window.webContents.executeJavaScript('document.body.innerText')).includes('Forecast starts'))
   await window.webContents.executeJavaScript("window.api.settings.set('forecast_enabled','false')");await new Promise(r=>setTimeout(r,500));assert.ok(!(await window.webContents.executeJavaScript('document.body.innerText')).includes('Forecast starts'));const offBudget=await window.webContents.executeJavaScript('window.api.planning.get('+results.id+',"2026-10")');assert.equal(offBudget.forecast_context,undefined)
  }
  assert.deepEqual(errors,[])
  window.webContents.setBackgroundThrottling(false);window.webContents.invalidate();await window.webContents.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');const snapshot=await window.webContents.executeJavaScript('document.body.innerText');assert.ok(snapshot.includes("3,000"));assert.ok(snapshot.includes("Financial health report"));const image=await window.webContents.capturePage(undefined,{stayAwake:true});fs.writeFileSync(path.resolve(__dirname,path.join(process.env.OPENANCHOR_TEST_DATA,'smoke-overview.png')),image.toPNG())
  console.log(`${app.isPackaged?'Packaged':'Source'} app: sandbox, screens, financial health, native icon${process.env.OPENANCHOR_SMOKE_FORECAST==='1'?', real Chronos worker and forecast visibility':''} passed`)
  clearTimeout(timeout);app.exit(0)
 }catch(error){console.error(error);clearTimeout(timeout);app.exit(1)}
}
