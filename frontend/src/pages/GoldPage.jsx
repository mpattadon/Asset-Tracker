import Section from '../components/Section'

export default function GoldPage({ positions }) {
  return (
    <Section title="Gold" subtitle="Physical and paper gold stack">
      <div className="grid cards-2">
        {positions.map((g) => (
          <div key={g.type} className="card">
            <p className="muted small">{g.type}</p>
            <h3>{g.value}</h3>
            <p className="muted">Holding: {g.weight}</p>
            <p className="accent">{g.change}</p>
          </div>
        ))}
        <div className="card">
          <p className="muted small">24k spot reference</p>
          <h3>THB 35,800 / baht</h3>
          <p className="muted">Target: accumulate on dips below 35k</p>
          <div className="bar light">
            <span style={{ width: '72%' }} />
          </div>
        </div>
        <div className="card">
          <p className="muted small">Hedge ratio</p>
          <h3>12% of total assets</h3>
          <p className="muted">Aligned with inflation hedge policy (10-15%)</p>
        </div>
      </div>
    </Section>
  )
}
