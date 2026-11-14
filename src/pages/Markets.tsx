import { useMemo, useState } from 'react'
import { CompareChart, MiniSpark, PriceChart } from '../components/PriceChart'
import { useApp } from '../context/AppContext'
import { formatMoney, formatPct } from '../lib/storage'
import { UNIVERSE, type AssetClass } from '../types'

const STOCK_CLASSES: AssetClass[] = ['us_equity', 'intl_equity']
const BOND_CLASSES: AssetClass[] = ['bonds']

export function Markets() {
  const { prices, quotes, factors, marketSimulated, marketAsOfLabel } = useApp()
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
        Stock and bond prices by timeframe
        {marketSimulated
          ? '. Marks are simulated until Yahoo snapshots load.'
          : `, Yahoo marks as of ${marketAsOfLabel}.`}
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

      <div className="dash-grid mt-4">
        <section className="panel balance-block">
          <h2 className="panel-title">{sleeve === 'stocks' ? 'Equities' : 'Bonds'}</h2>
          <div className="list market-list">
            {list.map((u) => {
              const px = prices[u.symbol]
              const f = factors.find((x) => x.symbol === u.symbol)
              const active = selected === u.symbol
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
                      {f ? formatPct(f.momentum1m) : ''}
                      {f ? <span className="muted"> 1m</span> : null}
                    </div>
                    {quotes[u.symbol]?.simulated ? (
                      <div className="sim-tag">Simulated</div>
                    ) : quotes[u.symbol]?.asOf ? (
                      <div className="muted asof-mini">
                        as of{' '}
                        {new Date(quotes[u.symbol].asOf!).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                    ) : null}
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
        Drag or tap a chart to see the price on a specific date. Bond charts use a tan line so they are not
        mistaken for equity gains or losses.
      </p>
    </div>
  )
}
