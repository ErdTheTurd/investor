# Dunn Investing

Finhabits-style automated investing with a real AI co-pilot that can trade within a daily allowance.

## Features

- Goal-based paper brokerage (deposit, buy/sell, diversified ETF sleeves)
- **Dunn AI** — live LLMs with no developer API key (Puter → Pollinations → on-device WebLLM)
- Multi-factor market matrix fed into every AI call (momentum, volatility, RS, volume, drawdown, liquidity, sentiment proxy, regime fit)
- **Auto-Invest** with a hard daily dollar allowance (blocked when market data is simulated)
- Habit-loop UX (streaks, one-tap deposits, variable AI insights)

## Market data (Yahoo → static JSON)

GitHub Pages has no server, so the app does **not** call Yahoo from the browser on Pages.

A scheduled GitHub Actions workflow (`Fetch market data`) pulls daily bars + a latest quote for every universe symbol from Yahoo server-side and writes:

- `public/market-data/*.json` (Vite `public/` → included in builds)
- `market-data/*.json` (committed on `main` for history)

It then deploys the site via `actions/deploy-pages` (GITHUB_TOKEN pushes do not trigger branch-based Pages builds).

**One-time setting:** Settings → Pages → Build and deployment → Source → **GitHub Actions**.

The Pages app loads those JSON files first. Local `npm run dev` still uses the Vite `/api/yahoo` proxy when static files are missing. Synthetic bars are a last resort and are labeled **Simulated data** in the UI — never “live”. Auto-Invest and AI-executed trades are blocked on simulated data (including incomplete universe coverage).

Refresh locally:

```bash
npm run fetch:market
```

## Develop

```bash
npm install
npm run fetch:market   # optional; seeds public/market-data
npm run dev
```

```bash
npm test
npm run lint
```

## Deploy to GitHub Pages

Pages serves the repo root on `main`. Publish a production build into the root (with `/investor/` base paths):

```bash
npm run build:pages
```

That writes `index.html`, `404.html`, `favicon.svg`, `assets/`, and `market-data/` for https://erdtheturd.github.io/investor/

Keep editing `index.source.html` (Vite entry). `npm run dev` / `npm run build` restore it automatically.

## AI without a paid developer key

Dunn AI uses a three-tier stack:

1. **Puter.js** — real cloud LLMs (GPT / Claude / etc.) on a user-pays model. No key for you as the developer.
2. **Pollinations** — anonymous OpenAI-compatible HTTP API (keyless).
3. **WebLLM** — on-device **Qwen 2.5 0.5B** in the browser (real neural net, WebGPU). First load downloads weights (~280MB), then caches them.

Every AI turn receives a multi-factor market matrix before it proposes trades.

## Build

```bash
npm run build
npm run preview
```

## Disclaimer

Educational paper-trading demo. Not a broker-dealer or investment adviser.
