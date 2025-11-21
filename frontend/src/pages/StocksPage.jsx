import { useEffect, useMemo, useState, useCallback } from 'react'
import Section from '../components/Section'
import { PieDonut, Sparkline, AreaChart, CandleChart } from '../components/Charts'

function StockOverview({ breakdown, performance }) {
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

function filterRange(series, range) {
  if (!series) return []
  switch (range) {
    case '1D':
      return series.slice(-1)
    case '5D':
      return series.slice(-5)
    case '1M':
      return series.slice(-10)
    case '6M':
      return series
    case 'YTD':
    case '1Y':
    case '5Y':
    case 'MAX':
    default:
      return series
  }
}

function filterCandles(candles, range) {
  if (!candles) return []
  switch (range) {
    case '1D':
      return candles.slice(-1)
    case '5D':
      return candles.slice(-5)
    case '1M':
      return candles.slice(-10)
    case '6M':
      return candles
    case 'YTD':
    case '1Y':
    case '5Y':
    case 'MAX':
    default:
      return candles
  }
}

function StockMarketDetail({ market, sortByDay, onSortToggle, onAddInvestment }) {
  const valueFmt = useMemo(() => new Intl.NumberFormat('en-US'), [])
  const { title, currency, value, dayChange, dayChangePct, totalChange, totalChangePct, series, holdings, candlesticks } = market
  const dayPositive = dayChange >= 0
  const totalPositive = totalChange >= 0
  const [chartMode, setChartMode] = useState('line')
  const [range, setRange] = useState('1M')
  const filteredSeries = filterRange(series, range)
  const filteredCandles = filterCandles(candlesticks, range)

  return (
    <div className="card stock-panel">
      <div className="stock-header">
        <div>
          <p className="muted small">{title}</p>
          <h2>
            {currency} {valueFmt.format(value)}
          </h2>
        </div>
        <div className="stock-bubbles">
          <span className={dayPositive ? 'pill up bubble' : 'pill down bubble'}>
            <span className="muted small">Day gain</span>
            <strong>
              {dayPositive ? '↑' : '↓'} {currency} {valueFmt.format(Math.abs(dayChange))}
            </strong>
            <span>{Math.abs(dayChangePct).toFixed(2)}% · 1D</span>
          </span>
          <span className={totalPositive ? 'pill up bubble' : 'pill down bubble'}>
            <span className="muted small">Total gain</span>
            <strong>
              {totalPositive ? '↑' : '↓'} {currency} {valueFmt.format(Math.abs(totalChange))}
            </strong>
            <span>{Math.abs(totalChangePct).toFixed(2)}% · since inception</span>
          </span>
        </div>
      </div>

      <div className="chart-wrap">
        <div className="tab-inline" style={{ marginBottom: 8 }}>
          <button className={chartMode === 'line' ? 'active' : ''} onClick={() => setChartMode('line')}>
            Line
          </button>
          <button className={chartMode === 'candle' ? 'active' : ''} onClick={() => setChartMode('candle')}>
            Candle
          </button>
        </div>
        <div className="ranges">
          {['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'MAX'].map((r) => (
            <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>
        <div className="chart-frame">
          <div className="axis-label y-label">Value</div>
          <div className="axis-label x-label">Time</div>
          {chartMode === 'candle' ? <CandleChart candles={filteredCandles} /> : <AreaChart points={filteredSeries} color="#3B82F6" />}
        </div>
      </div>

      <div className="holdings">
        <div className="holdings-header">
          <div className="tab-inline">
            <button className="active">Investments</button>
            <button disabled>Activity</button>
            <button disabled>News & events</button>
          </div>
          <div className="holding-actions">
            <button className="ghost" onClick={onSortToggle}>
              Sort by day % change {sortByDay ? '↑' : ''}
            </button>
            <button className="primary" onClick={onAddInvestment}>
              + Investment
            </button>
          </div>
        </div>
        <div className="holdings-table">
          <div className="table-head">
            <span>Symbol</span>
            <span>Name</span>
            <span className="right">Price</span>
            <span className="right">Quantity</span>
            <span className="right">Day gain</span>
            <span className="right">Value</span>
          </div>
          {holdings.map((row) => {
            const rowPositive = row.dayGain >= 0
            return (
              <div key={row.symbol} className="table-row">
                <span className="pill symbol">{row.symbol}</span>
                <span className="row-title">{row.name}</span>
                <span className="right">
                  {currency} {valueFmt.format(row.price)}
                </span>
                <span className="right">{row.quantity.toLocaleString()}</span>
                <span className={rowPositive ? 'right up-text' : 'right down-text'}>
                  {rowPositive ? '↑' : '↓'}
                  {currency} {valueFmt.format(Math.abs(row.dayGain))} ({Math.abs(row.dayGainPct).toFixed(2)}%)
                </span>
                <span className="right">
                  {currency} {valueFmt.format(row.value)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function StocksPage({ breakdown, performance, markets }) {
  const [view, setView] = useState('overview')
  const [marketData, setMarketData] = useState(markets)
  const [loading, setLoading] = useState(false)
  const [sortByDay, setSortByDay] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedMarket, setSelectedMarket] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [selectedQuote, setSelectedQuote] = useState(null)
  const apiBase = '/api/stocks'

  const fetchMarket = useCallback(
    async (marketKey) => {
      setLoading(true)
      try {
        const [summaryRes, holdingsRes] = await Promise.all([
          fetch(`${apiBase}/markets/${marketKey}/summary`, { headers: { 'X-User-Id': 'user-123' } }),
          fetch(
            `${apiBase}/markets/${marketKey}/holdings${sortByDay ? '?sort=dayChangePct' : ''}`,
            { headers: { 'X-User-Id': 'user-123' } },
          ),
        ])
        if (summaryRes.ok && holdingsRes.ok) {
          const summary = await summaryRes.json()
          const holdings = await holdingsRes.json()
          setMarketData((prev) => ({
            ...prev,
            [marketKey]: {
              ...prev[marketKey],
              value: summary.totalValue || prev[marketKey]?.value || 0,
              dayChange: summary.dayChange || 0,
              dayChangePct: summary.dayChangePct || 0,
              totalChange: summary.totalChange || 0,
              totalChangePct: summary.totalChangePct || 0,
              series: summary.series && summary.series.length ? summary.series : prev[marketKey]?.series || [],
              holdings,
            },
          }))
        }
      } catch (e) {
        // fallback: keep mock
      } finally {
        setLoading(false)
      }
    },
    [apiBase, sortByDay],
  )

  useEffect(() => {
    if (view === 'thai' || view === 'us') {
      fetchMarket(view)
    }
  }, [view, sortByDay, fetchMarket])

  const openModal = (marketKey) => {
    setShowModal(true)
    setSelectedMarket(marketKey)
    setSelectedQuote(null)
    setQuantity('')
    setSearchText('')
    setSearchResults([])
  }

  const searchQuotes = async (term) => {
    setSearchText(term)
    if (!term || term.length < 2) {
      setSearchResults([])
      return
    }
    try {
      const res = await fetch(`${apiBase}/search?query=${encodeURIComponent(term)}&market=${selectedMarket}`)
      if (res.ok) {
        setSearchResults(await res.json())
      }
    } catch (e) {
      setSearchResults([])
    }
  }

  const submitInvestment = async () => {
    if (!selectedQuote || !quantity) return
    try {
      const payload = {
        symbol: selectedQuote.symbol,
        name: selectedQuote.name,
        market: selectedQuote.market.toLowerCase(),
        type: selectedQuote.type,
        currency: selectedQuote.currency,
        price: selectedQuote.price,
        quantity: Number(quantity),
      }
      const res = await fetch(`${apiBase}/markets/${selectedMarket}/holdings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': 'user-123' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setShowModal(false)
        fetchMarket(selectedMarket)
      }
    } catch (e) {
      // ignore
    }
  }

  if (view === 'overview') {
    return (
      <>
        <div className="tab-switch wide">
          <button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}>
            Overview
          </button>
          <button className={view === 'thai' ? 'active' : ''} onClick={() => setView('thai')}>
            Thai Market
          </button>
          <button className={view === 'us' ? 'active' : ''} onClick={() => setView('us')}>
            US Market
          </button>
        </div>
        <StockOverview breakdown={breakdown} performance={performance} />
      </>
    )
  }

  return (
    <>
      <div className="tab-switch wide">
        <button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}>
          Overview
        </button>
        <button className={view === 'thai' ? 'active' : ''} onClick={() => setView('thai')}>
          Thai Market
        </button>
        <button className={view === 'us' ? 'active' : ''} onClick={() => setView('us')}>
          US Market
        </button>
      </div>
      {loading ? (
        <div className="muted small">Loading...</div>
      ) : (
        <StockMarketDetail
          market={marketData[view]}
          sortByDay={sortByDay}
          onSortToggle={() => setSortByDay((s) => !s)}
          onAddInvestment={() => openModal(view)}
        />
      )}

      {showModal ? (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add to {view === 'thai' ? 'Thai Stock' : 'US Stock'}</h3>
              <button className="ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <input
              className="input"
              placeholder="Type an investment name or symbol"
              value={searchText}
              onChange={(e) => searchQuotes(e.target.value)}
            />
            <div className="suggestions">
              {searchResults.map((q) => (
                <div
                  key={q.symbol}
                  className={`suggestion-row ${selectedQuote?.symbol === q.symbol ? 'active' : ''}`}
                  onClick={() => setSelectedQuote(q)}
                >
                  <div>
                    <p className="row-title">{q.name}</p>
                    <p className="muted small">
                      {q.symbol} · {q.type}
                    </p>
                  </div>
                  <div className={q.dayChangePct >= 0 ? 'up-text' : 'down-text'}>
                    {q.currency} {q.price} ({q.dayChangePct}%)
                  </div>
                </div>
              ))}
              {!searchResults.length && <p className="muted small">Start typing to search...</p>}
            </div>
            <div className="form-row">
              <label>Quantity</label>
              <input
                className="input"
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="primary" onClick={submitInvestment} disabled={!selectedQuote || !quantity}>
                Add
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

