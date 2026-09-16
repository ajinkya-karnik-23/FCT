import { useState, useCallback } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { SplashScreen } from './components/SplashScreen'

export default function App() {
  // ?noSplash=1 skips the boot animation — used by the screencast recorder,
  // which does a hard page load once per beat and can't afford the 4.4s
  // splash (fade included) on every single one.
  const skipSplash = new URLSearchParams(window.location.search).has('noSplash')
  const [splashDone, setSplashDone] = useState(skipSplash)
  const onSplashComplete = useCallback(() => setSplashDone(true), [])

  return (
    <>
      {!splashDone && <SplashScreen onComplete={onSplashComplete} />}
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </>
  )
}
