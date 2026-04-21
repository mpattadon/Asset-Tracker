# Asset Tracker

Asset Tracker is a local-first personal portfolio dashboard for tracking multiple asset classes from a single app shell.

Today the most complete modules are:

- Stocks
- Mutual Funds

The remaining sections are already present in the UI as placeholders and can be filled in over time:

- Bonds & Debentures
- Gold
- Banks
- Government Lottery
- Options

## Stack

The app currently runs as:

- `frontend/`: React + Vite
- `backend/`: Spring Boot + SQLite
- `backend/python/yfinance_sidecar.py`: Python sidecar for market data via `yfinance`

The backend is the source of truth for portfolio and ledger data. Market quotes, chart history, FX, and stock metadata are loaded through the Python sidecar.

## Main Features

- Browse the app without logging in
- Login is only required for creating, editing, or deleting portfolio/account data
- Stocks supports:
  - multiple portfolios
  - portfolio-specific base currencies
  - buy / sell / dividend ledger rows
  - editable ledger rows
  - stock search with chart, metadata, news, and financials
- Mutual Funds supports:
  - per-bank accounts
  - purchase ledger
  - monthly valuation logs
  - sell ledger with FIFO lot handling
  - editable account, purchase, log, and sell rows
- Total Assets page aggregates live data from finished modules into the user's preferred currency

## Requirements

Windows is the primary supported environment for the current launcher scripts.

Required on `PATH`:

- Node.js / npm
- Python
- Java 21+

The launcher scripts will install Python sidecar dependencies if `yfinance` is missing.

## Quick Start

### Development Mode

Use development mode when actively editing the frontend or backend.

```powershell
.\start-dev-app.cmd
```

What it does:

- stops stale `yfinance_sidecar.py` processes
- starts a fresh Python sidecar on `127.0.0.1:9001`
- starts Spring Boot on the first free port from `8080`
- starts Vite on the first free port from `5173`
- opens the app in your browser

Notes:

- frontend changes hot reload automatically
- backend changes are picked up when Spring recompiles changed classes
- if backend changes do not appear, run:

```powershell
cd backend
cmd.exe /c mvnw.cmd compile
```

### Local App Mode

Use local app mode when you want a more app-like run without Vite dev tooling.

```powershell
.\start-local-app.cmd
```

What it does:

- builds the frontend bundle if needed
- stops stale `yfinance_sidecar.py` processes
- starts the Python sidecar
- launches the Spring Boot app, which serves the built frontend
- opens the private local app URL in the browser

Optional rebuild:

```powershell
.\start-local-app.ps1 -RebuildFrontend
```

## Project Layout

```text
Asset-Tracker/
├─ frontend/                React + Vite UI
├─ backend/                 Spring Boot API, SQLite, migrations
├─ backend/python/          yfinance sidecar
├─ start-dev-app.cmd        Windows dev launcher
├─ start-dev-app.ps1
├─ start-local-app.cmd      Windows local-app launcher
└─ start-local-app.ps1
```

## How To Use The App

### General Flow

- Open the app
- Browse pages without logging in if you only want to inspect data
- Login when you want to add or modify portfolios, accounts, or ledger rows
- Set:
  - site language
  - preferred currency
  from the right sidebar

### Stocks

- Create one or more stock portfolios
- Assign a preferred currency per portfolio
- Add transactions through the stock transaction dialog
- Search stocks from the `Search A Stock` tab
- Use `Overview`, `Transactions`, and `Per Stock` tabs for different views

### Mutual Funds

- Add an account with:
  - bank name
  - account number
  - notes
  - account currency
- Add fund purchases to an account
- Log monthly fund values and dividends
- Record sells with FIFO lot handling
- Use:
  - `Overview`
  - `Accounts`
  - `Sells`
  tabs to inspect performance and ledger history

## Data Notes

- Portfolio and account data is stored locally in SQLite
- Market data is fetched live through the Python sidecar
- Total Assets converts finished-module values into the global preferred currency
- Stocks `All` view aggregates across portfolios in the preferred currency
- Individual stock portfolios and mutual fund accounts retain their own base currency behavior

## Useful Commands

### Frontend build

```powershell
cd frontend
npm run build
```

### Backend tests

```powershell
cd backend
cmd.exe /c mvnw.cmd test
```

### Backend compile only

```powershell
cd backend
cmd.exe /c mvnw.cmd compile
```

## Current Status

This project is being prepared toward a first public release.

The most production-ready flows right now are:

- Stocks
- Mutual Funds
- Total Assets overview using live Stocks and Mutual Funds data

The app is still evolving, so expect active changes around:

- unfinished asset modules
- release packaging
- updater/installer flow
- additional validation and polish
