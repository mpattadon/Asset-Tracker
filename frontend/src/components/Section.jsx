export default function Section({ title, subtitle, children, actions }) {
  return (
    <section className="section liquid-glass liquid-glass--flow ui-panel">
      <header className="section-header">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h2>{title}</h2>
        </div>
        {actions ? <div className="actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  )
}
