import Section from '../components/Section'

export default function LotteryPage({ entries }) {
  return (
    <Section title="Government Lottery" subtitle="Ticketed draws and potential payouts">
      <div className="grid cards-2">
        {entries.map((entry) => (
          <div key={entry.draw} className="card">
            <p className="muted small">Draw</p>
            <h3>{entry.draw}</h3>
            <p className="muted">Tickets: {entry.tickets}</p>
            <p className="accent">Commitment: {entry.committed}</p>
            <p className="heavy">Estimated payout: {entry.estPayout}</p>
          </div>
        ))}
        <div className="card">
          <p className="muted small">Strategy</p>
          <h3>Cap at 6% of total assets</h3>
          <p className="muted">Auto-reminders 3 days before each draw</p>
        </div>
      </div>
    </Section>
  )
}
