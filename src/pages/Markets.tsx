import { useMemo, useState } from 'react'
import { CompareChart, MiniSpark, PriceChart } from '../components/PriceChart'
import { useApp } from '../context/AppContext'
import { formatMoney, formatPct } from '../lib/storage'
import { UNIVERSE, type AssetClass } from '../types'

const STOCK_CLASSES: AssetClass[] = ['us_equity', 'intl_equity']
const BOND_CLASSES: AssetClass[] = ['bonds']

export function Markets() {
  const { prices, factors } = useApp()
  const stocks = useMemo(() => UNIVERSE.filter((u) => STOCK_CLASSES.includes(u.assetClass)), [])
  const bonds = useMemo(() => UNIVERSE.filter((u) => BOND_CLASSES.includes(u.assetClass)), [])
  const [selected, setSelected] = useState(stocks[0]?.symbol ?? 'SPY')
  const [sleeve, setSleeve] = useState<'stocks' | 'bonds'>('stocks')

  const selectedMeta = UNIVERSE.find((u) => u.symbol === selected)
  const list = sleeve === 'stocks' ? stocks : bonds

  return (
    <div className="page">
      <h1 className="page-title">Markets</h1>
      <p className="page-sub">
        Scrub the chart like a pro terminal — stocks and bonds, clear timeframes, live marks.
      </p>

      <div className="sleeve-toggle" role="tablist" aria-label="Asset sleeve">
        <button
          type="button"
          className={sleeve === 'stocks' ? 'on' : ''}
          onClick={() => {
            setSleeve('stocks')
            setSelected(stocks[0]?.symbol ?? 'SPY')
          }}
        >
          Stocks
        </button>
        <button
          type="button"
          className={sleeve === 'bonds' ? 'on' : ''}
          onClick={() => {
            setSleeve('bonds')
            setSelected(bonds[0]?.symbol ?? 'BND')
          }}
        >
          Bonds
        </button>
      </div>

      <section className="panel balance-block market-hero">
        <PriceChart
          symbol={selected}
          name={selectedMeta?.name}
          accent={sleeve === 'bonds' ? 'bond' : undefined}
          height={300}
        />
      </section>

      <div className="dash-grid" style={{ marginTop: '1rem' }}>
        <section className="panel balance-block">
          <h2 style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>
            {sleeve === 'stocks' ? 'Equity sleeve' : 'Bond sleeve'}
          </h2>
          <div className="list market-list">
            {list.map((u) => {
              const px = prices[u.symbol]
              const f = factors.find((x) => x.symbol === u.symbol)
              const active = selected === u.symbol
              const dayPx = f ? f.momentum1m / 21 : 0 // rough daily proxy from 1m — prefer showing 1m clearly
              return (
                <button
                  type="button"
                  key={u.symbol}
                  className={`market-row ${active ? 'on' : ''}`}
                  onClick={() => setSelected(u.symbol)}
                >
                  <div className="market-row-main">
                    <strong>{u.symbol}</strong>
                    <span className="muted">{u.name}</span>
                  </div>
                  <MiniSpark symbol={u.symbol} />
                  <div className="market-row-px">
                    <div>{px != null ? formatMoney(px) : '—'}</div>
                    <div className={(f?.momentum1m ?? 0) >= 0 ? 'gain' : 'loss'}>
                      {f ? formatPct(f.momentum1m) : dayPx ? formatPct(dayPx) : ''}
                      {f ? <span className="muted"> 1m</span> : null}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="panel balance-block">
          <CompareChart
            stockSymbol={sleeve === 'stocks' ? selected : 'SPY'}
            bondSymbol={sleeve === 'bonds' ? selected : 'BND'}
            height={280}
          />
        </section>
      </div>

      <p className="footer-note">
        Drag or tap across a chart to scrub exact prices. Returns are period-based; bond charts use champagne accents so
        fixed income never fights equity green/red.
      </p>
    </div>
  )
}
