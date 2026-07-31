import type { Quote } from '../types'
import { UNIVERSE } from '../types'

export interface ChartBar {
  close: number
  high: number
  low: number
  volume: number
  date: string
}

export type ChartRange = '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y'

export const CHART_RANGES: { id: ChartRange; label: string }[] = [
  { id: '5d', label: '1W' },
  { id: '1mo', label: '1M' },
  { id: '3mo', label: '3M' },
  { id: '6mo', label: '6M' },
  { id: '1y', label: '1Y' },
  { id: '2y', label: '2Y' },
]

const cache = new Map<string, { at: number; bars: ChartBar[]; quote: Quote }>()
const TTL = 60_000

function cacheKey(symbol: string, range: ChartRange) {
  return `${symbol}:${range}`
}

function intervalForRange(range: ChartRange) {
  return range === '5d' ? '1d' : '1d'
}

async function fetchYahooChart(symbol: string, range: ChartRange = '3mo'): Promise<ChartBar[]> {
  const yahooPath = `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${intervalForRange(range)}&range=${range}`
  const candidates = [
    `/api/yahoo${yahooPath}`,
    `https://corsproxy.io/?${encodeURIComponent(`https://query2.finance.yahoo.com${yahooPath}`)}`,
  ]

  let lastError: unknown
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`Yahoo ${symbol} ${res.status}`)
      const data = await res.json()
      const result = data?.chart?.result?.[0]
      if (!result) throw new Error('Empty chart')
      const timestamps: number[] = result.timestamp ?? []
      const quote = result.indicators?.quote?.[0]
      const closes: (number | null)[] = quote?.close ?? []
      const highs: (number | null)[] = quote?.high ?? []
      const lows: (number | null)[] = quote?.low ?? []
      const volumes: (number | null)[] = quote?.volume ?? []
      const bars: ChartBar[] = []
      for (let i = 0; i < timestamps.length; i++) {
        const close = closes[i]
        if (close == null) continue
        bars.push({
          close,
          high: highs[i] ?? close,
          low: lows[i] ?? close,
          volume: volumes[i] ?? 0,
          date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
        })
      }
      if (bars.length < 3) throw new Error('too few bars')
      return bars
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Yahoo fetch failed')
}

function daysForRange(range: ChartRange) {
  switch (range) {
    case '5d':
      return 7
    case '1mo':
      return 22
    case '3mo':
      return 66
    case '6mo':
      return 132
    case '1y':
      return 252
    case '2y':
      return 504
  }
}

/** Seeded fallback so the app still works if market APIs throttle. */
function syntheticBars(symbol: string, range: ChartRange = '3mo'): ChartBar[] {
  const days = daysForRange(range)
  let hash = 0
  for (const c of symbol) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  const baseMap: Record<string, number> = {
    SPY: 560,
    QQQ: 490,
    VTI: 280,
    VXUS: 65,
    EFA: 85,
    BND: 74,
    TLT: 92,
    VNQ: 95,
    GLD: 240,
    AAPL: 230,
    MSFT: 430,
    NVDA: 135,
  }
  let price = baseMap[symbol] ?? 100 + (hash % 80)
  const bars: ChartBar[] = []
  const now = Date.now()
  for (let i = days; i >= 0; i--) {
    const drift = ((hash % 7) - 3) * 0.0004
    const shock = Math.sin((hash + i) * 0.37) * 0.012 + Math.cos((hash + i) * 0.11) * 0.008
    price = Math.max(1, price * (1 + drift + shock))
    bars.push({
      close: +price.toFixed(2),
      high: +(price * 1.008).toFixed(2),
      low: +(price * 0.992).toFixed(2),
      volume: 1_000_000 + (hash % 500_000),
      date: new Date(now - i * 86_400_000).toISOString().slice(0, 10),
    })
  }
  return bars
}

function quoteFromBars(symbol: string, bars: ChartBar[]): Quote {
  const last = bars[bars.length - 1]
  const prev = bars[bars.length - 2] ?? last
  return {
    symbol,
    price: last.close,
    previousClose: prev.close,
    changePercent: ((last.close - prev.close) / prev.close) * 100,
    high52: Math.max(...bars.map((b) => b.high)),
    low52: Math.min(...bars.map((b) => b.low)),
    volume: last.volume,
  }
}

export async function getBars(symbol: string, range: ChartRange = '3mo'): Promise<ChartBar[]> {
  const key = cacheKey(symbol, range)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.bars
  try {
    const bars = await fetchYahooChart(symbol, range)
    cache.set(key, { at: Date.now(), bars, quote: quoteFromBars(symbol, bars) })
    // Also refresh default quote cache used by portfolio marks
    const defKey = cacheKey(symbol, '3mo')
    if (range === '3mo' || !cache.has(defKey)) {
      cache.set(defKey, { at: Date.now(), bars, quote: quoteFromBars(symbol, bars) })
    }
    return bars
  } catch {
    const bars = syntheticBars(symbol, range)
    cache.set(key, { at: Date.now(), bars, quote: quoteFromBars(symbol, bars) })
    return bars
  }
}

export async function getQuote(symbol: string): Promise<Quote> {
  await getBars(symbol, '3mo')
  return cache.get(cacheKey(symbol, '3mo'))!.quote
}

export async function getQuotes(symbols: string[] = UNIVERSE.map((u) => u.symbol)): Promise<Quote[]> {
  const concurrency = 4
  const results: Quote[] = []
  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency)
    const settled = await Promise.allSettled(
      batch.map((symbol) =>
        Promise.race([
          getQuote(symbol),
          new Promise<Quote>((_, reject) => {
            window.setTimeout(() => reject(new Error(`timeout ${symbol}`)), 4500)
          }),
        ]),
      ),
    )
    for (const item of settled) {
      if (item.status === 'fulfilled') results.push(item.value)
    }
  }
  return results
}

export function pctChange(bars: ChartBar[], lookback: number): number {
  if (bars.length < lookback + 1) return 0
  const a = bars[bars.length - 1].close
  const b = bars[bars.length - 1 - lookback].close
  return ((a - b) / b) * 100
}

export function rangeReturn(bars: ChartBar[]): number {
  if (bars.length < 2) return 0
  const a = bars[bars.length - 1].close
  const b = bars[0].close
  return ((a - b) / b) * 100
}

export function realizedVol(bars: ChartBar[], window = 21): number {
  const slice = bars.slice(-window - 1)
  if (slice.length < 5) return 0
  const rets: number[] = []
  for (let i = 1; i < slice.length; i++) {
    rets.push(Math.log(slice[i].close / slice[i - 1].close))
  }
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length
  return Math.sqrt(variance) * Math.sqrt(252) * 100
}

/** Normalize multiple series to 100 at start for comparison charts. */
export function normalizeSeries(bars: ChartBar[]): { date: string; value: number }[] {
  if (!bars.length) return []
  const base = bars[0].close || 1
  return bars.map((b) => ({ date: b.date, value: (b.close / base) * 100 }))
}
