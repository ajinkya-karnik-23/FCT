import { useState, useCallback, useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { SplashScreen } from './components/SplashScreen'

// The logo intro plays on the first load of a browser session only — never again in that tab,
// and never on route changes (client-side navigation does not remount this component).
const SPLASH_SEEN_KEY = 'fct-splash-seen'

function splashSeen(): boolean {
  try { return sessionStorage.getItem(SPLASH_SEEN_KEY) === '1' } catch { return true }
}

export default function App() {
  const [splashDone, setSplashDone] = useState(splashSeen)
  const onSplashComplete = useCallback(() => setSplashDone(true), [])

  useEffect(() => {
    try { sessionStorage.setItem(SPLASH_SEEN_KEY, '1') } catch { /* storage unavailable — the intro still shows once */ }
  }, [])

  return (
    <>
      {!splashDone && <SplashScreen onComplete={onSplashComplete} />}
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </>
  )
}
