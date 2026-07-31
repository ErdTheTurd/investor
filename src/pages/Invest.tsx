import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { UNIVERSE, TARGET_ALLOCATIONS } from '../types'
import { formatMoney, formatPct } from '../lib/storage'

export function Invest() {
  const { state, prices, factors, placeBuy, placeSell, equity } = useApp()
  const [symbol, setSymbol] = useState('SPY')
  const [amount, setAmount] = useState(100)

  const target = TARGET_ALLOCATIONS[state.profile.risk]

  const allocation = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const h of state.holdings) {
      const v = h.shares * (prices[h.symbol] ?? h.avgCost)
      totals[h.assetClass] = (totals[h.assetClass] || 0) + v
    }
    totals.cash = state.cash
    return totals
  }, [state.holdings, state.cash, prices])

  return (
    <div className="page">
      <h1 className="page-title">Invest</h1>
      <p className="page-sub">
        Diversified ETF universe with live factors. Trade manually or hand the wheel to Dunn AI.
      </p>

      <div className="dash-grid">
        <section className="panel balance-block">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>Your positions</h2>
          <div className="list">
            {state.holdings.length === 0 && <p className="muted">No holdings yet.</p>}
            {state.holdings.map((h) => {
              const px = prices[h.symbol] ?? h.avgCost
              const pnl = ((px - h.avgCost) / h.avgCost) * 100
              return (
                <div className="list-row" key={h.symbol}>
                  <div>
                    <strong>
                      {h.symbol} · {h.shares.toFixed(4)} sh
                    </strong>
                    <div className="muted">
                      Avg {formatMoney(h.avgCost)} · Mark {formatMoney(px)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div>{formatMoney(h.shares * px)}</div>
                    <div className={pnl >= 0 ? 'gain' : 'loss'}>{formatPct(pnl)}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="stack" style={{ marginTop: '1.25rem' }}>
            <div className="field">
              <label htmlFor="sym">Symbol</label>
              <select id="sym" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                {UNIVERSE.map((u) => (
                  <option key={u.symbol} value={u.symbol}>
                    {u.symbol} — {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="amt">Amount (USD)</label>
              <input
                id="amt"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
              />
            </div>
            <div className="quick-actions">
              <button className="btn btn-primary" type="button" onClick={() => placeBuy(symbol, amount)}>
                Buy
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => placeSell(symbol, amount)}>
                Sell
              </button>
            </div>
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              Cash {formatMoney(state.cash)} · Equity {formatMoney(equity)}
            </p>
          </div>
        </section>

        <section className="panel balance-block stack">
          <div>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.35rem' }}>Target mix · {state.profile.risk}</h2>
            <p className="muted">Finhabits-style diversified sleeves, tuned to your onboarding.</p>
          </div>
          <div className="list">
            {Object.entries(target).map(([cls, pct]) => {
              const actual = ((allocation[cls] || 0) / Math.max(equity, 1)) * 100
              return (
                <div className="list-row" key={cls}>
                  <div>
                    <strong>{cls.replace('_', ' ')}</strong>
                    <div className="muted">Target {((pct || 0) * 100).toFixed(0)}%</div>
                  </div>
                  <div>{actual.toFixed(1)}%</div>
                </div>
              )
            })}
          </div>

          <div>
            <h3 style={{ fontSize: '1.05rem', margin: '0.5rem 0' }}>Factor radar</h3>
            <div className="factor-grid">
              {factors.slice(0, 6).map((f) => (
                <div className="factor-pill" key={f.symbol}>
                  <strong>{f.symbol}</strong>
                  <span>
                    1m {formatPct(f.momentum1m)} · vol {f.volatility.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
