import { useMemo } from 'react'

export function PieDonut({ segments, label }) {
  const total = useMemo(() => segments.reduce((sum, s) => sum + s.value, 0), [segments])
  let cursor = 0
  const gradient = segments
    .map((segment) => {
      const start = cursor
      cursor += (segment.value / total) * 100
      return `${segment.color} ${start}% ${cursor}%`
    })
    .join(', ')

  return (
    <div className="pie-card">
      <div className="pie" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="pie-hole">
          <span className="pie-total">{total}%</span>
          <span className="pie-label">{label}</span>
        </div>
      </div>
      <div className="legend">
        {segments.map((s) => (
          <div key={s.label} className="legend-row">
            <span className="dot" style={{ background: s.color }} />
            <span>{s.label}</span>
            <span className="muted">{s.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Sparkline({ points, color = '#3B82F6' }) {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const step = 100 / Math.max(points.length - 1, 1)
  const path = points
    .map((p, i) => {
      const x = i * step
      const y = 80 - ((p - min) / range) * 60
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg className="sparkline" viewBox="0 0 100 80" preserveAspectRatio="none">
      <polyline points={path} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
      <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.28" />
        <stop offset="100%" stopColor={color} stopOpacity="0" />
      </linearGradient>
      <polygon points={`${path} 100,80 0,80`} fill="url(#spark)" opacity="0.7" />
    </svg>
  )
}
