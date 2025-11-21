import { useState } from 'react'
import Section from '../components/Section'
import { Sparkline } from '../components/Charts'

export default function BanksPage({ banks }) {
  const [tab, setTab] = useState('thai')

  return (
    <Section
      title="Banks"
      subtitle="Split between Thai and UK institutions"
      actions={
        <div className="tab-switch">
          <button className={tab === 'thai' ? 'active' : ''} onClick={() => setTab('thai')}>
            Thai Banks
          </button>
          <button className={tab === 'uk' ? 'active' : ''} onClick={() => setTab('uk')}>
            UK Banks
          </button>
        </div>
      }
    >
      <div className="grid cards-2">
        <div className="card">
          <p className="muted small">Total balance</p>
          <h3>{banks[tab].total}</h3>
          <p className="muted">Recent flow and savings velocity</p>
          <Sparkline points={banks[tab].series} color="#10B981" />
        </div>
        <div className="card">
          <p className="muted small">Accounts</p>
          <div className="stack-list">
            {banks[tab].accounts.map((acct) => (
              <div key={acct.bank} className="row">
                <div>
                  <p className="row-title">{acct.bank}</p>
                  <p className="muted small">{acct.change}</p>
                </div>
                <p className="heavy">{acct.balance}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}
