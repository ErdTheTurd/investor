import { Link } from 'react-router-dom'

export function Landing() {
  return (
    <div className="app-shell">
      <header className="nav">
        <div className="container nav-inner">
          <div className="brand">
            Dunn <span>Investing</span>
            <em>?</em>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <Link className="btn btn-ghost" to="/onboarding">
              Log in
            </Link>
            <Link className="btn btn-primary" to="/onboarding">
              Start investing
            </Link>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-media" aria-hidden />
        <div className="container hero-content">
          <div className="hero-brand">
            Dunn <span>Investing</span>
            <em>?</em>
          </div>
          <h1>Real AI that can invest with the allowance you set.</h1>
          <p className="lede">
            Automated portfolios like the apps you already trust — plus a live language model that reads dozens of market
            factors and can trade for you.
          </p>
          <div className="hero-cta">
            <Link className="btn btn-primary" to="/onboarding">
              Open your account
            </Link>
            <a className="btn btn-ghost" href="#how">
              See how it works
            </a>
          </div>
        </div>
      </section>

      <section className="section container" id="how">
        <div className="section-head">
          <h2>Investing made a daily habit</h2>
          <p>
            Cue, action, reward — designed so checking in feels natural. Deposit once, watch the AI work within your
            rules, come back for the next insight.
          </p>
        </div>
        <div className="feature-row">
          <article>
            <h3>Diversified by default</h3>
            <p>
              Goal-based portfolios across US stocks, international equities, bonds, REITs, and gold — rebalanced toward
              your risk profile.
            </p>
          </article>
          <article>
            <h3>Dunn AI is a real model</h3>
            <p>
              Not a hard-coded scoring script posing as intelligence. We call a live LLM (via Puter, no developer API
              key) with a multi-factor matrix: momentum, volatility, relative strength, volume pressure, drawdowns,
              liquidity, and regime fit.
            </p>
          </article>
          <article>
            <h3>Auto-Invest with an allowance</h3>
            <p>
              Flip Auto-Invest on, set a daily dollar ceiling, and Dunn AI can place paper trades on its own — or ask
              you to approve when the size is larger.
            </p>
          </article>
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <h2>One question. Better money habits.</h2>
          <p>
            Dunn Investing? Because building wealth starts with asking better questions — and giving AI clear limits.
          </p>
        </div>
        <Link className="btn btn-champagne" to="/onboarding">
          Begin onboarding
        </Link>
        <p className="footer-note">
          Educational paper-trading demo. Not a registered broker-dealer or investment adviser. Past performance does not
          guarantee future results. Market data is sourced from free public feeds when available.
        </p>
      </section>
    </div>
  )
}
