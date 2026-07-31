# Dunn Investing

Finhabits-style automated investing with a real AI co-pilot that can trade within a daily allowance.

## Features

- Goal-based paper brokerage (deposit, buy/sell, diversified ETF sleeves)
- **Dunn AI** — live LLMs with no developer API key (Puter → Pollinations → on-device WebLLM)
- Multi-factor market matrix fed into every AI call (momentum, volatility, RS, volume, drawdown, liquidity, sentiment proxy, regime fit)
- **Auto-Invest** with a hard daily dollar allowance
- Habit-loop UX (streaks, one-tap deposits, variable AI insights)

## Develop

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

Pages serves the repo root on `main`. Publish a production build into the root (with `/investor/` base paths):

```bash
npm run build:pages
```

That writes `index.html`, `404.html`, `favicon.svg`, and `assets/` for https://erdtheturd.github.io/investor/

Keep editing `index.source.html` (Vite entry). `npm run dev` / `npm run build` restore it automatically.

Market quotes are proxied through Vite to Yahoo Finance in local/dev. On GitHub Pages, the app uses a CORS-friendly fallback, then synthetic bars if feeds fail.

## AI without a paid developer key

Dunn AI uses a three-tier stack:

1. **Puter.js** — real cloud LLMs (GPT / Claude / etc.) on a user-pays model. No key for you as the developer.
2. **Pollinations** — anonymous OpenAI-compatible HTTP API (keyless).
3. **WebLLM** — on-device **Qwen 2.5 0.5B** in the browser (real neural net, WebGPU). First load downloads weights (~280MB), then caches them.

Every AI turn receives a live multi-factor market matrix before it proposes trades.

## Build

```bash
npm run build
npm run preview
```

## Disclaimer

Educational paper-trading demo. Not a broker-dealer or investment adviser.
