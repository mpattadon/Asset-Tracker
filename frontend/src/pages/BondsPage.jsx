import Section from '../components/Section'

export default function BondsPage({ bonds }) {
  return (
    <Section title="Bonds & Debentures" subtitle="Income ladder by tenor and yield">
      <div className="grid cards-3">
        {bonds.map((bond) => (
          <div key={bond.name} className="card">
            <p className="muted small">Fixed income</p>
            <h3>{bond.name}</h3>
            <p className="accent">{bond.yield} coupon</p>
            <div className="pair">
              <span className="muted">Amount</span>
              <span className="heavy">{bond.amount}</span>
            </div>
            <div className="pair">
              <span className="muted">Duration</span>
              <span className="heavy">{bond.duration}</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
