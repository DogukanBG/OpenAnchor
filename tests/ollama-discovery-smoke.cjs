const assert=require('assert/strict')
module.exports=async({app,window})=>{
 const timer=setTimeout(()=>app.exit(1),20000)
 try{
  await new Promise(resolve=>window.webContents.once('did-finish-load',resolve))
  const run=code=>window.webContents.executeJavaScript(code)
  const names=await run(`window.api.ollama.listModels({provider:'ollama',baseUrl:'http://127.0.0.1:11434'}).then(models=>models.map(m=>m.name))`)
  assert.ok(names.includes('gemma4:latest'));assert.ok(names.includes('qwen3.6:latest'))
  await new Promise(r=>setTimeout(r,500));await run(`Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent.trim()==='Settings').click()`)
  await new Promise(r=>setTimeout(r,1500))
  assert.ok(await run("Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent.trim()==='Categories').querySelector('svg path')!==null"))
  const options=await run(`Array.from(document.querySelectorAll('select option')).map(o=>o.value)`)
  assert.ok(options.includes('gemma4:latest'));assert.ok(options.includes('qwen3.6:latest'))
  console.log('Live Ollama API and Settings selectors both recognize gemma4:latest and qwen3.6:latest')
  clearTimeout(timer);app.exit(0)
 }catch(error){console.error(error);clearTimeout(timer);app.exit(1)}
}
