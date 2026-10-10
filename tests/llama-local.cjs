const fs=require('fs'),path=require('path'),assert=require('assert/strict'),LocalLlama=require('../electron/llama-local')
module.exports=async()=>{
 const dir=fs.mkdtempSync('/private/tmp/openanchor-llama-'),model=path.join(dir,'synthetic.gguf'),binary=path.join(dir,'llama-server'),settings=new Map(),db={getSetting:k=>settings.get(k),setSetting:(k,v)=>settings.set(k,v)}
 fs.writeFileSync(model,'GGUF synthetic test fixture')
 fs.writeFileSync(binary,`#!${process.execPath}\nconst http=require('http');const args=process.argv;http.createServer((req,res)=>res.end('{}')).listen(Number(args[args.indexOf('--port')+1]),'127.0.0.1')\n`,{mode:0o755});settings.set('llama_binary',binary)
 const local=new LocalLlama(db)
 try{local.selectModel(model);assert.equal(local.status().modelPath,model);assert.throws(()=>local.selectModel(binary),/GGUF/);assert.equal((await local.start()).state,'running');assert.equal(settings.get('ai_provider'),'custom');assert.equal(settings.get('custom_assistant_model'),'openanchor-local');assert.ok(settings.get('custom_base_url').startsWith('http://127.0.0.1:'));assert.equal(local.stop().state,'stopped');const pending=local.start();local.stop();await assert.rejects(pending,/cancelled/);assert.equal(local.status().state,'stopped')}finally{local.stop()}
 console.log('GGUF selection, isolated local server startup and cancellation passed')
}
