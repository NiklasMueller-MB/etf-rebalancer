# Code Review — Error Report

Reviewed: 2026-04-23  
Scope: All JS modules, `index.html`

---

## Critical

Issues that cause runtime crashes or severe security vulnerabilities.

### C1 · `scripts/holdingsPage.js:209` — Undefined variable `state` (ReferenceError)

Inside the `change` event listener registered in `initHoldingsPage()`, the code references `state.etfs` at line 209. The `state` variable only exists inside `renderHoldingsPage()` and is not in scope here. Any attempt to manually edit a price field will throw a `ReferenceError` and break the holdings page.

**Fix:** Replace with `const portfolio = getActivePortfolio(); const etf = portfolio.etfs.find(...)`.

---

### C2 · `scripts/optimizer.js:81` — Division by zero → `Infinity` propagates

```js
const scale = effectiveInv / currentSum;  // crashes if currentSum === 0
```

If all ETF bounds force allocations to 0 and `currentSum` is 0, `scale` becomes `Infinity`. Every element in `normalized` becomes `Infinity`, and the final trade output is unusable.

**Fix:** Guard with `if (currentSum === 0) return arr;` before line 81.

---

### C3 · `scripts/validation.js:57` — Unescaped `suggestedValue` in `innerHTML` (XSS)

```js
errorDiv.innerHTML = `... Fix: ${suggestedValue} ...`;
```

`suggestedValue` is interpolated directly into HTML. If it contains `<`, `>`, or `"`, the HTML structure breaks. With crafted input it becomes an XSS vector.

**Fix:** Escape `suggestedValue` before insertion, or build the button with `document.createElement` and set `textContent`.

---

## Major

Logic errors, data loss, race conditions, and security issues that degrade correctness or reliability.

---

### M1 · `scripts/app.js:127,179` — Stale global price data (race condition)

`window.currentPriceData` is written by `onViewComparison()` and read by `onOptimize()`. If the user edits holdings between the two actions, the optimize step uses prices fetched for the old portfolio state.

---

### M2 · `scripts/app.js:146,176` — Unused `currentPortfolio`, portfolio re-fetched later

`currentPortfolio` is assigned at line 146 for validation but the actual allocation call at line 176 fetches the portfolio again independently. Any state change between those two points creates a silent inconsistency.

---

### M3 · `scripts/app.js:104–107` — Partial price-fetch failures continue silently

When `fetchedData.hasErrors` is true, the code records which tickers failed but continues to render results. Users receive no visible indication of which ETF prices are missing or stale.

---

### M4 · `scripts/state.js:175–176` — Portfolio ID collision after deletion

New portfolio IDs are generated as `` `p${portfolios.length + 1}` ``. After deleting a portfolio, the count-based index can produce an ID that already exists (e.g., delete `p2` from `[p1, p2, p3]` → next add creates `p3` again).

**Fix:** Use `Math.max(...ids) + 1` or a UUID.

---

### M5 · `scripts/state.js:144–153` — `getActivePortfolio()` fallback doesn't update `appState`

The guard that creates a default portfolio when none is found returns a fresh object without persisting it. Callers that use the returned object mutate a detached instance, and the changes are never saved.

---

### M6 · `scripts/optimizer.js:261–262` — `canIncrease` logic breaks for sell-only mode

```js
const canIncrease = indices.filter(i => v[i] > 0 && v[i] < targetInv);
```

In sell-only mode `targetInv` is negative. No positive value can be less than a negative number, so `canIncrease` is always empty and the post-processing adjustment loop does nothing.

---

### M7 · `scripts/optimizer.js:15–16` — Inverted sell penalty

The penalty for sells below `minSellAmount` is:
```js
penalty += (minSellAmount + r[i]) * penaltyWeight;   // r[i] is negative
```
When `r[i] = -500` and `minSellAmount = 250`, this gives `(250 - 500) * w = -250w` (negative — rewards the violation). The intended formula is `(minSellAmount - Math.abs(r[i])) * penaltyWeight` clamped to positive values.

---

### M8 · `scripts/pricingService.js:268–293` — Uncaught rejections abort the fetch loop

A `try/catch` inside a `for...of` + `await` loop catches synchronous throws but not async rejections from `fetchBinancePrice()` or `fetchYahooPrice()` if they reject after the tick. A rejection propagates out of the loop and all remaining tickers are skipped silently.

---

### M9 · `scripts/pricingService.js:194–196,227–229` — Cache namespace collision (Yahoo vs. Binance)

Both `fetchYahooPrice()` and `fetchBinancePrice()` call `getCachedPrice(ticker)` with the raw ticker as the key. If the same symbol exists on both sources (e.g., `BTCEUR` as an ETF and a crypto pair), one source's cache entry overwrites the other.

---

