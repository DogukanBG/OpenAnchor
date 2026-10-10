const fs=require('fs'),path=require('path'),net=require('net'),http=require('http'),{spawn}=require('child_process')
class LocalLlama {
 constructor(db){this.db=db;this.child=null;this.state='stopped';this.error='';this.generation=0}
 binary(){return [this.db.getSetting('llama_binary'),'/opt/homebrew/bin/llama-server','/usr/local/bin/llama-server',...(process.env.PATH||'').split(path.delimiter).map(p=>path.join(p,'llama-server'))].find(p=>{try{return p&&fs.statSync(p).isFile()&&(fs.accessSync(p,fs.constants.X_OK),true)}catch{return false}})||null}
 status(){return {state:this.state,error:this.error,modelPath:this.db.getSetting('llama_model_path')||'',binary:this.binary()}}
 selectModel(file){if(path.extname(file).toLowerCase()!=='.gguf')throw Error('Select a GGUF checkpoint');const fd=fs.openSync(file,'r');try{const magic=Buffer.alloc(4);fs.readSync(fd,magic,0,4,0);if(magic.toString()!=='GGUF')throw Error('This file is not a GGUF checkpoint')}finally{fs.closeSync(fd)}this.db.setSetting('llama_model_path',file);return this.status()}
 stop(){this.generation++;this.child?.kill();this.child=null;this.state='stopped';return this.status()}
 async start(){if(this.state==='starting')throw Error('The model is already loading');this.stop();const generation=this.generation,binary=this.binary(),model=this.db.getSetting('llama_model_path');if(!binary)throw Error('Choose your installed llama-server executable first');if(!model||!fs.existsSync(model))throw Error('Choose an existing GGUF checkpoint first');this.selectModel(model);this.state='starting';this.error=''
  try{
   const port=await new Promise((resolve,reject)=>{const server=net.createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port))})})
   if(generation!==this.generation)throw Error('Model loading cancelled')
   const child=spawn(binary,['-m',model,'--host','127.0.0.1','--port',String(port),'--alias','openanchor-local','-c','8192'],{shell:false,stdio:['ignore','ignore','pipe']});this.child=child
   let failure=null,log='';child.stderr.on('data',d=>{log=(log+d.toString()).slice(-2000)});child.on('error',e=>{failure=e;if(generation===this.generation){this.error=e.message;this.state='failed'}});child.on('exit',code=>{if(this.child===child){this.child=null;failure=Error(`Local model stopped (${code}). ${log}`);this.error=failure.message;this.state='failed'}})
   const deadline=Date.now()+180000
   while(Date.now()<deadline){if(generation!==this.generation)throw Error('Model loading cancelled');if(failure)throw failure
    const ready=await new Promise(resolve=>{const req=http.get(`http://127.0.0.1:${port}/health`,res=>{res.resume();resolve(res.statusCode===200)});req.setTimeout(1000,()=>req.destroy());req.on('error',()=>resolve(false))})
    if(generation!==this.generation)throw Error('Model loading cancelled')
    if(ready){this.db.setSetting('custom_base_url',`http://127.0.0.1:${port}`);this.db.setSetting('ai_provider','custom');for(const purpose of ['extraction','assistant'])this.db.setSetting(`custom_${purpose}_model`,'openanchor-local');this.state='running';return this.status()}
    await new Promise(resolve=>setTimeout(resolve,250))
   }
   throw Error('The model did not finish loading within three minutes')
  }catch(e){if(generation===this.generation){this.child?.kill();this.child=null;this.state='failed';this.error=e.message}throw e}
 }
}
module.exports=LocalLlama
