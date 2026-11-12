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

export type MarketSource = 'static' | 'yahoo-proxy' | 'synthetic'

export interface MarketSnapshot {
  bars: ChartBar[]
  quote: Quote
  simulated: boolean
  asOf: string | null
  source: MarketSource
}

export const CHART_RANGES: { id: ChartRange; label: string }[] = [
  { id: '5d', label: '1W' },
  { id: '1mo', label: '1M' },
  { id: '3mo', label: '3M' },
  { id: '6mo', label: '6M' },
  { id: '1y', label: '1Y' },
  { id: '2y', label: '2Y' },
]

const cache = new Map<string, { at: number; snapshot: MarketSnapshot }>()
const TTL = 60_000

function cacheKey(symbol: string, range: ChartRange) {
  return `${symbol}:${range}`
}

function intervalForRange(range: ChartRange) {
  return range === '5d' ? '1d' : '1d'
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

/** Slice a long daily series down to the requested chart range (trading-day approx). */
export function sliceBarsForRange(bars: ChartBar[], range: ChartRange): ChartBar[] {
  if (range === '2y') return bars
  const n = daysForRange(range)
  if (bars.length <= n) return bars
  return bars.slice(-n)
}

export interface StaticMarketFile {
  symbol: string
  asOf?: string
  quote?: Partial<Quote> & { price?: number }
  bars?: ChartBar[]
}

/** Validate and normalize a static market-data JSON payload. */
export function parseStaticMarketFile(symbol: string, data: unknown): MarketSnapshot {
  if (!data || typeof data !== 'object') throw new Error(`Invalid market file for ${symbol}`)
  const file = data as StaticMarketFile
  const bars = Array.isArray(file.bars) ? file.bars.filter(isValidBar) : []
  if (bars.length < 3) throw new Error(`Static file for ${symbol} has too few bars`)

  const last = bars[bars.length - 1]
  const prev = bars[bars.length - 2] ?? last
  const q = file.quote ?? {}
  const price = Number(q.price ?? last.close)
  const previousClose = Number(q.previousClose ?? prev.close)
  const changePercent =
    q.changePercent != null
      ? Number(q.changePercent)
      : previousClose !== 0
        ? ((price - previousClose) / previousClose) * 100
        : 0
  const asOf =
    (typeof q.asOf === 'string' && q.asOf) ||
    (typeof file.asOf === 'string' && file.asOf) ||
    null

  const quote: Quote = {
    symbol,
    price,
    previousClose,
    changePercent,
    high52: Number(q.high52 ?? Math.max(...bars.map((b) => b.high))),
    low52: Number(q.low52 ?? Math.min(...bars.map((b) => b.low))),
    volume: Number(q.volume ?? last.volume),
    asOf: asOf ?? undefined,
    simulated: false,
  }

  return {
    bars,
    quote,
    simulated: false,
    asOf,
    source: 'static',
  }
}

function isValidBar(bar: unknown): bar is ChartBar {
  if (!bar || typeof bar !== 'object') return false
  const b = bar as ChartBar
  return (
    typeof b.close === 'number' &&
    Number.isFinite(b.close) &&
    typeof b.date === 'string' &&
    b.date.length >= 8
  )
}

function staticUrl(symbol: string) {
  const base = import.meta.env.BASE_URL || '/'
  const root = base.endsWith('/') ? base : `${base}/`
  return `${root}market-data/${encodeURIComponent(symbol)}.json`
}

async function loadStaticMarket(symbol: string): Promise<MarketSnapshot> {
  const res = await fetch(staticUrl(symbol), {
    headers: { Accept: 'application/json' },
    cache: 'no-cache',
  })
  if (!res.ok) throw new Error(`Static ${symbol} ${res.status}`)
  const data: unknown = await res.json()
  return parseStaticMarketFile(symbol, data)
}

function parseYahooChart(data: unknown): ChartBar[] {
  const root = data as {
    chart?: { result?: Array<{
      timestamp?: number[]
      indicators?: { quote?: Array<{
        close?: (number | null)[]
        high?: (number | null)[]
        low?: (number | null)[]
        volume?: (number | null)[]
      }> }
      meta?: {
        regularMarketPrice?: number
        regularMarketTime?: number
        chartPreviousClose?: number
        previousClose?: number
        fiftyTwoWeekHigh?: number
        fiftyTwoWeekLow?: number
        regularMarketVolume?: number
      }
    }> }
  }
  const result = root?.chart?.result?.[0]
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
}

function quoteFromYahoo(symbol: string, bars: ChartBar[], data: unknown): Quote {
  const meta = (data as { chart?: { result?: Array<{ meta?: Record<string, number> }> } })
    ?.chart?.result?.[0]?.meta
  const last = bars[bars.length - 1]
  const prev = bars[bars.length - 2] ?? last
  const price = Number(meta?.regularMarketPrice ?? last.close)
  const previousClose = Number(meta?.chartPreviousClose ?? meta?.previousClose ?? prev.close)
  const asOfMs = Number(meta?.regularMarketTime)
  const asOf = Number.isFinite(asOfMs) ? new Date(asOfMs * 1000).toISOString() : new Date().toISOString()
  return {
    symbol,
    price,
    previousClose,
    changePercent: previousClose !== 0 ? ((price - previousClose) / previousClose) * 100 : 0,
    high52: Number(meta?.fiftyTwoWeekHigh ?? Math.max(...bars.map((b) => b.high))),
    low52: Number(meta?.fiftyTwoWeekLow ?? Math.min(...bars.map((b) => b.low))),
    volume: Number(meta?.regularMarketVolume ?? last.volume),
    asOf,
    simulated: false,
  }
}

/** Dev-only Vite proxy to Yahoo. Never used on GitHub Pages. */
async function fetchYahooViaDevProxy(symbol: string, range: ChartRange = '2y'): Promise<MarketSnapshot> {
  if (!import.meta.env.DEV) throw new Error('Yahoo proxy is dev-only')
  const yahooPath = `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${intervalForRange(range)}&range=${range}`
  const res = await fetch(`/api/yahoo${yahooPath}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Yahoo ${symbol} ${res.status}`)
  const data: unknown = await res.json()
  const bars = parseYahooChart(data)
  const quote = quoteFromYahoo(symbol, bars, data)
  return {
    bars,
    quote,
    simulated: false,
    asOf: quote.asOf ?? null,
    source: 'yahoo-proxy',
  }
}

/** Seeded fallback so the app still works if market files are missing. */
export function syntheticBars(symbol: string, range: ChartRange = '3mo'): ChartBar[] {
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

export function quoteFromBars(symbol: string, bars: ChartBar[], simulated = false): Quote {
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
    asOf: undefined,
    simulated,
  }
}

function syntheticSnapshot(symbol: string, range: ChartRange): MarketSnapshot {
  const bars = syntheticBars(symbol, range)
  return {
    bars,
    quote: quoteFromBars(symbol, bars, true),
    simulated: true,
    asOf: null,
    source: 'synthetic',
  }
}

/**
 * Resolve market data for a symbol.
 * Order: static JSON (Pages + preview) → Vite Yahoo proxy (dev only) → synthetic.
 */
export async function loadMarketSnapshot(
  symbol: string,
  range: ChartRange = '2y',
): Promise<MarketSnapshot> {
  try {
    const staticSnap = await loadStaticMarket(symbol)
    return {
      ...staticSnap,
      bars: sliceBarsForRange(staticSnap.bars, range),
      quote: {
        ...staticSnap.quote,
        // Recompute high/low from sliced bars only when range is shorter? Keep file quote.
      },
    }
  } catch {
    /* try proxy next in dev */
  }

  if (import.meta.env.DEV) {
    try {
      const proxySnap = await fetchYahooViaDevProxy(symbol, range === '2y' ? '2y' : range)
      return {
        ...proxySnap,
        bars: sliceBarsForRange(proxySnap.bars, range),
      }
    } catch {
      /* fall through */
    }
  }

  return syntheticSnapshot(symbol, range)
}

function withRange(snapshot: MarketSnapshot, range: ChartRange): MarketSnapshot {
  const bars = sliceBarsForRange(snapshot.bars, range)
  if (snapshot.simulated) {
    return {
      ...snapshot,
      bars,
      quote: quoteFromBars(snapshot.quote.symbol, bars, true),
    }
  }
  return { ...snapshot, bars }
}

export async function getMarketSnapshot(
  symbol: string,
  range: ChartRange = '3mo',
): Promise<MarketSnapshot> {
  const key = cacheKey(symbol, range)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.snapshot

  // Prefer a long series cache entry so range switches don't refetch.
  const longKey = cacheKey(symbol, '2y')
  const longHit = cache.get(longKey)
  if (longHit && Date.now() - longHit.at < TTL && !longHit.snapshot.simulated) {
    const sliced = withRange(longHit.snapshot, range)
    cache.set(key, { at: Date.now(), snapshot: sliced })
    return sliced
  }

  const loaded = await loadMarketSnapshot(symbol, '2y')
  cache.set(longKey, { at: Date.now(), snapshot: loaded })
  const sliced = withRange(loaded, range)
  cache.set(key, { at: Date.now(), snapshot: sliced })
  // Keep default quote cache warm for portfolio marks
  const defKey = cacheKey(symbol, '3mo')
  if (range === '3mo' || !cache.has(defKey)) {
    cache.set(defKey, { at: Date.now(), snapshot: withRange(loaded, '3mo') })
  }
  return sliced
}

export async function getBars(symbol: string, range: ChartRange = '3mo'): Promise<ChartBar[]> {
  const snap = await getMarketSnapshot(symbol, range)
  return snap.bars
}

export async function getQuote(symbol: string): Promise<Quote> {
  const snap = await getMarketSnapshot(symbol, '3mo')
  return snap.quote
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
            window.setTimeout(() => reject(new Error(`timeout ${symbol}`)), 8000)
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

/** True when any quote is marked simulated (or missing as-of from a real source). */
export function marketIsSimulated(quotes: Quote[]): boolean {
  if (!quotes.length) return true
  return quotes.some((q) => q.simulated === true)
}

export function formatAsOf(asOf: string | null | undefined): string {
  if (!asOf) return 'unknown'
  const d = new Date(asOf)
  if (Number.isNaN(d.getTime())) return asOf
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
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

/** Test helper: clear in-memory market cache. */
export function __clearMarketCache() {
  cache.clear()
}
