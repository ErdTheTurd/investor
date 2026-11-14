#!/usr/bin/env node
/**
 * Fetches Yahoo Finance daily bars + latest quote for every Dunn universe symbol.
 * Writes JSON under public/market-data/ and market-data/ (Pages root).
 * On per-symbol failure, keeps the previous good file instead of wiping it.
 *
 * Usage: node scripts/fetch-market-data.mjs
 * No secrets required — Yahoo chart API is keyless.
 */

import { mkdir, readFile, writeFile, copyFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

/** Must stay in sync with src/types.ts UNIVERSE */
const SYMBOLS = [
  'SPY',
  'QQQ',
  'VTI',
  'VXUS',
  'EFA',
  'BND',
  'TLT',
  'VNQ',
  'GLD',
  'AAPL',
  'MSFT',
  'NVDA',
]

const RANGE = '2y'
const INTERVAL = '1d'
const USER_AGENT =
  'Mozilla/5.0 (compatible; DunnInvesting/1.0; +https://erdtheturd.github.io/investor/; educational-paper-trading)'
const MAX_ATTEMPTS = 4
const BASE_BACKOFF_MS = 800
const BETWEEN_SYMBOLS_MS = 350
const REQUEST_TIMEOUT_MS = 15_000

const PUBLIC_DIR = path.join(ROOT, 'public', 'market-data')
const PAGES_DIR = path.join(ROOT, 'market-data')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function yahooUrl(symbol) {
  const q = new URLSearchParams({ interval: INTERVAL, range: RANGE })
  return `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${q}`
}

function parseChartPayload(symbol, data) {
  const result = data?.chart?.result?.[0]
  if (!result) throw new Error(`Empty chart for ${symbol}`)
  const timestamps = result.timestamp ?? []
  const quote = result.indicators?.quote?.[0]
  if (!quote) throw new Error(`No quote series for ${symbol}`)
  const closes = quote.close ?? []
  const highs = quote.high ?? []
  const lows = quote.low ?? []
  const volumes = quote.volume ?? []
  const bars = []
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i]
    if (close == null || !Number.isFinite(close)) continue
    bars.push({
      close: +close,
      high: +(highs[i] ?? close),
      low: +(lows[i] ?? close),
      volume: +(volumes[i] ?? 0),
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
    })
  }
  if (bars.length < 3) throw new Error(`Too few bars for ${symbol} (${bars.length})`)

  const meta = result.meta ?? {}
  const last = bars[bars.length - 1]
  const prevSession = bars[bars.length - 2] ?? last
  const price = Number(meta.regularMarketPrice ?? last.close)
  // Prefer Yahoo's prior-session close; never chartPreviousClose (that is the
  // first bar of the requested range, e.g. ~2y ago on a 2y chart).
  const previousClose = Number(
    Number.isFinite(Number(meta.previousClose)) ? meta.previousClose : prevSession.close,
  )
  const changePercent =
    previousClose !== 0 ? ((price - previousClose) / previousClose) * 100 : 0
  const high52 = Number(meta.fiftyTwoWeekHigh ?? Math.max(...bars.map((b) => b.high)))
  const low52 = Number(meta.fiftyTwoWeekLow ?? Math.min(...bars.map((b) => b.low)))
  const volume = Number(meta.regularMarketVolume ?? last.volume)
  const asOfMs = Number(meta.regularMarketTime)
  // Only a verified Yahoo quote timestamp counts — never the fetch clock.
  const asOf = Number.isFinite(asOfMs) && asOfMs > 0 ? new Date(asOfMs * 1000).toISOString() : null

  return {
    symbol,
    asOf,
    fetchedAt: new Date().toISOString(),
    source: 'yahoo',
    range: RANGE,
    interval: INTERVAL,
    quote: {
      symbol,
      price,
      previousClose,
      changePercent,
      high52,
      low52,
      volume,
      asOf: asOf ?? undefined,
      simulated: false,
    },
    bars,
  }
}

