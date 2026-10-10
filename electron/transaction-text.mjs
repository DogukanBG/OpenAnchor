// Derived, inspectable text only: the bank description is never overwritten.
function trimName(value){return value.replace(/^[\s.,;]+|[\s,;]+$/g,'').trim()}
function repairRepeatedName(named,repeated){
 const compact=value=>value.replace(/\s/g,''),plain=compact(named)
 if(!repeated||plain.toLocaleLowerCase()!==compact(repeated).toLocaleLowerCase())return named
 const breaks=value=>{let offset=0;const positions=new Set();for(const character of value){if(/\s/.test(character))positions.add(offset);else offset++}return positions},a=breaks(named),b=breaks(repeated)
 return [...plain].map((character,index)=>(index&&a.has(index)&&b.has(index)?' ':'')+character).join('')
}
export function preprocessTransactionText(value){
 const original=String(value||''),processor=/\bpaypal\b/i.test(original)?'PayPal':null,notes=[]
 let text=original.normalize('NFC').replace(/\u00ad/g,'').replace(/([\p{L}])-\s*\n\s*([\p{L}])/gu,'$1$2').replace(/\s+/g,' ').trim()
 const metadata=/\b(?:End[\s-]*to[\s-]*End[\s-]*(?:Ref(?:erence)?\.?|Referenz)|Mandats(?:ref\.?|referenz)|Gl[äa]ubiger[\s-]*(?:ID|Identifikationsnummer))\s*:/i
 const boundary=text.search(metadata);if(boundary>=0){text=text.slice(0,boundary).trim();notes.push('Separated bank reference metadata')}
 text=text.replace(/\bSEPA[\s-]*(?:BASIS[\s-]*)?LASTSCHRIFT(?:\s+wiederholend)?\b/gi,'').trim()
 let merchant=null
 if(processor){
  // Bank exports can insert spaces inside the fixed German marker, too.
  text=text.replace(/\bI\s*h\s*r\s+E\s*i\s*n\s*k\s*a\s*u\s*f\s+b\s*e\s*i\b/gi,'Ihr Einkauf bei')
  const marker=text.match(/\bIhr Einkauf bei\b/i)
  const explicit=marker?text.slice(marker.index+marker[0].length).match(/^\s*(.*?)(?:,|$)/):null
  const prefix=marker?text.slice(0,marker.index):''
  // Support both reference/PP.7628.PP/. Merchant and reference/. Merchant.
  const repeated=prefix.match(/\/\.\s*(.*?),\s*$/)

  if(explicit){const named=trimName(explicit[1]);if(named&&named.length<=300&&!/^paypal\b/i.test(named)){merchant=repairRepeatedName(named,repeated?trimName(repeated[1]):null);if(merchant!==named)notes.push('Rejoined inconsistent word breaks across repeated merchant mentions');notes.push('Extracted the merchant explicitly named by PayPal')}}
  if(merchant){const purpose=explicit?trimName(text.slice(marker.index+marker[0].length+explicit[0].length)):'';text=merchant+(purpose?' · '+purpose:'')}
  else {if(marker)text='PayPal — merchant unavailable';notes.push('No explicit merchant name; kept separate for review')}

 }
 const cleaned=trimName(text)||original.trim()
 return {display_description:merchant||cleaned,categorization_description:cleaned,merchant_suggestion:merchant,payment_processor:processor,normalization_notes:notes}
}
export function processedMerchantKey(value){const parsed=preprocessTransactionText(value);return parsed.payment_processor&&parsed.merchant_suggestion?`${parsed.payment_processor.toLowerCase()}:${parsed.merchant_suggestion.normalize('NFKC').toLocaleLowerCase('de-DE').replace(/\s+/g,' ').trim()}`:null}
