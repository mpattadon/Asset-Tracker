import { useState } from 'react'
import Section from '../components/Section'
import { PieDonut, Sparkline } from '../components/Charts'

export default function StocksPage({ breakdown, performance }) {
  const [tab, setTab] = useState('thai')

  return (
    <Section
      title="Stocks"
      subtitle="Thai and US equity portfolios with quick pies and tabbed performance"
      actions={
        <div className="tab-switch">
          <button className={tab === 'thai' ? 'active' : ''} onClick={() => setTab('thai')}>
            Thai Market
          </button>
          <button className={tab === 'us' ? 'active' : ''} onClick={() => setTab('us')}>
            US Market
          </button>
        </div>
      }
    >
      <div className="grid pies">
        <PieDonut segments={breakdown.thai} label="Thai Mix" />
        <PieDonut segments={breakdown.us} label="US Mix" />
      </div>
      <div className="card stack">
        <div className="stack-header">
          <div>
            <p className="muted">Portfolio trend</p>
            <h3>{tab === 'thai' ? 'Thai equities' : 'US equities'}</h3>
            <p className="accent">{performance[tab].change}</p>
          </div>
          <Sparkline points={performance[tab].series} color="#3B82F6" />
        </div>
        <div className="stack-list">
          {breakdown[tab].map((stock) => (
            <div key={stock.label} className="row">
              <div className="row-left">
                <span className="dot" style={{ background: stock.color }} />
                <div>
                  <p className="row-title">{stock.label}</p>
                  <p className="muted small">Exposure</p>
                </div>
              </div>
              <div className="row-right">
                <p className="heavy">{stock.value}%</p>
                <span className="pill">Overweight</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}
