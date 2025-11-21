import Section from '../components/Section'

export default function ExpensesPage({ expenses }) {
  return (
    <Section title="Expenses" subtitle="Monthly and yearly recurring flows">
      <div className="grid cards-2">
        <div className="card">
          <p className="muted small">Monthly</p>
          {expenses.monthly.map((item) => (
            <div key={item.name} className="row">
              <div>
                <p className="row-title">{item.name}</p>
                <p className="muted small">{item.renewal}</p>
              </div>
              <p className="heavy">{item.amount}</p>
            </div>
          ))}
        </div>
        <div className="card">
          <p className="muted small">Yearly</p>
          {expenses.yearly.map((item) => (
            <div key={item.name} className="row">
              <div>
                <p className="row-title">{item.name}</p>
                <p className="muted small">{item.renewal}</p>
              </div>
              <p className="heavy">{item.amount}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="card note">
        <p className="muted small">Runway</p>
        <h3>{expenses.runway}</h3>
        <p className="muted">Cash and savings cover forward expenses based on current burn.</p>
      </div>
    </Section>
  )
}
