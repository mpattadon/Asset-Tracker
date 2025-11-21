import Section from '../components/Section'

export default function FundsPage({ funds }) {
  return (
    <Section title="Mutual Funds" subtitle="Across growth, dividend, and balanced mandates">
      <div className="grid cards-3">
        {funds.map((fund) => (
          <div key={fund.name} className="card">
            <p className="muted small">Fund</p>
            <h3>{fund.name}</h3>
            <p className="muted">{fund.exposure}</p>
            <p className="accent">{fund.change}</p>
            <div className="pair">
              <span className="muted">NAV held</span>
              <span className="heavy">{fund.nav}</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
