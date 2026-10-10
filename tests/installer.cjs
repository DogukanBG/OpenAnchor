const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{Runtime,manifest}=require('../electron/forecast/runtime'),D=require('../electron/domain')
async function main(){
 const root=fs.mkdtempSync('/private/tmp/openanchor-installer-'),runtime=new Runtime(root)
 // Reuse already downloaded, hash-verified weights; Python and its environment are fresh.
 fs.symlinkSync(path.resolve(__dirname,'../.forecast-test/model'),runtime.model,'dir')
 let stage;runtime.on('progress',value=>{if(value.stage!==stage){stage=value.stage;console.log('Installer stage:',stage)}})
 try{
  assert.equal(runtime.status().installed,false)
  const status=await runtime.setup();assert.equal(status.installed,true);assert.equal(status.revision,manifest.revision)
  assert.ok(fs.existsSync(path.join(root,'python/bin/python3')))
  const result=await runtime.request({action:'forecast',horizon:30,accounts:[{accountId:1,dates:Array.from({length:180},(_,i)=>D.addDays('2026-01-01',i)),inflow:Array.from({length:180},(_,i)=>i%30===0?300000:0),outflow:Array.from({length:180},(_,i)=>4000+i%7*100)}]})
  assert.equal(result[0].inflow.length,30);assert.equal(result[0].outflow.length,30)
  assert.ok(result[0].outflow.every(day=>Object.values(day).every(Number.isFinite)))
  console.log('Fresh standalone Python download, integrity, extraction, isolated dependency setup and real Chronos inference passed')
  console.log('Synthetic installer profile:',root)
 }finally{runtime.stop()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
