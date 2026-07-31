import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  CHART_RANGES,
  getBars,
  rangeReturn,
  type ChartBar,
  type ChartRange,
} from '../lib/market'
import { formatMoney, formatPct } from '../lib/storage'

type Point = { x: number; y: number; bar: ChartBar; idx: number }

interface PriceChartProps {
  symbol: string
  name?: string
  accent?: 'gain' | 'loss' | 'neutral' | 'bond'
  height?: number
  showHeader?: boolean
  defaultRange?: ChartRange
  onPrice?: (price: number, changePct: number) => void
}

function niceTicks(min: number, max: number, count = 4) {
  const span = Math.max(max - min, 0.0001)
  const step = span / count
  const mag = 10 ** Math.floor(Math.log10(step))
  const norm = step / mag
  const niceStep = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const start = Math.ceil(min / niceStep) * niceStep
  const ticks: number[] = []
  for (let v = start; v <= max + niceStep * 0.01; v += niceStep) ticks.push(v)
  return ticks
}

export function PriceChart({
  symbol,
  name,
  accent,
  height = 280,
  showHeader = true,
  defaultRange = '3mo',
  onPrice,
}: PriceChartProps) {
  const gid = useId().replace(/:/g, '')
  const [range, setRange] = useState<ChartRange>(defaultRange)
  const [bars, setBars] = useState<ChartBar[]>([])
  const [loading, setLoading] = useState(true)
  const [hover, setHover] = useState<Point | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setHover(null)
    void getBars(symbol, range).then((data) => {
      if (cancelled) return
      setBars(data)
      setLoading(false)
      if (data.length >= 2) {
        onPrice?.(data[data.length - 1].close, rangeReturn(data))
      }
    })
    return () => {
      cancelled = true
    }
  }, [symbol, range, onPrice])

  const changePct = useMemo(() => rangeReturn(bars), [bars])
  const positive = changePct >= 0
  const tone = accent === 'bond' ? 'bond' : accent === 'neutral' ? 'neutral' : positive ? 'gain' : 'loss'
  const stroke =
    tone === 'bond' ? '#d4b896' : tone === 'neutral' ? '#7f97a3' : positive ? '#2ecf8f' : '#ef6b5a'
  const fillTop =
    tone === 'bond'
      ? 'rgba(212,184,150,0.32)'
      : tone === 'neutral'
        ? 'rgba(127,151,163,0.25)'
        : positive
          ? 'rgba(46,207,143,0.32)'
          : 'rgba(239,107,90,0.28)'

  const layout = useMemo(() => {
    const W = 640
    const H = height
    const pad = { l: 8, r: 56, t: 18, b: 28 }
    const plotW = W - pad.l - pad.r
    const plotH = H - pad.t - pad.b
    if (bars.length < 2) {
      return { W, H, pad, plotW, plotH, points: [] as Point[], min: 0, max: 1, ticks: [] as number[], line: '', area: '' }
    }
    const closes = bars.map((b) => b.close)
    const min = Math.min(...closes)
    const max = Math.max(...closes)
    const span = Math.max(max - min, max * 0.002)
    const yMin = min - span * 0.08
    const yMax = max + span * 0.08
    const points: Point[] = bars.map((bar, idx) => {
      const x = pad.l + (idx / (bars.length - 1)) * plotW
      const y = pad.t + (1 - (bar.close - yMin) / (yMax - yMin)) * plotH
      return { x, y, bar, idx }
    })
    const line = `M ${points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ')}`
    const area = `${line} L ${points[points.length - 1].x},${pad.t + plotH} L ${points[0].x},${pad.t + plotH} Z`
    return {
      W,
      H,
      pad,
      plotW,
      plotH,
      points,
      min: yMin,
      max: yMax,
      ticks: niceTicks(yMin, yMax),
      line,
      area,
    }
  }, [bars, height])

  const active = hover ?? (layout.points.length ? layout.points[layout.points.length - 1] : null)
  const displayPrice = active?.bar.close ?? bars[bars.length - 1]?.close ?? 0
  const displayDate = active?.bar.date ?? bars[bars.length - 1]?.date ?? ''

  const onMove = (clientX: number) => {
    const svg = svgRef.current
    if (!svg || !layout.points.length) return
    const rect = svg.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * layout.W
    let best = layout.points[0]
    let bestDist = Infinity
    for (const p of layout.points) {
      const d = Math.abs(p.x - x)
      if (d < bestDist) {
        best = p
        bestDist = d
      }
    }
    setHover(best)
  }

  return (
    <div className={`price-chart tone-${tone}`}>
      {showHeader && (
        <div className="price-chart-head">
          <div>
            <div className="price-chart-sym">
              {symbol}
              {name ? <span className="muted"> · {name}</span> : null}
            </div>
            <div className="price-chart-price">{formatMoney(displayPrice)}</div>
            <div className={positive ? 'gain' : 'loss'}>
              {formatPct(changePct)} <span className="muted">over {range}</span>
              {displayDate ? <span className="muted"> · {displayDate}</span> : null}
            </div>
          </div>
          <div className="range-pills" role="tablist" aria-label="Chart timeframe">
            {CHART_RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={range === r.id}
                className={range === r.id ? 'on' : ''}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!showHeader && (
        <div className="range-pills range-pills-right" role="tablist" aria-label="Chart timeframe">
          {CHART_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={range === r.id}
              className={range === r.id ? 'on' : ''}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      <div className="price-chart-canvas" style={{ minHeight: height }}>
        {loading && <div className="price-chart-loading">Loading chart…</div>}
        {!loading && bars.length >= 2 && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${layout.W} ${layout.H}`}
            className="price-chart-svg"
            role="img"
            aria-label={`${symbol} price chart`}
            onMouseMove={(e) => onMove(e.clientX)}
            onMouseLeave={() => setHover(null)}
            onTouchStart={(e) => onMove(e.touches[0].clientX)}
            onTouchMove={(e) => onMove(e.touches[0].clientX)}
          >
            <defs>
              <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fillTop} />
                <stop offset="100%" stopColor="rgba(7,20,31,0)" />
              </linearGradient>
            </defs>

            {layout.ticks.map((t) => {
              const y =
                layout.pad.t +
                (1 - (t - layout.min) / Math.max(layout.max - layout.min, 0.0001)) * layout.plotH
              return (
                <g key={t}>
                  <line
                    x1={layout.pad.l}
                    x2={layout.pad.l + layout.plotW}
                    y1={y}
                    y2={y}
                    className="chart-grid"
                  />
                  <text x={layout.W - 8} y={y + 4} textAnchor="end" className="chart-axis">
                    {t >= 100 ? t.toFixed(0) : t.toFixed(2)}
                  </text>
                </g>
              )
            })}

            <path d={layout.area} fill={`url(#fill-${gid})`} />
            <path
              d={layout.line}
              fill="none"
              stroke={stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="chart-line"
            />

            {active && (
              <g className="chart-crosshair">
                <line
                  x1={active.x}
                  x2={active.x}
                  y1={layout.pad.t}
                  y2={layout.pad.t + layout.plotH}
                  stroke="rgba(232,242,239,0.28)"
                  strokeDasharray="4 4"
                />
                <circle cx={active.x} cy={active.y} r="5" fill={stroke} stroke="#07141f" strokeWidth="2" />
                <g transform={`translate(${Math.min(active.x + 10, layout.W - 110)}, ${Math.max(active.y - 36, 8)})`}>
                  <rect width="100" height="34" rx="8" className="chart-tooltip-bg" />
                  <text x="10" y="14" className="chart-tooltip-text">
                    {formatMoney(active.bar.close)}
                  </text>
                  <text x="10" y="28" className="chart-tooltip-sub">
                    {active.bar.date}
                  </text>
                </g>
              </g>
            )}

            {bars.length > 0 && (
              <>
                <text x={layout.pad.l} y={layout.H - 8} className="chart-axis">
                  {bars[0].date}
                </text>
                <text x={layout.pad.l + layout.plotW} y={layout.H - 8} textAnchor="end" className="chart-axis">
                  {bars[bars.length - 1].date}
                </text>
              </>
            )}
          </svg>
        )}
      </div>
    </div>
  )
}

interface SparkProps {
  symbol: string
  range?: ChartRange
  width?: number
  height?: number
}

export function MiniSpark({ symbol, range = '3mo', width = 96, height = 36 }: SparkProps) {
  const [bars, setBars] = useState<ChartBar[]>([])
  useEffect(() => {
    let cancelled = false
    void getBars(symbol, range).then((b) => {
      if (!cancelled) setBars(b)
    })
    return () => {
      cancelled = true
    }
  }, [symbol, range])

  if (bars.length < 2) {
    return <svg width={width} height={height} aria-hidden />
  }
  const closes = bars.map((b) => b.close)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const span = Math.max(max - min, 0.01)
  const up = closes[closes.length - 1] >= closes[0]
  const d = closes
    .map((c, i) => {
      const x = (i / (closes.length - 1)) * width
      const y = height - ((c - min) / span) * (height - 4) - 2
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className="mini-spark" aria-hidden>
      <path d={d} fill="none" stroke={up ? '#2ecf8f' : '#ef6b5a'} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

interface CompareProps {
  stockSymbol?: string
  bondSymbol?: string
  height?: number
}

/** Stocks vs bonds — both rebased to 100 for an apples-to-apples read. */
export function CompareChart({
  stockSymbol = 'SPY',
  bondSymbol = 'BND',
  height = 260,
}: CompareProps) {
  const [range, setRange] = useState<ChartRange>('1y')
  const [stock, setStock] = useState<ChartBar[]>([])
  const [bond, setBond] = useState<ChartBar[]>([])
  const [loading, setLoading] = useState(true)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gid = useId().replace(/:/g, '')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void Promise.all([getBars(stockSymbol, range), getBars(bondSymbol, range)]).then(([s, b]) => {
      if (cancelled) return
      setStock(s)
      setBond(b)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [stockSymbol, bondSymbol, range])

  const layout = useMemo(() => {
    const W = 640
    const H = height
    const pad = { l: 8, r: 48, t: 16, b: 28 }
    const plotW = W - pad.l - pad.r
    const plotH = H - pad.t - pad.b
    const n = Math.min(stock.length, bond.length)
    if (n < 2) return null
    const s = stock.slice(-n)
    const b = bond.slice(-n)
    const s0 = s[0].close || 1
    const b0 = b[0].close || 1
    const sN = s.map((x) => (x.close / s0) * 100)
    const bN = b.map((x) => (x.close / b0) * 100)
    const min = Math.min(...sN, ...bN)
    const max = Math.max(...sN, ...bN)
    const span = Math.max(max - min, 1)
    const yMin = min - span * 0.08
    const yMax = max + span * 0.08
    const toPts = (vals: number[]) =>
      vals.map((v, i) => {
        const x = pad.l + (i / (vals.length - 1)) * plotW
        const y = pad.t + (1 - (v - yMin) / (yMax - yMin)) * plotH
        return { x, y, v, date: s[i].date }
      })
    const sp = toPts(sN)
    const bp = toPts(bN)
    const line = (pts: { x: number; y: number }[]) =>
      `M ${pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ')}`
    return {
      W,
      H,
      pad,
      plotW,
      plotH,
      sp,
      bp,
      sLine: line(sp),
      bLine: line(bp),
      ticks: niceTicks(yMin, yMax),
      min: yMin,
      max: yMax,
      sRet: sN[sN.length - 1] - 100,
      bRet: bN[bN.length - 1] - 100,
    }
  }, [stock, bond, height])

  const onMove = (clientX: number) => {
    if (!layout || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * layout.W
    let best = 0
    let bestDist = Infinity
    layout.sp.forEach((p, i) => {
      const d = Math.abs(p.x - x)
      if (d < bestDist) {
        best = i
        bestDist = d
      }
    })
    setHoverIdx(best)
  }

  const hi = hoverIdx ?? (layout ? layout.sp.length - 1 : 0)

  return (
    <div className="price-chart tone-neutral compare-chart">
      <div className="price-chart-head">
        <div>
          <div className="price-chart-sym">Stocks vs bonds</div>
          <p className="muted" style={{ marginTop: '0.25rem', maxWidth: '36ch' }}>
            Both start at 100 so you can see which sleeve ran hotter over the period — classic portfolio UX.
          </p>
          {layout && (
            <div className="compare-legend">
              <span className="leg stock">
                {stockSymbol} {formatPct(layout.sRet)}
              </span>
              <span className="leg bond">
                {bondSymbol} {formatPct(layout.bRet)}
              </span>
            </div>
          )}
        </div>
        <div className="range-pills" role="tablist" aria-label="Compare timeframe">
          {CHART_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={range === r.id ? 'on' : ''}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="price-chart-canvas" style={{ minHeight: height }}>
        {loading && <div className="price-chart-loading">Loading comparison…</div>}
        {!loading && layout && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${layout.W} ${layout.H}`}
            className="price-chart-svg"
            role="img"
            aria-label="Stocks versus bonds chart"
            onMouseMove={(e) => onMove(e.clientX)}
            onMouseLeave={() => setHoverIdx(null)}
            onTouchStart={(e) => onMove(e.touches[0].clientX)}
            onTouchMove={(e) => onMove(e.touches[0].clientX)}
          >
            <defs>
              <linearGradient id={`sg-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(46,207,143,0.2)" />
                <stop offset="100%" stopColor="rgba(46,207,143,0)" />
              </linearGradient>
            </defs>
            {layout.ticks.map((t) => {
              const y =
                layout.pad.t +
                (1 - (t - layout.min) / Math.max(layout.max - layout.min, 0.0001)) * layout.plotH
              return (
                <g key={t}>
                  <line
                    x1={layout.pad.l}
                    x2={layout.pad.l + layout.plotW}
                    y1={y}
                    y2={y}
                    className="chart-grid"
                  />
                  <text x={layout.W - 8} y={y + 4} textAnchor="end" className="chart-axis">
                    {t.toFixed(0)}
                  </text>
                </g>
              )
            })}
            <path
              d={`${layout.sLine} L ${layout.sp[layout.sp.length - 1].x},${layout.pad.t + layout.plotH} L ${layout.sp[0].x},${layout.pad.t + layout.plotH} Z`}
              fill={`url(#sg-${gid})`}
            />
            <path d={layout.sLine} fill="none" stroke="#2ecf8f" strokeWidth="2.5" strokeLinecap="round" />
            <path d={layout.bLine} fill="none" stroke="#d4b896" strokeWidth="2.5" strokeLinecap="round" />
            {layout.sp[hi] && (
              <g>
                <line
                  x1={layout.sp[hi].x}
                  x2={layout.sp[hi].x}
                  y1={layout.pad.t}
                  y2={layout.pad.t + layout.plotH}
                  stroke="rgba(232,242,239,0.28)"
                  strokeDasharray="4 4"
                />
                <circle cx={layout.sp[hi].x} cy={layout.sp[hi].y} r="4.5" fill="#2ecf8f" stroke="#07141f" strokeWidth="2" />
                <circle cx={layout.bp[hi].x} cy={layout.bp[hi].y} r="4.5" fill="#d4b896" stroke="#07141f" strokeWidth="2" />
                <g
                  transform={`translate(${Math.min(layout.sp[hi].x + 10, layout.W - 130)}, ${Math.max(Math.min(layout.sp[hi].y, layout.bp[hi].y) - 52, 8)})`}
                >
                  <rect width="120" height="48" rx="8" className="chart-tooltip-bg" />
                  <text x="10" y="16" className="chart-tooltip-sub">
                    {layout.sp[hi].date}
                  </text>
                  <text x="10" y="32" className="chart-tooltip-text" fill="#2ecf8f">
                    {stockSymbol} {layout.sp[hi].v.toFixed(1)}
                  </text>
                  <text x="10" y="44" className="chart-tooltip-text" fill="#d4b896">
                    {bondSymbol} {layout.bp[hi].v.toFixed(1)}
                  </text>
                </g>
              </g>
            )}
          </svg>
        )}
      </div>
    </div>
  )
}
