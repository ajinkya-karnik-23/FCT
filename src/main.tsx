import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyTheme, storedTheme } from './theme/tokens'
import './index.css'

// Apply the persisted choice before first paint so there is no flash of the wrong theme.
applyTheme(storedTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
