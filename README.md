# Asset Tracker

Asset Tracker now runs with:

- a Java/Spring Boot backend
- SQLite as the canonical data store
- a bundled Python `yfinance` sidecar for market data
- the existing React/Vite frontend served locally by the app host

## Local App

On Windows, launch the local app with:

```powershell
.\start-local-app.cmd
```

What it does:

- builds the frontend if `frontend/dist` is missing
- checks Python and installs `backend/python/requirements.txt` if `yfinance` is missing
- starts the backend on `127.0.0.1`
- starts the internal frontend host on `127.0.0.1:4173`
- opens the private app URL in the default browser

The app is private by default. LAN sharing is disabled until a logged-in user enables it from the UI.

## Development

Backend tests:

```powershell
cd backend
cmd.exe /c mvnw.cmd test
```

Frontend build:

```powershell
cd frontend
npm run build
```
