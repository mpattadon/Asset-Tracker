import { useState } from 'react'
import './App.css'
import {
  bankData,
  bondHoldings,
  expenseSummary,
  goldPositions,
  lotteryEntries,
  mutualFunds,
} from './data/mockData'
import HomePage from './pages/HomePage'
import StocksPage from './pages/StocksPage'
import BondsPage from './pages/BondsPage'
import GoldPage from './pages/GoldPage'
import FundsPage from './pages/FundsPage'
import BanksPage from './pages/BanksPage'
import LotteryPage from './pages/LotteryPage'
import ExpensesPage from './pages/ExpensesPage'

const PAGES = [
  { id: 'home', label: 'Total Assets' },
  { id: 'stocks', label: 'Stocks' },
  { id: 'bonds', label: 'Bonds & Debentures' },
  { id: 'gold', label: 'Gold' },
  { id: 'funds', label: 'Mutual Funds' },
  { id: 'banks', label: 'Banks' },
  { id: 'lottery', label: 'Gov Lottery' },
  { id: 'expenses', label: 'Expenses' },
]

function App({ hideHeader = false }) {
  const [page, setPage] = useState('home')
  const [navBlob, setNavBlob] = useState({ left: 0, width: 0, visible: false })

  const renderPage = () => {
    switch (page) {
      case 'home':
        return <HomePage />
      case 'stocks':
        return <StocksPage />
      case 'bonds':
        return <BondsPage bonds={bondHoldings} />
      case 'gold':
        return <GoldPage positions={goldPositions} />
      case 'funds':
        return <FundsPage funds={mutualFunds} />
      case 'banks':
        return <BanksPage banks={bankData} />
      case 'lottery':
        return <LotteryPage entries={lotteryEntries} />
      case 'expenses':
        return <ExpensesPage expenses={expenseSummary} />
      default:
        return null
    }
  }

  return (
    <div className="app-shell">
      <div className="shell-orb shell-orb--one" />
      <div className="shell-orb shell-orb--two" />
      <header className={`header liquid-glass liquid-glass--flow ui-panel ${hideHeader ? 'hidden' : ''}`}>
        <div>
          <p className="eyebrow">Asset Tracker</p>
          <h2 className="brand">Multi-market cockpit</h2>
          <p className="hero-sub">All your assets, organized by category with quick tabs.</p>
        </div>
        <div className="header-meta">
          <span className="header-pill">Live pricing</span>
          <span className="header-pill">US focus</span>
        </div>
      </header>

      <nav
        className="nav-bar liquid-glass liquid-glass--budget liquid-glass--no-clip ui-slider"
        onMouseLeave={() => setNavBlob((prev) => ({ ...prev, visible: false }))}
      >
        <div
          className="nav-blob"
          style={{
            opacity: navBlob.visible ? 1 : 0,
            transform: `translateX(${navBlob.left}px)`,
            width: navBlob.width,
          }}
        />
        {PAGES.map((p) => (
          <button
            key={p.id}
            className={`ui-button ui-button--lg nav-button ${page === p.id ? 'active' : ''}`}
            onClick={() => setPage(p.id)}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const parent = e.currentTarget.parentElement.getBoundingClientRect()
              setNavBlob({ left: rect.left - parent.left, width: rect.width, visible: true })
            }}
          >
            {p.label}
          </button>
        ))}
      </nav>

      <main className="page">{renderPage()}</main>
    </div>
  )
}

export default App
