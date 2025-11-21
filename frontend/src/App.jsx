import { useState } from 'react'
import './App.css'
import {
  allocation,
  bankData,
  bondHoldings,
  expenseSummary,
  goldPositions,
  lotteryEntries,
  mutualFunds,
  stockBreakdown,
  stockPerformance,
  stockMarkets,
  summaryCards,
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
        return <HomePage cards={summaryCards} allocation={allocation} />
      case 'stocks':
        return <StocksPage breakdown={stockBreakdown} performance={stockPerformance} markets={stockMarkets} />
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
      <header className={`header ${hideHeader ? 'hidden' : ''}`}>
        <div>
          <p className="eyebrow">Asset Tracker</p>
          <h2 className="brand">Multi-market cockpit</h2>
          <p className="hero-sub">All your assets, organized by category with quick tabs.</p>
        </div>
      </header>

      <nav
        className="nav-bar"
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
            className={page === p.id ? 'active' : ''}
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
