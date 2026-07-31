import type { FactorSnapshot, RiskProfile } from '../types'
import { UNIVERSE } from '../types'
import { getBars, pctChange, realizedVol } from './market'

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n))
}

function trendStrength(bars: Awaited<ReturnType<typeof getBars>>): number {
  const n = Math.min(50, bars.length)
  const slice = bars.slice(-n)
  if (slice.length < 10) return 50
  const first = slice[0].close
  const last = slice[slice.length - 1].close
  let up = 0
  for (let i = 1; i < slice.length; i++) if (slice[i].close >= slice[i - 1].close) up++
  const direction = ((last - first) / first) * 100
  return clamp(50 + direction * 2 + (up / slice.length - 0.5) * 40)
}

export async function buildFactorSnapshot(symbol: string, benchmarkBars?: Awaited<ReturnType<typeof getBars>>): Promise<FactorSnapshot> {
  const meta = UNIVERSE.find((u) => u.symbol === symbol)
  const bars = await getBars(symbol)
  const last = bars[bars.length - 1]
  const m1 = pctChange(bars, 21)
  const m3 = pctChange(bars, 63)
  const vol = realizedVol(bars, 21)
  const high = Math.max(...bars.map((b) => b.high))
  const drawdown = ((last.close - high) / high) * 100
  const avgVol =
    bars.slice(-21).reduce((s, b) => s + b.volume, 0) / Math.max(1, Math.min(21, bars.length))
  const recentVol = bars.slice(-5).reduce((s, b) => s + b.volume, 0) / Math.max(1, Math.min(5, bars.length))
  const volumePressure = clamp(50 + ((recentVol - avgVol) / Math.max(avgVol, 1)) * 40)
  let relativeStrength = 50
  if (benchmarkBars && benchmarkBars.length > 21) {
    const bench1m = pctChange(benchmarkBars, 21)
    relativeStrength = clamp(50 + (m1 - bench1m) * 3)
  }
  // Valuation proxy from mean-reversion vs 60d average (not PE — free data constraint)
  const avg60 = bars.slice(-60).reduce((s, b) => s + b.close, 0) / Math.min(60, bars.length)
  const valuationProxy = clamp(50 - ((last.close - avg60) / avg60) * 200)
  const macroSensitivity = meta?.assetClass === 'bonds' ? 70 : meta?.assetClass === 'commodities' ? 65 : 45
  const liquidityScore = clamp(40 + Math.log10(Math.max(last.volume, 1)) * 8)
  const sentimentProxy = clamp(50 + m1 * 1.5 + volumePressure * 0.15 - Math.abs(drawdown) * 0.4)
  const regimeFit = clamp(55 + m3 * 0.8 - vol * 0.35)

  return {
    symbol,
    name: meta?.name ?? symbol,
    price: last.close,
    momentum1m: +m1.toFixed(2),
    momentum3m: +m3.toFixed(2),
    volatility: +vol.toFixed(2),
    trendStrength: +trendStrength(bars).toFixed(1),
    relativeStrength: +relativeStrength.toFixed(1),
    volumePressure: +volumePressure.toFixed(1),
    drawdownFromHigh: +drawdown.toFixed(2),
    valuationProxy: +valuationProxy.toFixed(1),
    macroSensitivity,
    liquidityScore: +liquidityScore.toFixed(1),
    sentimentProxy: +sentimentProxy.toFixed(1),
    regimeFit: +regimeFit.toFixed(1),
  }
}

export async function buildUniverseFactors(): Promise<FactorSnapshot[]> {
  const spy = await getBars('SPY')
  const settled = await Promise.allSettled(UNIVERSE.map((u) => buildFactorSnapshot(u.symbol, spy)))
  return settled.filter((r): r is PromiseFulfilledResult<FactorSnapshot> => r.status === 'fulfilled').map((r) => r.value)
}

export function scoreForRisk(f: FactorSnapshot, risk: RiskProfile): number {
  const weights =
    risk === 'conservative'
      ? { mom: 0.1, vol: 0.35, val: 0.2, trend: 0.1, dd: 0.15, liq: 0.1 }
      : risk === 'balanced'
        ? { mom: 0.2, vol: 0.2, val: 0.15, trend: 0.2, dd: 0.1, liq: 0.15 }
        : risk === 'growth'
          ? { mom: 0.3, vol: 0.1, val: 0.1, trend: 0.25, dd: 0.1, liq: 0.15 }
          : { mom: 0.35, vol: 0.05, val: 0.05, trend: 0.3, dd: 0.1, liq: 0.15 }

  const momScore = clamp(50 + f.momentum1m * 2 + f.momentum3m)
  const volScore = clamp(100 - f.volatility)
  const ddScore = clamp(80 + f.drawdownFromHigh)
  return (
    momScore * weights.mom +
    volScore * weights.vol +
    f.valuationProxy * weights.val +
    f.trendStrength * weights.trend +
    ddScore * weights.dd +
    f.liquidityScore * weights.liq
  )
}

export function factorsToPromptBlock(factors: FactorSnapshot[]): string {
  return factors
    .map(
      (f) =>
        `${f.symbol} (${f.name}) @ $${f.price.toFixed(2)} | 1m ${f.momentum1m}% | 3m ${f.momentum3m}% | vol ${f.volatility}% | trend ${f.trendStrength} | RS ${f.relativeStrength} | volPressure ${f.volumePressure} | DD ${f.drawdownFromHigh}% | valueProxy ${f.valuationProxy} | macroSens ${f.macroSensitivity} | liquidity ${f.liquidityScore} | sentiment ${f.sentimentProxy} | regime ${f.regimeFit}`,
    )
    .join('\n')
}
