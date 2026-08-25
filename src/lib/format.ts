// Indian crore. One decimal for aggregates (default), two for transaction amounts.
export function formatCr(value: number, decimals = 1): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}₹${Math.abs(value).toFixed(decimals)} cr`
}
