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

function App() {
  const [page, setPage] = useState('home')

  const renderPage = () => {
    switch (page) {
      case 'home':
        return <HomePage cards={summaryCards} allocation={allocation} />
      case 'stocks':
        return <StocksPage breakdown={stockBreakdown} performance={stockPerformance} />
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
      <header className="header">
        <div>
          <p className="eyebrow">Asset Tracker</p>
          <h2 className="brand">Multi-market cockpit</h2>
          <p className="hero-sub">All your assets, organized by category with quick tabs.</p>
        </div>
      </header>

      <nav className="nav-bar">
        {PAGES.map((p) => (
          <button key={p.id} className={page === p.id ? 'active' : ''} onClick={() => setPage(p.id)}>
            {p.label}
          </button>
        ))}
      </nav>

      <main className="page">{renderPage()}</main>
    </div>
  )
}

export default App
