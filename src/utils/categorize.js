/**
 * Hybrid auto-categorization
 * 1. Keyword/pattern matching  — instant, no AI needed
 * 2. Batch LLM fallback        — one single call for anything unmatched
 */

const KEYWORD_MAP = {
  'Housing & Rent': [
    'miete', 'rent', 'wohnungsgeld', 'hausgeld', 'nebenkosten', 'wohnung',
    'vermieter', 'kaltmiete', 'warmmiete', 'immobilien'
  ],
  'Groceries & Food': [
    'rewe', 'edeka', 'aldi', 'lidl', 'netto ', 'penny', 'kaufland', 'norma',
    'tegut', 'spar ', 'billa', 'interspar', 'supermarkt', 'grocery',
    'lebensmittel', 'denns', 'vollcorner', 'famila', 'globus ', 'marktkauf',
    'wasgau', 'combi markt', 'frischemarkt', 'hit markt', 'real '
  ],
  'Restaurants': [
    'restaurant', 'cafe ', 'café', 'bistro', 'imbiss', 'mcdonald', 'burger king',
    'subway', 'kfc', 'pizza', 'döner', 'sushi', 'kebab', 'bäckerei', 'bakery',
    'starbucks', 'costa ', 'nordsee', 'vapiano', 'lieferando', 'deliveroo',
    'uber eats', 'wolt', 'foodora', 'just eat', 'dominos', 'five guys',
    'hans im glück', 'dean&david', 'l\'osteria', 'enchilada', 'sausalitos'
  ],
  'Transport': [
    'db ', 'deutsche bahn', 'bahn.de', 'mvv', 'hvv', 'bvg', 'vgn', 'vvs',
    'rnv', 'kvb', 'ssb ', 'öpnv', 'u-bahn', 's-bahn', 'uber', 'bolt ',
    'free now', 'mytaxi', 'taxi ', 'flixbus', 'flixtra', 'ryanair', 'easyjet',
    'eurowings', 'lufthansa', 'condor', 'wizz', 'norwegian', 'british airways',
    'aral', 'shell', 'esso', 'bp ', 'total ', 'jet ', 'tankstelle', 'benzin',
    'kraftstoff', 'adac', 'parking', 'parkhaus', 'tiefgarage', 'mietwagen',
    'hertz', 'sixt ', 'europcar', 'enterprise', 'tier ', 'voi ', 'lime ', 'bird '
  ],
  'Healthcare': [
    'apotheke', 'pharmacy', 'arzt', 'klinik', 'clinic', 'hospital', 'krankenhaus',
    'zahnarzt', 'dentist', 'optiker', 'dm drog', 'rossmann', 'krankenkasse',
    'barmer', 'aok ', 'tkk ', 'dak ', 'techniker krank', 'physiotherap',
    'therapie', 'psycholog', 'praxis', 'medikament', 'sanitätshaus'
  ],
  'Entertainment': [
    'netflix', 'spotify', 'apple music', 'amazon prime', 'disney', 'hbo',
    'sky ', 'dazn', 'magenta tv', 'twitch', 'youtube premium', 'steam',
    'playstation', 'xbox', 'nintendo', 'epic games', 'kino', 'cinema',
    'theater', 'oper ', 'konzert', 'concert', 'eventim', 'ticketmaster',
    'reservix', 'museum', 'zoo ', 'aquarium', 'bowling', 'escape room'
  ],
  'Leisure & Sports': [
    'fitnessstudio', 'fitness studio', 'gym ', 'mcfit', 'clever fit',
    'john reed', 'holmes place', 'intersport', 'decathlon', 'sport scheck',
    'yoga', 'pilates', 'crossfit', 'golf ', 'tennis', 'squash', 'klettern',
    'schwimmbad', 'freibad', 'bouldern', 'fahrrad', 'cycling'
  ],
  'Shopping': [
    'amazon', 'ebay', 'zalando', 'otto ', 'about you', 'bonprix', 'shein',
    'h&m', 'zara', 'primark', 'c&a ', 'uniqlo', 'mango ', 'peek&cloppenburg',
    'ikea', 'möbel ', 'roller ', 'poco ', 'xxxlutz', 'saturn', 'mediamarkt',
    'media markt', 'expert ', 'euronics', 'apple store', 'apple.com',
    'galaxus', 'alternate', 'douglas', 'sephora', 'müller ', 'depot ',
    'tchibo', 'thalia', 'weltbild', 'vinted', 'kleiderkreisel'
  ],
  'Vacation & Travel': [
    'hotel', 'hostel', 'airbnb', 'booking.com', 'booking ', 'expedia',
    'trivago', 'hrs ', 'holidaycheck', 'tui ', 'thomas cook', 'fti ',
    'alltours', 'neckermann', 'dertour', 'reisebüro', 'cruise', 'kreuzfahrt',
    'msc ', 'aida ', 'carnival'
  ],
  'Utilities': [
    'strom', 'electricity', 'fernwärme', 'eon ', 'e.on', 'rwe ', 'vattenfall',
    'stadtwerke', 'enercity', 'swm ', 'eprimo', 'yello ', 'lichtblick',
    'naturstrom', 'telekom', 'vodafone', 'o2 ', 'drillisch', 'freenet',
    '1&1', 'internet', 'mobilfunk', 'festnetz', 'unity media', 'unitymedia',
    'müllabfuhr', 'abfall', 'entsorgung', 'rundfunk', 'gez '
  ],
  'Insurance': [
    'versicherung', 'insurance', 'allianz', 'axa ', 'generali', 'huk ',
    'huk-coburg', 'ergo ', 'zurich', 'gothaer', 'signal iduna', 'debeka',
    'provinzial', 'lvm ', 'haftpflicht', 'hausrat', 'rechtsschutz',
    'berufsunfähigkeit', 'lebensversicherung'
  ],
  'Education': [
    'schule', 'university', 'uni ', 'hochschule', 'studiengebühr', 'tuition',
    'seminar', 'udemy', 'coursera', 'skillshare', 'linkedin learning',
    'duolingo', 'babbel', 'bücher', 'lehrbuch', 'textbook', 'volkshochschule',
    'vhs ', 'weiterbildung'
  ],
  'Subscriptions': [
    'adobe', 'microsoft 365', 'office 365', 'google one', 'icloud', 'dropbox',
    'nordvpn', 'expressvpn', 'github', 'heroku', 'vercel', 'netlify',
    'namecheap', 'godaddy', 'squarespace', 'shopify', '1password', 'bitwarden',
    'patreon', 'substack', 'setapp', 'notion'
  ],
  'Salary': [
    'gehalt', 'salary', 'lohn', 'wages', 'entgelt', 'arbeitgeber',
    'payroll', 'gutschrift gehalt', 'monatslohn', 'nettolohn', 'gehaltseingang'
  ],
  'Freelance': [
    'honorar', 'freiberuf', 'freelance', 'rechnung nr', 'invoice',
    'beratung', 'consulting', 'selbständig', 'dienstleistung'
  ],
  'Investments': [
    'dividende', 'dividend', 'zinsen', 'interest', 'kapitalertrag',
    'depot', 'wertpapier', 'aktien', 'fonds', 'etf ', 'comdirect',
    'trade republic', 'scalable', 'flatex', 'degiro'
  ],
  'Transfers': [
    'überweisung', 'transfer', 'umbuchung', 'dauerauftrag', 'standing order',
    'gutschrift', 'eingang von', 'sepa '
  ]
}

