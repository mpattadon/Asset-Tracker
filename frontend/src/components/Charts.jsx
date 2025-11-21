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

export function AreaChart({ points, color = '#3B82F6' }) {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const step = 100 / Math.max(points.length - 1, 1)
  const coords = points
    .map((p, i) => {
      const x = i * step
      const y = 90 - ((p - min) / range) * 70
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg className="area-chart" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={coords} fill="none" stroke={color} strokeWidth="1.6" />
      <polygon points={`${coords} 100,100 0,100`} fill="url(#areaFill)" />
    </svg>
  )
}

export function CandleChart({ candles, colorUp = '#16A34A', colorDown = '#DC2626' }) {
  if (!candles || !candles.length) return null
  const highs = candles.map((c) => c.high)
  const lows = candles.map((c) => c.low)
  const max = Math.max(...highs)
  const min = Math.min(...lows)
  const range = max - min || 1
  const width = 100
  const height = 100
  const padding = 6
  const candleWidth = (width - padding * 2) / candles.length - 2

  const y = (value) => height - ((value - min) / range) * (height - padding * 2) - padding

  return (
    <svg className="candle-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {candles.map((c, i) => {
        const x = padding + i * (candleWidth + 2)
        const isUp = c.close >= c.open
        const wickColor = isUp ? colorUp : colorDown
        const bodyTop = y(Math.max(c.open, c.close))
        const bodyBottom = y(Math.min(c.open, c.close))
        return (
          <g key={i}>
            <line x1={x + candleWidth / 2} x2={x + candleWidth / 2} y1={y(c.high)} y2={y(c.low)} stroke={wickColor} strokeWidth="1.5" />
            <rect
              x={x}
              width={candleWidth}
              y={bodyTop}
              height={Math.max(2, bodyBottom - bodyTop)}
              fill={isUp ? colorUp : colorDown}
              rx="1"
            />
          </g>
        )
      })}
    </svg>
  )
}
