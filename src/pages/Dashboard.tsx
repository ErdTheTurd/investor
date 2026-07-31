import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { formatMoney, formatPct } from '../lib/storage'
import { CompareChart, MiniSpark, PriceChart } from '../components/PriceChart'

function EquityArea({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <svg className="spark" viewBox="0 0 300 120" role="img" aria-label="Equity chart placeholder" />
  }
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = Math.max(max - min, 1)
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * 300
    const y = 110 - ((p - min) / span) * 90
    return `${x},${y}`
  })
  const line = `M ${coords.join(' L ')}`
  const area = `${line} L 300,120 L 0,120 Z`
  return (
    <svg className="spark" viewBox="0 0 300 120" role="img" aria-label="Equity history">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(31,169,122,0.35)" />
          <stop offset="100%" stopColor="rgba(31,169,122,0)" />
        </linearGradient>
      </defs>
      <path className="area" d={area} />
      <path d={line} />
    </svg>
  )
}

export function Dashboard() {
  const { state, equity, prices, makeDeposit, loadingMarket, refreshMarket } = useApp()
  const [depositAmt, setDepositAmt] = useState(100)
  const [toast, setToast] = useState<string | null>(null)

  const dayChange = useMemo(() => {
    const hist = state.equityHistory
    if (hist.length < 2 || equity <= 0) return 0
    const prev = hist[hist.length - 2]?.value || hist[0].value
    if (!prev) return 0
    return ((equity - prev) / prev) * 100
  }, [state.equityHistory, equity])

  const holdingsPreview = state.holdings.slice(0, 4)

  const onDeposit = () => {
    makeDeposit(depositAmt)
    setToast(`Deposited ${formatMoney(depositAmt)} — habit locked in.`)
    window.setTimeout(() => setToast(null), 2800)
  }

  return (
    <div className="page">
      <p className="muted" style={{ marginBottom: '0.35rem' }}>
        Welcome back{state.profile.name ? `, ${state.profile.name}` : ''}
      </p>
      <h1 className="page-title">Your money, moving.</h1>
      <p className="page-sub">One tap to deposit. Dunn AI handles the hard questions — within your allowance.</p>

      <div className="dash-grid">
        <section className="panel balance-block">
          <div className="balance-label">Total balance</div>
          <div className="balance-value">{formatMoney(equity)}</div>
          <div className={dayChange >= 0 ? 'gain' : 'loss'}>
            {formatPct(dayChange)} vs prior snapshot
            {loadingMarket ? ' · refreshing markets…' : ''}
          </div>
          <EquityArea points={state.equityHistory.map((h) => h.value)} />
          <div className="quick-actions">
            <div className="field" style={{ minWidth: 120 }}>
              <label htmlFor="dep">Deposit</label>
              <input
                id="dep"
                type="number"
                min={10}
                value={depositAmt}
                onChange={(e) => setDepositAmt(Number(e.target.value) || 0)}
              />
            </div>
            <button className="btn btn-primary" type="button" onClick={onDeposit} style={{ alignSelf: 'end' }}>
              Deposit
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => void refreshMarket()} style={{ alignSelf: 'end' }}>
              Refresh prices
            </button>
            <Link className="btn btn-champagne" to="/app/markets" style={{ alignSelf: 'end' }}>
              View markets
            </Link>
          </div>
          <p className="muted" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
            Cash available: {formatMoney(state.cash)} · Auto-deposit goal {formatMoney(state.profile.monthlyDeposit)}
            /mo
          </p>
        </section>

        <section className="panel balance-block stack">
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>Holdings</h2>
            <p className="muted">Live marks with mini trend lines.</p>
          </div>
          <div className="list">
            {holdingsPreview.length === 0 && <p className="muted">No positions yet — deposit, then let AI invest.</p>}
            {holdingsPreview.map((h) => {
              const px = prices[h.symbol] ?? h.avgCost
              const pnl = ((px - h.avgCost) / h.avgCost) * 100
              return (
                <div className="list-row" key={h.symbol}>
                  <div>
                    <strong>{h.symbol}</strong>
                    <div className="muted">{h.name}</div>
                  </div>
                  <MiniSpark symbol={h.symbol} />
                  <div style={{ textAlign: 'right' }}>
                    <div>{formatMoney(h.shares * px)}</div>
                    <div className={pnl >= 0 ? 'gain' : 'loss'}>{formatPct(pnl)}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <Link to="/app/invest" className="btn btn-ghost">
            View portfolio
          </Link>
        </section>
      </div>

      <section className="panel balance-block" style={{ marginTop: '1rem' }}>
        <div className="price-chart-head" style={{ marginBottom: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem' }}>Market pulse · SPY</h2>
            <p className="muted">Scrub the line to see exact prices — same interaction pattern as the Markets desk.</p>
          </div>
          <Link to="/app/markets" className="btn btn-ghost">
            Stocks & bonds
          </Link>
        </div>
        <PriceChart symbol="SPY" name="S&P 500" showHeader={false} height={220} defaultRange="3mo" />
      </section>

      <section className="panel balance-block" style={{ marginTop: '1rem' }}>
        <CompareChart height={240} />
      </section>

      <section className="panel balance-block" style={{ marginTop: '1rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>Recent activity</h2>
        <div className="list">
          {state.transactions.slice(0, 6).map((t) => (
            <div className="list-row" key={t.id}>
              <div>
                <strong>{t.note || t.type}</strong>
                <div className="muted">{new Date(t.createdAt).toLocaleString()}</div>
              </div>
              <div>{formatMoney(t.amount)}</div>
            </div>
          ))}
          {state.transactions.length === 0 && <p className="muted">Your ledger is empty — make the first deposit.</p>}
        </div>
      </section>

      {toast && <div className="reward-toast">{toast}</div>}
    </div>
  )
}
