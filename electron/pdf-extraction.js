// Preserve page positions and failures; unreadable pages cannot imply full coverage.
module.exports=async function extractPDF(buffer,parse){
  const pages=[],errors=[]
  const data=await parse(buffer,{pagerender:async page=>{
    const index=Number.isInteger(page.pageNumber)?page.pageNumber-1:pages.length
    pages[index]=''
    try{
      const content=await page.getTextContent();let text='',lastY=null
      for(const item of content.items){const y=item.transform?.[5];if(lastY!==null&&Math.abs(y-lastY)>2)text+='\n';text+=item.str+' ';lastY=y}
      pages[index]=text
      if(!text.trim())errors.push({page:index+1,error:'No readable text; OCR is not supported'})
      return text
    }catch(error){errors.push({page:index+1,error:error.message});return ''}
  }})
  for(let i=0;i<data.numpages;i++)if(pages[i]===undefined){pages[i]='';errors.push({page:i+1,error:'Page text was not extracted'})}
  return {pages,pageCount:data.numpages,errors}
}
