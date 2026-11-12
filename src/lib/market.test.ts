import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  __clearMarketCache,
  loadMarketSnapshot,
  marketIsSimulated,
  parseStaticMarketFile,
  sliceBarsForRange,
  syntheticBars,
  type ChartBar,
} from './market'
import type { Quote } from '../types'

afterEach(() => {
  __clearMarketCache()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function sampleBars(n: number, start = '2024-01-01'): ChartBar[] {
  const bars: ChartBar[] = []
  const startMs = Date.parse(start)
  for (let i = 0; i < n; i++) {
    const close = 100 + i
    bars.push({
      close,
      high: close + 1,
      low: close - 1,
      volume: 1_000_000,
      date: new Date(startMs + i * 86_400_000).toISOString().slice(0, 10),
    })
  }
  return bars
}

describe('sliceBarsForRange', () => {
  it('returns the full series for 2y', () => {
    const bars = sampleBars(10)
    expect(sliceBarsForRange(bars, '2y')).toEqual(bars)
  })

  it('keeps the trailing window for shorter ranges', () => {
    const bars = sampleBars(100)
    const sliced = sliceBarsForRange(bars, '1mo')
    expect(sliced).toHaveLength(22)
    expect(sliced[sliced.length - 1]).toEqual(bars[bars.length - 1])
  })

  it('returns the original array when shorter than the window', () => {
    const bars = sampleBars(5)
    expect(sliceBarsForRange(bars, '3mo')).toEqual(bars)
  })
})

describe('parseStaticMarketFile', () => {
  it('parses a valid static payload into a non-simulated snapshot', () => {
    const bars = sampleBars(5)
    const snap = parseStaticMarketFile('SPY', {
      symbol: 'SPY',
      asOf: '2026-11-12T16:00:00.000Z',
      quote: {
        symbol: 'SPY',
        price: 760.5,
        previousClose: 755,
        changePercent: 0.73,
        high52: 800,
        low52: 400,
        volume: 12,
        asOf: '2026-11-12T16:00:00.000Z',
      },
      bars,
    })
    expect(snap.simulated).toBe(false)
    expect(snap.source).toBe('static')
    expect(snap.quote.price).toBe(760.5)
    expect(snap.quote.simulated).toBe(false)
    expect(snap.asOf).toBe('2026-11-12T16:00:00.000Z')
    expect(snap.bars).toHaveLength(5)
  })

  it('rejects files with too few bars', () => {
    expect(() =>
      parseStaticMarketFile('SPY', { symbol: 'SPY', bars: sampleBars(2) }),
    ).toThrow(/too few bars/i)
  })

  it('fills quote fields from bars when quote is missing', () => {
    const bars = sampleBars(4)
    const snap = parseStaticMarketFile('QQQ', { symbol: 'QQQ', bars })
    expect(snap.quote.price).toBe(bars[bars.length - 1].close)
    expect(snap.quote.previousClose).toBe(bars[bars.length - 2].close)
    expect(snap.simulated).toBe(false)
  })
})

describe('marketIsSimulated', () => {
  it('is true for an empty quote list', () => {
    expect(marketIsSimulated([])).toBe(true)
  })

  it('is true when any quote is simulated', () => {
    const real: Quote = {
      symbol: 'SPY',
      price: 1,
      previousClose: 1,
      changePercent: 0,
      high52: 1,
      low52: 1,
      simulated: false,
    }
    const fake: Quote = { ...real, symbol: 'QQQ', simulated: true }
    expect(marketIsSimulated([real, fake])).toBe(true)
    expect(marketIsSimulated([real])).toBe(false)
  })
})

describe('loadMarketSnapshot fallback', () => {
  it('falls back to synthetic bars when static JSON is missing and not in DEV proxy mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        json: async () => ({}),
      })),
    )
    // import.meta.env.DEV is false under vitest by default (production mode).
    const snap = await loadMarketSnapshot('SPY', '5d')
    expect(snap.simulated).toBe(true)
    expect(snap.source).toBe('synthetic')
    expect(snap.quote.simulated).toBe(true)
    expect(snap.bars.length).toBeGreaterThan(3)
    expect(snap.asOf).toBeNull()
  })

  it('uses static JSON when fetch succeeds', async () => {
    const bars = sampleBars(8)
    const payload = {
      symbol: 'AAPL',
      asOf: '2026-11-12T20:00:00.000Z',
      quote: {
        symbol: 'AAPL',
        price: 270,
        previousClose: 268,
        changePercent: 0.75,
        high52: 300,
        low52: 150,
        volume: 99,
        asOf: '2026-11-12T20:00:00.000Z',
      },
      bars,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(String(url)).toContain('market-data/AAPL.json')
        return {
          ok: true,
          status: 200,
          json: async () => payload,
        }
      }),
    )
    const snap = await loadMarketSnapshot('AAPL', '1mo')
    expect(snap.simulated).toBe(false)
    expect(snap.source).toBe('static')
    expect(snap.quote.price).toBe(270)
    expect(snap.asOf).toBe('2026-11-12T20:00:00.000Z')
  })
})

describe('syntheticBars', () => {
  it('is deterministic per symbol', () => {
    expect(syntheticBars('SPY', '5d')).toEqual(syntheticBars('SPY', '5d'))
    expect(syntheticBars('SPY', '5d')[0].close).not.toEqual(syntheticBars('QQQ', '5d')[0].close)
  })
})
