# ETF Portfolio Rebalancer

A browser-based tool to calculate optimal buy/sell amounts for multi-asset ETF and crypto portfolios — no account, no server, no data leaving your browser.

**[Live App](https://niklasmuller-mb.github.io/etf-rebalancer/)**

---

## Features

- **3-step workflow** — define target allocations → enter current holdings → get rebalancing recommendations
- **Live price fetching** — ETF prices via Yahoo Finance (with CORS fallback mirrors), crypto via Binance API
- **Two investment modes** — one-time investment or monthly savings plan
- **Drift visualization** — Chart.js bar charts comparing current vs. target allocation
- **Trade recommendations** — suggested buy/sell amounts with limit prices based on 3-day averages
- **Multi-portfolio support** — up to 5 independent portfolios with tabs
- **Import / Export** — full portfolio snapshots as JSON (includes price cache)
- **Privacy-first** — all data lives in `localStorage` only; no backend; analytics opt-in only

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Vanilla HTML / CSS / ES Modules (no framework) |
| Charts | [Chart.js](https://www.chartjs.org/) via CDN |
| Analytics | [PostHog](https://posthog.com/) via CDN (consent-gated) |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions |

---

## Local Development

No build step required.

```bash
git clone https://github.com/NiklasMueller-MB/etf-rebalancer.git
cd etf-rebalancer
npx serve .
```

Then open `http://localhost:3000` in your browser.

> **Note:** Opening `index.html` directly via `file://` may block live price fetching due to browser CORS restrictions. Use a local server instead.

---

## Deployment

The app is deployed automatically to GitHub Pages on every push to `main` via GitHub Actions.

The PostHog analytics key is **not** stored in the repository. It is injected at build time using a GitHub Actions secret:

1. Go to **Settings → Secrets → Actions** in your GitHub repo
2. Add a secret named `POSTHOG_KEY` with your PostHog project API key
3. The workflow replaces the `POSTHOG_KEY_PLACEHOLDER` token in `index.html` at deploy time

See [POSTHOG_SETUP.md](POSTHOG_SETUP.md) for full analytics setup instructions.

---

## Project Structure

```
etf-rebalancer/
├── index.html              # App shell — loads all modules
├── scripts/
│   ├── app.js              # Entry point — wires navigation and init
│   ├── state.js            # All portfolio state; reads/writes localStorage
│   ├── setupPage.js        # Step 1: target allocation editor
│   ├── holdingsPage.js     # Step 2: current holdings input
│   ├── resultsPage.js      # Step 3: comparison charts + trade output
│   ├── optimizer.js        # Pure rebalancing algorithm (no side effects)
│   ├── pricingService.js   # Price fetching — Yahoo Finance + Binance + cache
│   ├── portfolioBar.js     # Multi-portfolio tab UI
│   ├── importExport.js     # Portfolio JSON import / export
│   ├── analytics.js        # PostHog wrapper (consent-aware)
│   ├── basicAnalytics.js   # Lightweight tracking without consent
│   ├── consent.js          # Consent banner logic
│   ├── settingsModal.js    # Privacy settings modal
│   ├── validation.js       # Input validation helpers
│   └── dom.js              # DOM utility functions
├── styles/
│   ├── main.css            # Core styles + CSS variables for light/dark themes
│   ├── settings.css        # Settings modal styles
│   └── consent.css         # Consent banner styles
├── .github/
│   └── workflows/          # GitHub Actions deploy workflow
└── POSTHOG_SETUP.md        # Analytics configuration guide
```

---

## Privacy & Data

- All portfolio data is stored exclusively in your browser's `localStorage`
- No personal or financial data is sent to any server
- Price data is fetched directly from Yahoo Finance / Binance by your browser
- Analytics are optional and consent-gated; see the consent banner on first visit

---

## License

MIT — see [LICENSE](LICENSE) if present, or contact the repository owner.
