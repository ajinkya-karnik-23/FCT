// Embeds the design-reference prototype (design-reference/controller-attribution-spine.html, served
// byte-for-byte from public/cash-attribution.html) inside the app shell — same tab, same nav, same route —
// rather than reimplementing it. The prototype is a self-contained document (own <html>/<head>, own script,
// fixed dark styling, JGL-only figures); an iframe keeps it pixel-exact without colliding with React's DOM
// or the app's light/dark theme variables.
export function CashAttribution() {
  return (
    <iframe
      src="/cash-attribution.html"
      title="Cash attribution"
      style={{ display: 'block', width: '100%', height: '100%', border: 0 }}
    />
  )
}
