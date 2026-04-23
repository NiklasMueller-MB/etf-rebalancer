# ETF Portfolio Rebalancer — Claude Context

## Project Overview

Browser-based ETF and crypto portfolio rebalancer. Deployed as a static site on GitHub Pages. Users define target allocations, enter current holdings, and get buy/sell recommendations to rebalance toward their targets.

No framework, no bundler, no backend. All data stays in `localStorage`.

---

## Architecture

Vanilla ES modules loaded directly by `index.html`. All external dependencies (Chart.js, PostHog) come from CDN. No `npm install` or build step.

### Module Responsibilities

| Module | Role |
|---|---|
| `scripts/app.js` | Entry point — wires navigation buttons, calls `init()` on DOM ready |
| `scripts/state.js` | Single source of truth for all portfolio data; persists to `localStorage` |
| `scripts/setupPage.js` | Step 1 UI — target allocation sliders/inputs |
| `scripts/holdingsPage.js` | Step 2 UI — current shares and manual price inputs |
| `scripts/resultsPage.js` | Step 3 UI — charts, investment settings, trade table |
| `scripts/optimizer.js` | Pure rebalancing algorithm — takes state + prices, returns trades |
| `scripts/pricingService.js` | Fetches ETF prices (Yahoo Finance + CORS mirrors) and crypto (Binance); 24h localStorage cache |
| `scripts/portfolioBar.js` | Multi-portfolio tab strip (up to 5 portfolios) |
| `scripts/importExport.js` | JSON import/export of full portfolio snapshots |
| `scripts/analytics.js` | PostHog wrapper — all tracking goes through here, consent-aware |
| `scripts/basicAnalytics.js` | Lightweight tracking that works without full analytics consent |
| `scripts/consent.js` | Consent banner display and storage |
| `scripts/settingsModal.js` | Privacy settings modal |
| `scripts/validation.js` | Shared input validation helpers |
| `scripts/dom.js` | DOM utility functions (`byId`, `setHTML`, `showPage`, etc.) |

---

## Key Patterns

### State Management
`state.js` owns everything. Call `getActivePortfolio()` to read and `updateActivePortfolio(fn)` to write. Never mutate state objects directly. Changes are automatically persisted to `localStorage`.

### Page Flow
Linear 3-step flow: `setupPage` → `holdingsPage` → `resultsPage`. Navigation is managed in `app.js` via `showPage(n)`. Each page has an `init*Page()` (runs once) and a `render*Page()` (runs on every visit).

### Pricing
`pricingService.js` tries Yahoo Finance first (multiple CORS proxy mirrors as fallback), then Binance for crypto tickers. Results are cached in `localStorage` for 24 hours. Manual prices entered by the user bypass fetching entirely.

### Optimizer
`optimizer.js` is pure — no DOM access, no fetch calls. Input: portfolio state + price data object. Output: `{ trades: [...], ... }`. Keep it that way; test it in isolation.

### Analytics
Never call PostHog directly. All tracking goes through `analytics.js` (`trackEvent`, `trackFunnel`, `trackError`, `trackPageView`). Analytics only initializes when the user has given enhanced consent.

---

## Conventions

- **No build step** — edits to source files are immediately reflected after deploy; pushing to `main` triggers GitHub Actions
- **CSS variables** for all colors and spacing — defined in `styles/main.css`; light/dark mode is handled via `[data-theme]` attribute on `<html>`
- **All prices in EUR** — conversion from USD is handled in `pricingService.js` where needed
- **IDs over classes** for JS hooks — `byId('...')` is the standard DOM accessor; class selectors are for styling only
- **No `console.log` in production** — errors go to `trackError()`; debug logging should be removed before committing

---

## Deployment

GitHub Actions workflow (`.github/workflows/`) handles deployment:
1. Injects the PostHog API key from the `POSTHOG_KEY` Actions secret into `index.html` at deploy time via `sed`
2. Uploads the full repo root as a GitHub Pages artifact
3. Deploys to `https://niklasmuller-mb.github.io/etf-rebalancer/`

**Never hardcode the PostHog key in source.** The placeholder `POSTHOG_KEY_PLACEHOLDER` in `index.html` is intentional.

---

## Local Development

```bash
npx serve .
# then open http://localhost:3000
```

Opening `index.html` via `file://` blocks price fetching (CORS). Always use a local server.

---

## Constraints — Do Not Change Without Discussion

- No npm packages or bundler — keep the zero-dependency approach
- No server-side code or database
- No framework (React, Vue, etc.)
- Data must stay client-side only; never send portfolio data to an external service
