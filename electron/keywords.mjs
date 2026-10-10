// Germany-oriented signals. Payment methods (SEPA, PayPal, card payments) are
// intentionally not categories: they say nothing about the purchase purpose.
const rules=[
 ['Scholarships','income',['stipendium','stipendien','stipendienzahlung','deutschlandstipendium','erasmus stipendium','erasmus foerderung','daad','studienstiftung','begabtenfoerderung','promotionsstipendium','forschungsstipendium']],
 ['Salary','income',['gehalt','gehaltszahlung','gehaltseingang','gehaltsgutschrift','nettogehalt','lohn','lohnzahlung','monatslohn','nettolohn','besoldung','bezuege','ausbildungsverguetung']],
 ['Freelance','income',['honorar','honorarzahlung','freiberuflich','provisionszahlung','beratungshonorar']],
 ['Investments','both',['dividende','dividenden','dividendengutschrift','zinsen','zinsgutschrift','kapitalertrag','wertpapier','wertpapierkauf','wertpapierabrechnung','aktienkauf','etf','etf sparplan','fonds','trade republic','scalable capital','flatex','comdirect depot']],
 ['Housing & Rent','expense',['miete','kaltmiete','warmmiete','mietzahlung','wohnungsmiete','hausgeld','nebenkosten','betriebskostenabrechnung','wohnungsbaugenossenschaft']],
 ['Utilities','expense',['strom','stromabschlag','stromrechnung','gasabschlag','gasrechnung','wasserabschlag','wasserrechnung','fernwaerme','stadtwerke','e on','eon','vattenfall','enbw','ewe energie','enercity','mainova','rheinenergie','swm','eprimo','yello','lichtblick','naturstrom','telekom','vodafone','o2','telefonica','1 1','congstar','drillisch','freenet','mobilfunk','festnetz','rundfunkbeitrag','beitragsservice','gez','muellabfuhr','abfallgebuehren']],
 ['Insurance','expense',['versicherung','versicherungsbeitrag','haftpflicht','hausrat','rechtsschutz','berufsunfaehigkeit','lebensversicherung','kfz versicherung','allianz','huk coburg','huk24','axa','ergo','debeka','gothaer','signal iduna','provinzial','lvm','devk','ruv','r v versicherung','barmenia']],
 ['Groceries & Food','expense',['rewe','edeka','aldi','aldi sued','aldi nord','lidl','netto','penny','kaufland','norma','tegut','denns','denn s','alnatura','bio company','basic biomarkt','vollcorner','famila','globus','marktkauf','wasgau','combi','frischemarkt','supermarkt','lebensmittel']],
 ['Restaurants','expense',['restaurant','cafe','bistro','imbiss','baeckerei','backerei','backwerk','back werk','back factory','ditsch','kamps','junge die baeckerei','doener','doner','pizzeria','pizza','sushi','kebab','lieferando','wolt','uber eats','mcdonald','mcdonalds','burger king','subway','kfc','nordsee','vapiano','hans im glueck','dean david','l osteria','sausalitos','starbucks']],
 ['Transport','expense',['deutsche bahn','db vertrieb','db fernverkehr','db regio','bahn de','deutschlandticket','deutschland ticket','d ticket','mvv','mvg','hvv','bvg','vbb','vgn','vvs','vrn','rnv','kvb','vrr','rmv','s bahn','u bahn','oepnv','flixbus','flixtrain','taxi','free now','freenow','uber','bolt','mietwagen','sixt','europcar','cambio','miles mobility','share now','parkhaus','parkgebuehr','easypark','paybyphone','tankstelle','aral','shell','esso','totalenergies','jet tankstelle','avanti tankstelle','adac']],
 ['Healthcare','expense',['apotheke','arzt','arztpraxis','zahnarzt','klinik','krankenhaus','optiker','fielmann','apollo optik','dm drogerie','dm markt','rossmann','krankenkasse','aok','barmer','techniker krankenkasse','tk krankenkasse','dak gesundheit','ikk','physiotherapie','medikamente','sanitaetshaus']],
 ['Entertainment','expense',['amazon prime','prime video','netflix','spotify','apple music','disney','disney plus','wow streaming','sky deutschland','dazn','magenta tv','youtube premium','steam','playstation','xbox','nintendo','kino','cinema','theater','konzert','eventim','ticketmaster','reservix','museum','zoo']],
 ['Leisure & Sports','expense',['fitnessstudio','fitness','mcfit','clever fit','john reed','fitx','fitness first','urban sports club','wellpass','holmes place','intersport','decathlon','sport scheck','sportscheck','yoga','pilates','sportverein','vereinsbeitrag','schwimmbad','freibad','kletterhalle','boulderhalle']],
 ['Shopping','expense',['amazon','amzn mktp','amzn marketplace','ebay','zalando','otto','about you','bonprix','h m','c a','zara','primark','uniqlo','peek cloppenburg','ikea','moebel','poco','xxxlutz','hoeffner','saturn','mediamarkt','media markt','euronics','apple store','apple com','galaxus','alternate','douglas','mueller drogerie','tchibo','thalia','hugendubel','weltbild','vinted','kleiderkreisel','obi','bauhaus','hornbach','toom']],
 ['Vacation & Travel','expense',['hotel','hostel','airbnb','booking com','expedia','hrs hotel','holidaycheck','tui','alltours','dertour','reisebuero','kreuzfahrt','aida','msc cruises','lufthansa','eurowings','condor','ryanair','easyjet']],
 ['Education','expense',['semesterbeitrag','semestergebuehr','studiengebuehr','studiengebuehren','hochschule','universitaet','studierendenwerk','studentenwerk','volkshochschule','vhs kurs','weiterbildung','schulgeld','lehrbuch','udemy','coursera','duolingo','babbel']],
 ['Subscriptions','expense',['adobe','microsoft 365','office 365','google one','icloud','dropbox','nordvpn','github','1password','bitwarden','patreon','substack','setapp','notion','abonnement','zeitungsabo','zeitschriftenabo']]
]
export function normalizeGerman(value){return String(value||'').normalize('NFC').toLocaleLowerCase('de-DE').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/([a-z])([0-9])/g,'$1 $2').replace(/([0-9])([a-z])/g,'$1 $2').trim().replace(/\s+/g,' ')}
const compiled=rules.map(([category,type,keywords])=>({category,type,keywords:keywords.map(normalizeGerman)}))
export function builtInKeywords(category){return rules.find(r=>r[0]===category)?.[2]||[]}
function bestMatch(description,type,entries,detectConflicts=false){
 const text=` ${normalizeGerman(description)} `;let best=null,conflict=false
 for(const rule of entries){if(rule.type!=='both'&&rule.type!==type)continue
  for(const raw of rule.keywords){const keyword=normalizeGerman(raw);if(!keyword)continue;if(text.includes(` ${keyword} `)){const score=keyword.split(' ').length*100+keyword.length;if(!best||score>best.score){best={category:rule.category,score};conflict=false}else if(score===best.score&&rule.category!==best.category)conflict=true}}
 }
 return detectConflicts&&conflict?{category:null,category_source:'conflicting custom keywords'}:best
}
export function keywordSuggestion(description,type,customRules=[]){
 if(!['expense','income'].includes(type))return null
 const custom=bestMatch(description,type,customRules,true)
 if(custom)return {category:custom.category,category_source:custom.category?'custom keyword':custom.category_source}
 const builtin=bestMatch(description,type,compiled)
 return builtin?{category:builtin.category,category_source:'keyword'}:null
}
export function matchGermanKeyword(description,type,customRules=[]){return keywordSuggestion(description,type,customRules)?.category||null}
