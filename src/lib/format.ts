// Indian crore. One decimal for aggregates (default), two for transaction amounts.
export function formatCr(value: number, decimals = 1): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}₹${Math.abs(value).toFixed(decimals)} cr`
}

// §7.12 — recurrence is stored as an integer number of months; this renders the ordinal form.
export function formatRecurrence(months: number): string {
  const suffix = months === 1 ? 'st' : months === 2 ? 'nd' : months === 3 ? 'rd' : 'th'
  return `${months}${suffix} consecutive month`
}
