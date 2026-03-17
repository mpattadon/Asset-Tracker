import { useEffect, useMemo, useState } from 'react'
import Section from '../components/Section'
import { PieDonut } from '../components/Charts'
import { getAssetSummary } from '../api'

function formatHeroValue(cards, label, fallback = 'THB 0') {
  return cards.find((card) => card.label === label)?.value ?? fallback
}

export default function HomePage() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadSummary() {
      setLoading(true)
      setError('')
      try {
        const result = await getAssetSummary()
        if (!cancelled) {
          setSummary(result)
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message || 'Unable to load summary data.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadSummary()
    return () => {
      cancelled = true
    }
  }, [])

  const cards = useMemo(() => summary?.cards ?? [], [summary])
  const allocation = useMemo(() => summary?.allocation ?? [], [summary])
  const investedPercent = useMemo(() => {
    const equities = allocation.find((item) => item.area === 'Equities')?.percent ?? 0
    const fixedIncome = allocation.find((item) => item.area === 'Fixed Income')?.percent ?? 0
    return Math.min(100, equities + fixedIncome)
  }, [allocation])

  const netWorth = formatHeroValue(cards, 'Net Worth')
  const invested = formatHeroValue(cards, 'Invested')
  const cash = formatHeroValue(cards, 'Cash & Savings')
  const alternatives = formatHeroValue(cards, 'Alternatives')

  return (
    <>
      <div className="hero-compact">
        <div className="hero-copy liquid-glass liquid-glass--budget ui-panel">
          <p className="eyebrow">Total assets</p>
          <h1>Your cross-market dashboard</h1>
          <p className="hero-sub">
            Summary of every category with allocations, so you can jump into the specific page you need next.
          </p>
          <div className="chips">
            <span>Overview</span>
            <span>Allocation</span>
            <span>Live pricing</span>
          </div>
        </div>
        <div className="glow-card liquid-glass liquid-glass--flow">
          <p className="eyebrow">Net worth</p>
          <h3>{loading ? 'Loading...' : netWorth}</h3>
          <p className="muted">Across all held assets</p>
          <div className="bar">
            <span style={{ width: `${investedPercent}%` }} />
          </div>
          <div className="hero-meta">
            <div>
              <p className="muted">Invested</p>
              <p className="heavy">{loading ? '...' : invested}</p>
            </div>
            <div>
              <p className="muted">Cash</p>
              <p className="heavy">{loading ? '...' : cash}</p>
            </div>
            <div>
              <p className="muted">Alt</p>
              <p className="heavy">{loading ? '...' : alternatives}</p>
            </div>
          </div>
        </div>
      </div>

      <Section title="Overview" subtitle="Summary across all holdings">
        {error ? <div className="status-card error">{error}</div> : null}
        {loading ? <div className="status-card">Loading summary data...</div> : null}

        {!loading && !error ? (
          <>
            <div className="grid cards-4">
              {cards.map((card) => (
                <div key={card.label} className="card">
                  <p className="muted small">{card.label}</p>
                  <h3>{card.value}</h3>
                  <p className="accent">{card.delta}</p>
                </div>
              ))}
            </div>
            <div className="allocation">
              <div className="allocation-chart">
                <PieDonut
                  segments={allocation.map((item) => ({
                    label: item.area,
                    value: item.percent,
                    color: item.color,
                  }))}
                  label="Allocation"
                />
              </div>
              <div className="allocation-list">
                <h4>Cut by category</h4>
                <p className="muted">
                  A quick snapshot of the current split before diving into each asset page.
                </p>
                <ul>
                  {allocation.map((item) => (
                    <li key={item.area}>
                      <span className="dot" style={{ background: item.color }} />
                      <span>{item.area}</span>
                      <span className="heavy">{item.percent}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        ) : null}
      </Section>
    </>
  )
}
