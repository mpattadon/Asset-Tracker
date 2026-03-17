import { useCallback, useEffect, useMemo, useState } from 'react'
import Section from '../components/Section'
import { PieDonut, Sparkline, AreaChart, CandleChart } from '../components/Charts'
import { addHolding, getStockHoldings, getStockSeed, getStockSummary, searchStocks } from '../api'

function normalizeSeedHolding(holding) {
  const value = holding.price * holding.quantity
  const dayGain = value * ((holding.dayChangePct ?? 0) / 100)
  return {
    symbol: holding.symbol,
    name: holding.name,
    market: holding.market,
    type: holding.type,
    currency: holding.currency,
    price: holding.price,
    quantity: holding.quantity,
    dayGain,
    dayChangePct: holding.dayChangePct,
    value,
    totalChange: (holding.price - holding.avgCost) * holding.quantity,
    totalChangePct: holding.avgCost ? ((holding.price - holding.avgCost) / holding.avgCost) * 100 : 0,
    lots: [
      {
        id: `${holding.symbol}-seed`,
        purchaseDate: 'Read-only seed',
        purchasePrice: holding.avgCost,
        quantity: holding.quantity,
        currentPrice: holding.price,
        dayGain,
        dayChangePct: holding.dayChangePct,
        value,
      },
    ],
  }
}

function StockOverview({ markets }) {
  const [tab, setTab] = useState('thai')
  const breakdown = useMemo(
    () => ({
      thai: markets?.thai?.breakdown ?? [],
      us: markets?.us?.breakdown ?? [],
    }),
    [markets],
  )
  const performance = useMemo(
    () => ({
      thai: markets?.thai?.performance ?? { change: 'No data', series: [] },
      us: markets?.us?.performance ?? { change: 'No data', series: [] },
    }),
    [markets],
  )

  return (
    <Section
      title="Stocks"
      subtitle="Thai and US equity portfolios with quick pies and tabbed performance"
      actions={
        <div className="tab-switch ui-slider liquid-glass liquid-glass--budget">
          <button className={`ui-button ui-button--no-shift ${tab === 'thai' ? 'active' : ''}`} onClick={() => setTab('thai')}>
            Thai Market
          </button>
          <button className={`ui-button ui-button--no-shift ${tab === 'us' ? 'active' : ''}`} onClick={() => setTab('us')}>
            US Market
          </button>
        </div>
      }
    >
      <div className="grid pies">
        <PieDonut segments={breakdown.thai} label="Thai Mix" />
        <PieDonut segments={breakdown.us} label="US Mix" />
      </div>
      <div className="card stack liquid-glass liquid-glass--budget ui-panel">
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
                <span className="pill">{tab === 'us' ? 'Live' : 'Read only'}</span>
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
    default:
      return candles
  }
}

function formatNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
  }).format(value ?? 0)
}

