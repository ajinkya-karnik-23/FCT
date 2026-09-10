import { useState, useCallback } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { SplashScreen } from './components/SplashScreen'

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
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
