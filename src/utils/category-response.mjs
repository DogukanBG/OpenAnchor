export function categorySchema(transactions,categories){
 const properties=Object.fromEntries(transactions.map((tx,index)=>[String(index),{type:'string',enum:categories.filter(c=>c.type===tx.type||c.type==='both').map(c=>c.name)}]))
 if(Object.values(properties).some(p=>!p.enum.length))throw Error('No compatible categories are available')
 return {type:'object',properties,required:Object.keys(properties),additionalProperties:false}
}
export function parseCategoryResponse(response,transactions,categories){
 const text=String(response||'').replace(/<think>[\s\S]*?<\/think>/gi,'').trim()
 const valid=result=>result&&typeof result==='object'&&!Array.isArray(result)&&Object.keys(result).length===transactions.length&&transactions.every((tx,i)=>categories.some(c=>c.name===result[String(i)]&&(c.type===tx.type||c.type==='both')))
 try{const result=JSON.parse(text);if(valid(result))return result}catch{}
 // Accept a complete JSON object inside a fenced/prose reply; never repair values.
 for(let start=0;start<text.length;start++){if(text[start]!=='{')continue;let depth=0,string=false,escape=false
  for(let end=start;end<text.length;end++){const c=text[end];if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false;continue}if(c==='"')string=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){try{const result=JSON.parse(text.slice(start,end+1));if(valid(result))return result}catch{}break}}
 }
 throw Error('The model did not return complete, compatible category JSON')
}
