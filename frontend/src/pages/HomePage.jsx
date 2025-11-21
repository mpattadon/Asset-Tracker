import Section from '../components/Section'
import { PieDonut } from '../components/Charts'

export default function HomePage({ cards, allocation }) {
  return (
    <>
      <div className="hero-compact">
        <div>
          <p className="eyebrow">Total assets</p>
          <h1>Your cross-market dashboard</h1>
          <p className="hero-sub">
            Summary of every category with allocations, so you can jump into the specific page you need next.
          </p>
          <div className="chips">
            <span>Overview</span>
            <span>Allocation</span>
            <span>Next steps</span>
          </div>
        </div>
        <div className="glow-card">
          <p className="eyebrow">Net worth</p>
          <h3>THB 14.8M</h3>
          <p className="muted">Across all held assets</p>
          <div className="bar">
            <span style={{ width: '64%' }} />
          </div>
          <div className="hero-meta">
            <div>
              <p className="muted">Invested</p>
              <p className="heavy">THB 10.6M</p>
            </div>
            <div>
              <p className="muted">Cash</p>
              <p className="heavy">THB 2.1M</p>
            </div>
            <div>
              <p className="muted">Alt</p>
              <p className="heavy">THB 2.1M</p>
            </div>
          </div>
        </div>
      </div>

      <Section title="Overview" subtitle="Summary across all holdings">
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
            <PieDonut segments={allocation} label="Allocation" />
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
      </Section>
    </>
  )
}
