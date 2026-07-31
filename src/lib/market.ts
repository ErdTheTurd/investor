import type { Quote } from '../types'
import { UNIVERSE } from '../types'

interface ChartBar {
  close: number
  high: number
  low: number
  volume: number
  date: string
}

const cache = new Map<string, { at: number; bars: ChartBar[]; quote: Quote }>()
const TTL = 60_000

async function fetchYahooChart(symbol: string, range = '3mo'): Promise<ChartBar[]> {
  const url = `/api/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`
  const res = await fetch(url)
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
  return bars
}

/** Seeded fallback so the app still works if market APIs throttle. */
function syntheticBars(symbol: string, days = 66): ChartBar[] {
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

export async function getBars(symbol: string): Promise<ChartBar[]> {
  const hit = cache.get(symbol)
  if (hit && Date.now() - hit.at < TTL) return hit.bars
  try {
    const bars = await fetchYahooChart(symbol)
    if (bars.length < 5) throw new Error('too few bars')
    const last = bars[bars.length - 1]
    const prev = bars[bars.length - 2] ?? last
    const highs = bars.map((b) => b.high)
    const lows = bars.map((b) => b.low)
    const quote: Quote = {
      symbol,
      price: last.close,
      previousClose: prev.close,
      changePercent: ((last.close - prev.close) / prev.close) * 100,
      high52: Math.max(...highs),
      low52: Math.min(...lows),
      volume: last.volume,
    }
    cache.set(symbol, { at: Date.now(), bars, quote })
    return bars
  } catch {
    const bars = syntheticBars(symbol)
    const last = bars[bars.length - 1]
    const prev = bars[bars.length - 2]
    const quote: Quote = {
      symbol,
      price: last.close,
      previousClose: prev.close,
      changePercent: ((last.close - prev.close) / prev.close) * 100,
      high52: Math.max(...bars.map((b) => b.high)),
      low52: Math.min(...bars.map((b) => b.low)),
      volume: last.volume,
    }
    cache.set(symbol, { at: Date.now(), bars, quote })
    return bars
  }
}

export async function getQuote(symbol: string): Promise<Quote> {
  await getBars(symbol)
  return cache.get(symbol)!.quote
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

export type { ChartBar }
