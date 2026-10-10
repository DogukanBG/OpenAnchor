export function parseHealthSummary(response,evidence){
 const parsed=JSON.parse(response.trim().replace(/^```(?:json)?\s*|```$/g,''))
 if(!Array.isArray(parsed.paragraphs)||!parsed.paragraphs.length||parsed.paragraphs.length>3)throw Error('The report could not be read. Please try again.')
 const facts=new Map(evidence.facts.map(f=>[f.id,f]))
 return parsed.paragraphs.map(p=>{
  if(typeof p.text!=='string'||!p.text.trim()||p.text.length>2000||!Array.isArray(p.fact_ids)||p.fact_ids.some(id=>!facts.has(id)))throw Error('The report used an unsupported fact. Please try again.')
  const qualitative=p.text.replace(/\{\{([a-z_0-9]+)\}\}/g,(_,id)=>{if(!facts.has(id)||!p.fact_ids.includes(id))throw Error('The report used an unsupported number. Please try again.');return ''})
  if(/\p{N}|\{\{|\}\}/u.test(qualitative))throw Error('The report included an unverified number. Please try again.')
  const text=p.text.replace(/\{\{([a-z_0-9]+)\}\}/g,(_,id)=>{const f=facts.get(id);return f.unit==='percent'?new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(f.value)+'%':new Intl.NumberFormat(undefined,{style:'currency',currency:evidence.currency}).format(f.value)})
  return {...p,text}
 })
}
