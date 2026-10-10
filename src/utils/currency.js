// The currencies OpenAnchor supports, and how to show each one as a symbol.

export const CURRENCIES = [
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'USD', symbol: '$', label: 'US Dollar ($)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (£)' },
  { code: 'CHF', symbol: 'Fr', label: 'Swiss Franc (Fr)' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen (¥)' }
]

// Looks up the display symbol for a currency code. Falls back to € if the
// code is not one we know about.
export function symbolFor(code) {
  const match = CURRENCIES.find(c => c.code === code)
  return match ? match.symbol : '€'
}
