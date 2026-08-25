@echo off
REM Expose the app via a free Cloudflare quick tunnel (no account needed).
REM Start the dev server first (npm run dev, port 5200), then this.
REM The public URL appears below as https://RANDOM-WORDS.trycloudflare.com
REM NOTE: the URL changes on every restart, and the tunnel only lives while
REM this window stays open. The app has no login - share the URL carefully.

cloudflared tunnel --url http://localhost:5200
pause