async function fetchWithRetry(symbol) {
  let lastError
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(yahooUrl(symbol), {
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data?.chart?.error) {
        throw new Error(data.chart.error.description || 'Yahoo chart error')
      }
      return parseChartPayload(symbol, data)
    } catch (err) {
      lastError = err
      const wait = BASE_BACKOFF_MS * 2 ** (attempt - 1)
      console.warn(
        `[${symbol}] attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err instanceof Error ? err.message : err}. backoff ${wait}ms`,
      )
      if (attempt < MAX_ATTEMPTS) await sleep(wait)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function fileExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function writeSymbolFiles(payload) {
  const name = `${payload.symbol}.json`
  const json = `${JSON.stringify(payload, null, 2)}\n`
  const publicPath = path.join(PUBLIC_DIR, name)
  const pagesPath = path.join(PAGES_DIR, name)
  await writeFile(publicPath, json, 'utf8')
  await writeFile(pagesPath, json, 'utf8')
  return { publicPath, pagesPath }
}

async function keepExisting(symbol) {
  const name = `${symbol}.json`
  const publicPath = path.join(PUBLIC_DIR, name)
  const pagesPath = path.join(PAGES_DIR, name)
  const hasPublic = await fileExists(publicPath)
  const hasPages = await fileExists(pagesPath)
  if (hasPublic && !hasPages) await copyFile(publicPath, pagesPath)
  if (hasPages && !hasPublic) await copyFile(pagesPath, publicPath)
  if (hasPublic || hasPages) {
    const raw = await readFile(hasPublic ? publicPath : pagesPath, 'utf8')
    return JSON.parse(raw)
  }
  return null
}

async function main() {
  await mkdir(PUBLIC_DIR, { recursive: true })
  await mkdir(PAGES_DIR, { recursive: true })

  const results = []
  let ok = 0
  let kept = 0
  let failed = 0

  for (const symbol of SYMBOLS) {
    try {
      const payload = await fetchWithRetry(symbol)
      await writeSymbolFiles(payload)
      results.push({
        symbol,
        status: 'ok',
        asOf: payload.asOf,
        price: payload.quote.price,
        bars: payload.bars.length,
      })
      ok += 1
      console.log(`[${symbol}] ok price=${payload.quote.price} bars=${payload.bars.length} asOf=${payload.asOf}`)
    } catch (err) {
      const existing = await keepExisting(symbol)
      if (existing) {
        results.push({
          symbol,
          status: 'kept',
          asOf: existing.asOf ?? null,
          price: existing.quote?.price ?? null,
          bars: existing.bars?.length ?? 0,
          error: err instanceof Error ? err.message : String(err),
        })
        kept += 1
        console.warn(`[${symbol}] kept previous file after fetch failure`)
      } else {
        results.push({
          symbol,
          status: 'failed',
          asOf: null,
          price: null,
          bars: 0,
          error: err instanceof Error ? err.message : String(err),
        })
        failed += 1
        console.error(`[${symbol}] FAILED with no prior file`)
      }
    }
    await sleep(BETWEEN_SYMBOLS_MS)
  }

  const index = {
    asOf: new Date().toISOString(),
    source: 'yahoo',
    range: RANGE,
    interval: INTERVAL,
    symbols: SYMBOLS,
    results,
    summary: { ok, kept, failed, total: SYMBOLS.length },
  }
  const indexJson = `${JSON.stringify(index, null, 2)}\n`
  await writeFile(path.join(PUBLIC_DIR, 'index.json'), indexJson, 'utf8')
  await writeFile(path.join(PAGES_DIR, 'index.json'), indexJson, 'utf8')

  console.log(
    `\nDone. ok=${ok} kept=${kept} failed=${failed}. Wrote ${PUBLIC_DIR} and ${PAGES_DIR}`,
  )
  if (ok === 0) {
    console.error('No symbols fetched successfully.')
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