### M10 · `scripts/holdingsPage.js:137–141` — Unescaped user data in `innerHTML` (XSS)

`e.name`, `e.ticker`, `e.cat`, and `manualPrice` are template-interpolated directly into the holdings table HTML. An ETF name containing `<script>` or `">` will break the DOM or execute code.

---

### M11 · `scripts/resultsPage.js:178` — Unescaped user data in `innerHTML` (XSS)

Same pattern as M10: `e.name` and `e.cat` are inserted into the results table without escaping.

---

### M12 · `scripts/resultsPage.js:259` — Division by zero in trade table (`price === 0`)

```js
const units = Math.abs(amt) / price;
```

No guard for `price === 0` or `price === undefined`. If a price fetch failed or returned 0, `units` becomes `Infinity` or `NaN`, which renders as garbage in the trade table.

---

### M13 · `scripts/importExport.js:57–76` — Import drops trading settings and manual prices

When rebuilding portfolio state from an import file, the mapping omits `manualPrices`, `allowBuy`, `allowSell`, `minBuyAmount`, and `minSellAmount`. Importing a previously exported portfolio silently resets all manual price overrides and trading constraints to defaults.

---

### M14 · `scripts/importExport.js:62` — Hardcoded `nid: 20` causes ID collision

```js
nid: 20,
```

If an imported portfolio already contains ETFs with IDs ≥ 20, the next ETF added will reuse an existing ID.

**Fix:** `nid: Math.max(0, ...portfolio.etfs.map(e => e.id)) + 1`.

---

### M15 · `scripts/dom.js:20` — `setHTML()` passes raw HTML to `innerHTML`

`setHTML(el, html)` is a thin wrapper around `innerHTML`. It is called throughout the codebase with dynamically constructed strings. A single caller that includes unsanitized user data becomes an XSS vulnerability with no centralised protection.

---

## Minor

Edge cases, low-risk issues, and code quality problems.

---

### m1 · `scripts/setupPage.js:68` — `!id` falsely rejects `id === 0`

`if (!id) return;` treats `id = 0` as missing. ETF IDs starting at 0 would be silently ignored. Use `if (id == null) return;` instead.

---

### m2 · `scripts/state.js:198` — `renamePortfolio` accepts empty string names

The guard `name || p.name` only falls back for `undefined`/`null`. An empty string `""` is truthy and passes through, leaving a portfolio with a blank name in the tab strip.

---

### m3 · `scripts/optimizer.js:97–106` — Floating-point drift in constraint normalisation

Distributing `adjustment / canIncrease.length` across variables accumulates rounding error. The final constraint sum may be off by a small epsilon, which occasionally triggers a second normalisation pass unnecessarily.

---

### m4 · `scripts/pricingService.js:41–48` — Cache key has no source namespace

Cache entries are keyed by raw ticker. ETF and crypto tickers occupy the same key space; a hypothetical overlap silently returns the wrong price.

---

### m5 · `scripts/pricingService.js:260` — No guard for `null`/empty `etfs` input in `fetchAllPrices()`

Calling `fetchAllPrices(null)` or `fetchAllPrices([])` reaches the `for...of` loop and either throws immediately or exits silently. Add an early return for falsy or empty arrays.

---

### m6 · `scripts/pricingService.js:247–251` — Binance candle slice could be empty

`kl.slice(-3)` returns an empty array if no candles were returned. `reduce(..., 0) / l3.length` then divides by zero. Extremely unlikely with `limit=7`, but should be guarded.

---

### m7 · `scripts/pricingService.js:68–90` — `importPriceCache()` silently drops corrupt entries

Parse errors and missing fields in the cache file are caught and discarded without any user-visible feedback. Corrupted or incompatible cache files appear to import successfully while doing nothing.

---

### m8 · `scripts/portfolioBar.js:24` — Portfolio name injected into `innerHTML` without escaping (self-XSS)

A portfolio named `<img src=x onerror=alert(1)>` would execute in the user's own session. Low external risk but inconsistent with safe coding practices.

---

### m9 · `scripts/importExport.js:77` — Fallback `activePortfolioId: 'p1'` may not exist

If the import file contains portfolios with IDs other than `p1` and has no `activePortfolioId` field, the state is initialised pointing to a non-existent portfolio.

---

### m10 · `scripts/state.js:20–22` — `localStorage` failures swallowed silently

All `localStorage.setItem` calls are wrapped in empty `catch` blocks. Users in private browsing mode or with full storage quota will lose all changes without any warning.

---

### m11 · `scripts/resultsPage.js:117` — `sol[i] / ft * 100` with no guard for `ft === 0`

If `ft` (total investable funds) is 0, chart target percentages become `Infinity`, causing Chart.js to render malformed bars.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 3 |
| Major | 15 |
| Minor | 11 |
| **Total** | **29** |
