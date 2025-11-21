import { useMemo, useEffect, useRef } from 'react'
import { createChart, CrosshairMode } from 'lightweight-charts'

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
  // Deprecated in favor of TradingViewChart; kept for compatibility if needed elsewhere.
  return null
}

export function TradingViewChart({ mode = 'line', linePoints = [], candles = [] }) {
  const ref = useRef(null)
  const depKey = JSON.stringify({ mode, linePoints, candles })

  useEffect(() => {
    if (!ref.current) return
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height: 260,
      layout: { background: { color: 'transparent' }, textColor: '#0f172a' },
      grid: { vertLines: { color: 'rgba(15,23,42,0.06)' }, horzLines: { color: 'rgba(15,23,42,0.06)' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
    })

    let series
    if (mode === 'candle' && candles.length) {
      series = chart.addCandlestickSeries({
        upColor: '#16A34A',
        downColor: '#DC2626',
        wickUpColor: '#16A34A',
        wickDownColor: '#DC2626',
        borderVisible: false,
      })
      series.setData(candles)
    } else {
      series = chart.addAreaSeries({
        lineColor: '#2563eb',
        topColor: 'rgba(37, 99, 235, 0.35)',
        bottomColor: 'rgba(37, 99, 235, 0.05)',
        lineWidth: 2,
      })
      series.setData(linePoints)
    }

    const handleResize = () => chart.applyOptions({ width: ref.current.clientWidth })
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [depKey])

  return <div className="tv-chart" ref={ref} />
}
