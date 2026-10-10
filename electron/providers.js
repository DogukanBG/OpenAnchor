const http=require('http'),https=require('https'),{StringDecoder}=require('string_decoder'),D=require('./domain')
class Providers {
 constructor(db,override=null){this.db=db;this.override=override;this.active=new Map()}
 config(){const provider=this.override?.provider||this.db.getSetting('ai_provider')||'ollama';D.assert(['custom','ollama'].includes(provider),'Invalid provider');const base=new URL(this.override?.baseUrl||this.db.getSetting(provider==='custom'?'custom_base_url':'ollama_url')||(provider==='custom'?'http://127.0.0.1:8080':'http://127.0.0.1:11434'));D.assert(['http:','https:'].includes(base.protocol)&&!base.username&&!base.password&&!base.search&&!base.hash,'Invalid AI provider URL');return {provider,base}}
 endpoint(config,endpoint){const url=new URL(config.base);let prefix=url.pathname.replace(/\/$/,'');if(prefix.endsWith('/v1')&&endpoint.startsWith('/v1/'))endpoint=endpoint.slice(3);url.pathname=prefix+endpoint;return url}
 request(endpoint,body,{requestId=require('crypto').randomUUID(),stream=false,onToken=()=>{},timeout=180000}={}){
  const config=this.config(),url=this.endpoint(config,endpoint),custom=config.provider==='custom';D.assert(!this.active.has(requestId),'Request already active')
  return new Promise((resolve,reject)=>{let result='',buffer='',size=0,finished=false;const decoder=new StringDecoder('utf8');const finish=(error,value)=>{if(finished)return;finished=true;clearTimeout(deadline);this.active.delete(requestId);error?reject(error):resolve(value)}
   const parseLine=line=>{if(!line.trim())return;if(custom){if(line.startsWith(':')||line.startsWith('event:'))return;if(!line.startsWith('data:'))return;line=line.slice(5).trim();if(line==='[DONE]')return}const parsed=JSON.parse(line);if(parsed.error)throw Error(typeof parsed.error==='string'?parsed.error:parsed.error.message||'Provider error');const token=custom?parsed.choices?.[0]?.delta?.content:parsed.message?.content;if(token){result+=token;onToken(token,requestId)}}
   const req=(url.protocol==='https:'?https:http).request(url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'}},res=>{if(res.statusCode<200||res.statusCode>=300){res.resume();finish(Error(`AI provider returned HTTP ${res.statusCode}`));return}
    res.on('data',chunk=>{try{size+=chunk.length;D.assert(size<32*1024*1024,'Provider response exceeds limit');buffer+=decoder.write(chunk);if(stream){let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end).replace(/\r$/,'');buffer=buffer.slice(end+1);parseLine(line)}}}catch(e){req.destroy();finish(e)}})
    res.on('end',()=>{try{buffer+=decoder.end();if(stream){if(buffer.trim())parseLine(buffer);finish(null,result)}else{const data=JSON.parse(buffer);D.assert(!data.error,'AI provider error');finish(null,data)}}catch(e){finish(e)}});res.on('error',finish);res.on('aborted',()=>finish(Error('Provider connection interrupted')))
   });const deadline=setTimeout(()=>req.destroy(Error('AI request timed out')),timeout);req.setTimeout(60000,()=>req.destroy(Error('AI provider stopped responding')));this.active.set(requestId,req);req.on('error',finish);req.end(body?JSON.stringify(body):undefined)
  })
 }
 async models(){const custom=this.config().provider==='custom',data=await this.request(custom?'/v1/models':'/api/tags',undefined,{timeout:10000});return custom?(data.data||[]).filter(m=>typeof m.id==='string').map(m=>({name:m.id})):(data.models||[])}
 async running(){try{await this.models();return true}catch{return false}}
 async generate({model,prompt,system,requestId,jsonSchema}){
  D.assert(typeof prompt==='string'&&prompt.length<=500000,'Invalid prompt')
  if(jsonSchema)D.assert(typeof jsonSchema==='object'&&!Array.isArray(jsonSchema)&&JSON.stringify(jsonSchema).length<=50000,'Invalid JSON schema')
  const custom=this.config().provider==='custom',body=custom?{model:model||'local-model',messages:[...(system?[{role:'system',content:system}]:[]),{role:'user',content:prompt}],stream:false,temperature:0.1,...(jsonSchema?{response_format:{type:'json_object',schema:jsonSchema},max_tokens:4096}:{})}:{model,prompt,system:system||'',stream:false,options:{temperature:0.1,num_predict:4096},...(jsonSchema?{format:jsonSchema,think:false}:{})}
  const data=await this.request(custom?'/v1/chat/completions':'/api/generate',body,{requestId})
  if(jsonSchema)D.assert(custom?data.choices?.[0]?.finish_reason!=='length':data.done_reason!=='length','AI response was truncated before completing the JSON')
  const result=custom?data.choices?.[0]?.message?.content:data.response
  D.assert(typeof result==='string'&&result.trim(),'AI provider returned no final response')
  return result
 }
 chat({model,messages,system,requestId},onToken){D.assert(Array.isArray(messages)&&messages.length<=200&&messages.every(m=>['user','assistant','system'].includes(m.role)&&typeof m.content==='string'),'Invalid messages');const custom=this.config().provider==='custom';return this.request(custom?'/v1/chat/completions':'/api/chat',{model:model||'local-model',messages:[...(system?[{role:'system',content:system}]:[]),...messages],stream:true,...(custom?{temperature:0.2}:{options:{temperature:0.2,num_predict:2048}})},{stream:true,requestId,onToken})}
 cancel(id){if(id){this.active.get(id)?.destroy(Error('Cancelled'))}else for(const req of this.active.values())req.destroy(Error('Cancelled'))}
}
module.exports=Providers
