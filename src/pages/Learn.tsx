const lessons = [
  {
    title: 'A simple check-in',
    body: 'Open the app, make a deposit or ask Dunn AI a question, and your visit streak updates. The portfolio does not depend on daily check-ins.',
  },
  {
    title: 'The daily allowance is the limit',
    body: 'Auto-Invest can place paper trades only up to the daily dollar cap you set. It cannot spend the whole account in one go.',
  },
  {
    title: 'What the model sees',
    body: 'Each Dunn AI turn includes momentum, volatility, relative strength, volume, drawdown, and other factors from the market snapshots, not a fixed script of answers.',
  },
  {
    title: 'Diversification',
    body: 'The default mix spreads paper cash across US stocks, international stocks, bonds, REITs, and commodities. Dunn AI sizes trades inside that map.',
  },
]

export function Learn() {
  return (
    <div className="page">
      <h1 className="page-title">Learn</h1>
      <p className="page-sub">Short notes on how this paper-trading demo works.</p>
      <div className="feature-row panel balance-block">
        {lessons.map((l) => (
          <article key={l.title}>
            <h3>{l.title}</h3>
            <p>{l.body}</p>
          </article>
        ))}
      </div>
      <p className="footer-note">
        Educational content only. Dunn Investing is a paper-trading demonstration that uses free AI providers (Puter.js /
        Pollinations) and public market data.
      </p>
    </div>
  )
}
