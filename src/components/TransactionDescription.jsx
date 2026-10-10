import React,{useLayoutEffect,useRef} from 'react'
export default function TransactionDescription({value,onChange,label='Transaction description'}){
 const ref=useRef(null)
 useLayoutEffect(()=>{
  const element=ref.current;if(!element)return
  let width=element.clientWidth
  const fit=()=>{element.style.height='auto';element.style.height=`${element.scrollHeight+2}px`}
  fit();const observer=new ResizeObserver(()=>{if(element.clientWidth!==width){width=element.clientWidth;fit()}});observer.observe(element)
  return()=>observer.disconnect()
 },[value])
 return <textarea ref={ref} aria-label={label} className="input w-full min-h-20 whitespace-pre-wrap [overflow-wrap:anywhere] resize-none" style={{overflow:'hidden'}} rows={2} value={value||''} onChange={onChange}/>
}