const INCOME_CATEGORIES  = ['Salary','Freelance','Investments','Gifts Received','Other Income','Transfers']
const EXPENSE_CATEGORIES = ['Housing & Rent','Groceries & Food','Restaurants','Transport','Healthcare',
  'Entertainment','Leisure & Sports','Shopping','Vacation & Travel','Utilities','Insurance',
  'Education','Subscriptions','Other Expense','Transfers']

export function matchKeyword(description, type) {
  const lower = description.toLowerCase()
  const candidates = Object.entries(KEYWORD_MAP).filter(([name]) =>
    type === 'income' ? INCOME_CATEGORIES.includes(name) : EXPENSE_CATEGORIES.includes(name)
  )
  for (const [category, keywords] of candidates) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) return category
    }
  }
  return null
}

export async function batchCategorize(transactions, availableCategories, model) {
  if (!transactions.length) return {}
  const categoryNames = availableCategories.map(c => c.name).join(', ')
  const items = transactions.map((tx, i) =>
    `${i}: "${tx.description}" (${tx.type})`
  ).join('\n')

  const prompt = `Categorize each transaction. Return ONLY a JSON object like {"0":"Category Name","1":"Category Name"}.
Available categories: ${categoryNames}
Use "Other Expense" or "Other Income" if nothing fits. No explanation, no markdown.

TRANSACTIONS:
${items}`

  try {
    const response = await window.api.ollama.generate({ model, prompt })
    let text = response.trim().replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim()
    const s = text.indexOf('{'), e = text.lastIndexOf('}')
    if (s === -1) return {}
    return JSON.parse(text.substring(s, e + 1))
  } catch { return {} }
}

const BATCH_SIZE = 16

export async function autoCategorize(transactions, categories, model, ollamaOk, onProgress) {
  const result = transactions.map(tx => ({ ...tx }))
  const needsLLM = []

  // Pass 1: keyword matching — instant, no AI
  for (let i = 0; i < result.length; i++) {
    const cat = matchKeyword(result[i].description, result[i].type)
    if (cat) result[i].category = cat
    else needsLLM.push({ index: i, ...result[i] })
  }

  const hits = result.length - needsLLM.length
  const batches = Math.ceil(needsLLM.length / BATCH_SIZE)

  if (needsLLM.length === 0) {
    onProgress?.(`All ${hits} transactions matched by keywords`)
    return result
  }

  onProgress?.(`Keywords matched ${hits}/${result.length} · ${needsLLM.length} sent to AI in ${batches} batch${batches !== 1 ? 'es' : ''} of ${BATCH_SIZE}`)

  // Pass 2: chunked LLM batches of 16
  if (model && ollamaOk) {
    for (let b = 0; b < batches; b++) {
      const chunk = needsLLM.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE)
      onProgress?.(`AI categorizing batch ${b + 1}/${batches} (${chunk.length} transactions)...`)

      const llmResults = await batchCategorize(chunk, categories, model)

      for (let j = 0; j < chunk.length; j++) {
        const cat = llmResults[String(j)]
        if (cat) result[chunk[j].index].category = cat
      }
    }
  }

  return result
}