function StockMarketDetail({
  market,
  readOnly,
  sortByDay,
  onSortToggle,
  onAddInvestment,
  expandedSymbol,
  onTogglePosition,
}) {
  const { title, currency, value, dayChange, dayChangePct, totalChange, totalChangePct, series, holdings, candlesticks } = market
  const dayPositive = dayChange >= 0
  const totalPositive = totalChange >= 0
  const [chartMode, setChartMode] = useState('line')
  const [range, setRange] = useState('1M')
  const filteredSeries = filterRange(series, range)
  const filteredCandles = filterCandles(candlesticks, range)

  return (
    <div className="card stock-panel liquid-glass liquid-glass--flow ui-panel">
      <div className="stock-header">
        <div>
          <p className="muted small">{title}</p>
          <h2>
            {currency} {formatNumber(value, 0)}
          </h2>
        </div>
        <div className="stock-bubbles">
          <span className={dayPositive ? 'pill up bubble' : 'pill down bubble'}>
            <span className="muted small">Day gain</span>
            <strong>
              {dayPositive ? '↑' : '↓'} {currency} {formatNumber(Math.abs(dayChange))}
            </strong>
            <span>{Math.abs(dayChangePct).toFixed(2)}% · 1D</span>
          </span>
          <span className={totalPositive ? 'pill up bubble' : 'pill down bubble'}>
            <span className="muted small">Total gain</span>
            <strong>
              {totalPositive ? '↑' : '↓'} {currency} {formatNumber(Math.abs(totalChange))}
            </strong>
            <span>{Math.abs(totalChangePct).toFixed(2)}% · since inception</span>
          </span>
        </div>
      </div>

      <div className="chart-wrap">
        <div className="tab-inline" style={{ marginBottom: 8 }}>
          <button className={`ui-button ui-button--no-shift ${chartMode === 'line' ? 'active' : ''}`} onClick={() => setChartMode('line')}>
            Line
          </button>
          <button className={`ui-button ui-button--no-shift ${chartMode === 'candle' ? 'active' : ''}`} onClick={() => setChartMode('candle')}>
            Candle
          </button>
        </div>
        <div className="ranges">
          {['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'MAX'].map((rangeValue) => (
            <button key={rangeValue} className={`ui-button ui-button--no-shift ${range === rangeValue ? 'active' : ''}`} onClick={() => setRange(rangeValue)}>
              {rangeValue}
            </button>
          ))}
        </div>
        <div className="chart-frame">
          <div className="axis-label y-label">Value</div>
          <div className="axis-label x-label">Time</div>
          {chartMode === 'candle'
            ? <CandleChart candles={filteredCandles} />
            : <AreaChart points={filteredSeries} color="#3B82F6" />}
        </div>
      </div>

      <div className="holdings">
        <div className="holdings-header">
          <div className="tab-inline">
            <button className="ui-button ui-button--no-shift active">Investments</button>
            <button className="ui-button ui-button--no-shift" disabled>Activity</button>
            <button className="ui-button ui-button--no-shift" disabled>News & events</button>
          </div>
          <div className="holding-actions">
            {readOnly ? <span className="readonly-note">Thai market is visible but read-only for now.</span> : null}
            <button className="ghost ui-button" onClick={onSortToggle} disabled={readOnly}>
              Sort by day % change {sortByDay ? '↑' : ''}
            </button>
            <button className="primary ui-button ui-button--lg" onClick={onAddInvestment} disabled={readOnly}>
              + Investment
            </button>
          </div>
        </div>
        <div className="holdings-table liquid-glass liquid-glass--budget ui-panel">
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
            const expanded = expandedSymbol === row.symbol
            return (
              <div key={row.symbol} className="position-group">
                <div className={`table-row position-row ${expanded ? 'expanded' : ''}`} onClick={() => onTogglePosition(row.symbol)}>
                  <span className="symbol-cell">
                    <span className="pill symbol">{row.symbol}</span>
                    <span className="expand-indicator">{expanded ? '−' : '+'}</span>
                  </span>
                  <span className="row-title">{row.name}</span>
                  <span className="right">
                    {currency} {formatNumber(row.price)}
                  </span>
                  <span className="right">{formatNumber(row.quantity)}</span>
                  <span className={rowPositive ? 'right up-text' : 'right down-text'}>
                    {rowPositive ? '↑' : '↓'}
                    {currency} {formatNumber(Math.abs(row.dayGain))} ({Math.abs(row.dayChangePct).toFixed(2)}%)
                  </span>
                  <span className="right">
                    {currency} {formatNumber(row.value)}
                  </span>
                </div>

                {expanded ? row.lots.map((lot) => {
                  const lotPositive = lot.dayGain >= 0
                  return (
                    <div key={lot.id} className="table-row lot-row">
                      <span className="table-subhead">Lot</span>
                      <span className="lot-meta">
                        {lot.purchaseDate} · Bought at {currency} {formatNumber(lot.purchasePrice)}
                      </span>
                      <span className="right">
                        {currency} {formatNumber(lot.currentPrice)}
                      </span>
                      <span className="right">{formatNumber(lot.quantity)}</span>
                      <span className={lotPositive ? 'right up-text' : 'right down-text'}>
                        {lotPositive ? '↑' : '↓'}
                        {currency} {formatNumber(Math.abs(lot.dayGain))} ({Math.abs(lot.dayChangePct).toFixed(2)}%)
                      </span>
                      <span className="right">
                        {currency} {formatNumber(lot.value)}
                      </span>
                    </div>
                  )
                }) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function StocksPage() {
  const [view, setView] = useState('overview')
  const [marketSeeds, setMarketSeeds] = useState(null)
  const [metaLoading, setMetaLoading] = useState(true)
  const [metaError, setMetaError] = useState('')
  const [sortByDay, setSortByDay] = useState(false)
  const [marketLoading, setMarketLoading] = useState(false)
  const [marketError, setMarketError] = useState('')
  const [usSummary, setUsSummary] = useState(null)
  const [usHoldings, setUsHoldings] = useState([])
  const [expandedSymbol, setExpandedSymbol] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedQuote, setSelectedQuote] = useState(null)
  const [purchaseDate, setPurchaseDate] = useState('')
  const [quantity, setQuantity] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [modalError, setModalError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadSeeds = useCallback(async () => {
    setMetaLoading(true)
    setMetaError('')
    try {
      const [thai, us] = await Promise.all([getStockSeed('thai'), getStockSeed('us')])
      setMarketSeeds({ thai, us })
    } catch (requestError) {
      setMetaError(requestError.message || 'Unable to load stock market data.')
    } finally {
      setMetaLoading(false)
    }
  }, [])

  const loadUsMarket = useCallback(async () => {
    setMarketLoading(true)
    setMarketError('')
    try {
      const [summary, holdings] = await Promise.all([
        getStockSummary('us'),
        getStockHoldings('us', sortByDay),
      ])
      setUsSummary(summary)
      setUsHoldings(holdings)
    } catch (requestError) {
      setMarketError(requestError.message || 'Unable to load US market data.')
    } finally {
      setMarketLoading(false)
    }
  }, [sortByDay])

  useEffect(() => {
    loadSeeds()
  }, [loadSeeds])

  useEffect(() => {
    if (view === 'us') {
      loadUsMarket()
    }
  }, [view, loadUsMarket])

  const thaiMarket = useMemo(() => {
    if (!marketSeeds?.thai) return null
    return {
      ...marketSeeds.thai,
      holdings: (marketSeeds.thai.holdings ?? []).map(normalizeSeedHolding),
    }
  }, [marketSeeds])

  const usMarket = useMemo(() => {
    if (!marketSeeds?.us) return null
    return {
      ...marketSeeds.us,
      title: usSummary?.title ?? marketSeeds.us.title,
      currency: usSummary?.currency ?? marketSeeds.us.currency,
      value: usSummary?.totalValue ?? marketSeeds.us.value ?? 0,
      dayChange: usSummary?.dayChange ?? marketSeeds.us.dayChange ?? 0,
      dayChangePct: usSummary?.dayChangePct ?? marketSeeds.us.dayChangePct ?? 0,
      totalChange: usSummary?.totalChange ?? marketSeeds.us.totalChange ?? 0,
      totalChangePct: usSummary?.totalChangePct ?? marketSeeds.us.totalChangePct ?? 0,
      series: usSummary?.series?.length ? usSummary.series : marketSeeds.us.series,
      candlesticks: usSummary?.candlesticks?.length ? usSummary.candlesticks : marketSeeds.us.candlesticks,
      holdings: usHoldings,
    }
  }, [marketSeeds, usSummary, usHoldings])

  const openModal = () => {
    setShowModal(true)
    setSearchText('')
    setSearchResults([])
    setSelectedQuote(null)
    setPurchaseDate(new Date().toISOString().slice(0, 10))
    setQuantity('')
    setPurchasePrice('')
    setModalError('')
  }

  const closeModal = () => {
    setShowModal(false)
    setModalError('')
  }

  const searchQuotesByTerm = async (term) => {
    setSearchText(term)
    setSelectedQuote(null)
    setPurchasePrice('')
    if (!term || term.length < 2) {
      setSearchResults([])
      return
    }

    try {
      const results = await searchStocks(term, 'us')
      setSearchResults(results)
    } catch (requestError) {
      setModalError(requestError.message || 'Unable to search tickers right now.')
      setSearchResults([])
    }
  }

  const submitInvestment = async () => {
    if (!selectedQuote || !purchaseDate || !quantity || !purchasePrice) {
      return
    }

    setSubmitting(true)
    setModalError('')
    try {
      await addHolding('us', {
        symbol: selectedQuote.symbol,
        name: selectedQuote.name,
        market: 'us',
        type: selectedQuote.type,
        currency: selectedQuote.currency,
        purchaseDate,
        quantity: Number(quantity),
        purchasePrice: Number(purchasePrice),
      })
      closeModal()
      setExpandedSymbol(selectedQuote.symbol)
      await loadUsMarket()
    } catch (requestError) {
      setModalError(requestError.message || 'Unable to add this investment.')
    } finally {
      setSubmitting(false)
    }
  }

  const currentMarket = view === 'thai' ? thaiMarket : usMarket

  return (
    <>
      <div className="tab-switch wide">
        <button className={`ui-button ui-button--lg ${view === 'overview' ? 'active' : ''}`} onClick={() => setView('overview')}>
          Overview
        </button>
        <button className={`ui-button ui-button--lg ${view === 'thai' ? 'active' : ''}`} onClick={() => setView('thai')}>
          Thai Market
        </button>
        <button className={`ui-button ui-button--lg ${view === 'us' ? 'active' : ''}`} onClick={() => setView('us')}>
          US Market
        </button>
      </div>

      {metaError ? <div className="status-card error">{metaError}</div> : null}

      {view === 'overview' ? (
        metaLoading ? <div className="status-card">Loading stock overview...</div> : <StockOverview markets={marketSeeds} />
      ) : null}

      {view !== 'overview' && marketError ? <div className="status-card error">{marketError}</div> : null}
      {view === 'us' && marketLoading ? <div className="status-card">Loading US market data...</div> : null}

      {view !== 'overview' && currentMarket && (!marketLoading || view === 'thai') ? (
        <StockMarketDetail
          market={currentMarket}
          readOnly={view === 'thai'}
          sortByDay={sortByDay}
          onSortToggle={() => setSortByDay((current) => !current)}
          onAddInvestment={openModal}
          expandedSymbol={expandedSymbol}
          onTogglePosition={(symbol) => setExpandedSymbol((current) => (current === symbol ? '' : symbol))}
        />
      ) : null}

      {showModal ? (
        <div className="modal ui-modal">
          <div className="modal-content ui-modal__panel liquid-glass liquid-glass--flow ui-panel">
            <div className="modal-header">
              <h3>Add a US investment</h3>
              <button className="ghost ui-button ui-button--icon ui-modal__close" onClick={closeModal}>✕</button>
            </div>

            {modalError ? <div className="status-card error">{modalError}</div> : null}

            <div className="form-row">
              <label>Ticker or company</label>
              <input
                className="input"
                placeholder="Type a ticker or company name"
                value={searchText}
                onChange={(event) => searchQuotesByTerm(event.target.value)}
              />
            </div>

            <div className="suggestions">
              {searchResults.map((quote) => (
                <button
                  type="button"
                  key={quote.symbol}
                  className={`suggestion-row suggestion-button ui-button ui-button--no-shift ${selectedQuote?.symbol === quote.symbol ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedQuote(quote)
                    setPurchasePrice(String(quote.price))
                  }}
                >
                  <div>
                    <p className="row-title">{quote.name}</p>
                    <p className="muted small">
                      {quote.symbol} · {quote.type}
                    </p>
                  </div>
                  <div className={quote.dayChangePct >= 0 ? 'up-text' : 'down-text'}>
                    {quote.currency} {quote.price} ({quote.dayChangePct.toFixed(2)}%)
                  </div>
                </button>
              ))}
              {!searchResults.length ? <p className="muted small suggestions-empty">Start typing to search...</p> : null}
            </div>

            {selectedQuote ? (
              <div className="selected-quote">
                <p className="row-title">{selectedQuote.name}</p>
                <p className="muted small">
                  {selectedQuote.symbol} · Current {selectedQuote.currency} {selectedQuote.price}
                </p>
              </div>
            ) : null}

            <div className="modal-grid">
              <div className="form-row">
                <label>Purchase date</label>
                <input className="input" type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
              </div>
              <div className="form-row">
                <label>Quantity</label>
                <input className="input" type="number" min="0" step="0.0001" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              </div>
              <div className="form-row">
                <label>Purchase price</label>
                <input className="input" type="number" min="0" step="0.01" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} />
              </div>
            </div>

            <div className="modal-actions">
              <button className="ghost ui-button" onClick={closeModal}>Cancel</button>
              <button
                className="primary ui-button ui-button--lg"
                onClick={submitInvestment}
                disabled={!selectedQuote || !purchaseDate || !quantity || !purchasePrice || submitting}
              >
                {submitting ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
