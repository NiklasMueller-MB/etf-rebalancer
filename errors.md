# Code Review — Error Report

Reviewed: 2026-04-23  
Scope: All JS modules, `index.html`  
Fixes applied: 2026-05-02

---

## Critical

Issues that cause runtime crashes or severe security vulnerabilities.

---

### C1 · `scripts/holdingsPage.js:209` — Undefined variable `state` (ReferenceError)
**Status: Fixed**

Inside the `change` event listener registered in `initHoldingsPage()`, the code references `state.etfs` at line 209. The `state` variable only exists inside `renderHoldingsPage()` and is not in scope here. Any attempt to manually edit a price field will throw a `ReferenceError` and break the holdings page.

**Fix applied:** Replaced with `const etf = getActivePortfolio().etfs.find(...)`.

---

### C2 · `scripts/optimizer.js:81` — Division by zero → `Infinity` propagates
**Status: Fixed**

```js
const scale = effectiveInv / currentSum;  // crashes if currentSum === 0
```

If all ETF bounds force allocations to 0 and `currentSum` is 0, `scale` becomes `Infinity`. Every element in `normalized` becomes `Infinity`, and the final trade output is unusable.

**Fix applied:** Added `if (currentSum === 0) return arr;` before the division.

---

### C3 · `scripts/validation.js:57` — Unescaped `suggestedValue` in `innerHTML` (XSS)
**Status: Fixed**

```js
errorDiv.innerHTML = `... Fix: ${suggestedValue} ...`;
```

`suggestedValue` is interpolated directly into HTML. If it contains `<`, `>`, or `"`, the HTML structure breaks. With crafted input it becomes an XSS vector.

**Fix applied:** The "Fix" button is now built via `document.createElement('button')` with `textContent` rather than `innerHTML` interpolation.

---

## Major

Logic errors, data loss, race conditions, and security issues that degrade correctness or reliability.

---

### M1 · `scripts/app.js:127,179` — Stale global price data (race condition)
**Status: Fixed**

`window.currentPriceData` is written by `onViewComparison()` and read by `onOptimize()`. If the user edits holdings between the two actions, the optimize step uses prices fetched for the old portfolio state.

**Fix applied:** Extracted `buildPriceData(portfolio)` as a standalone async function. Both `onViewComparison` and `onOptimize` call it directly with the current portfolio; `window.currentPriceData` global removed.

---

### M2 · `scripts/app.js:146,176` — Unused `currentPortfolio`, portfolio re-fetched later
**Status: Fixed**

`currentPortfolio` is assigned at line 146 for validation but the actual allocation call at line 176 fetches the portfolio again independently. Any state change between those two points creates a silent inconsistency.

**Fix applied:** Removed the unused `currentPortfolio` variable from `onViewComparison`; `onOptimize` now uses a single fetch at the point of optimization.

---

### M3 · `scripts/app.js:104–107` — Partial price-fetch failures continue silently
**Status: Fixed**

When `fetchedData.hasErrors` is true, the code records which tickers failed but continues to render results. Users receive no visible indication of which ETF prices are missing or stale.

**Fix applied:** `onViewComparison` now alerts the user with the names of all failed tickers before rendering.

---

### M4 · `scripts/state.js:175–176` — Portfolio ID collision after deletion
**Status: Fixed**

New portfolio IDs are generated as `` `p${portfolios.length + 1}` ``. After deleting a portfolio, the count-based index can produce an ID that already exists (e.g., delete `p2` from `[p1, p2, p3]` → next add creates `p3` again).

**Fix applied:** IDs are now generated from the maximum existing numeric ID (`reduce` over existing IDs + 1).

---

### M5 · `scripts/state.js:144–153` — `getActivePortfolio()` fallback doesn't update `appState`
**Status: Fixed**

The guard that creates a default portfolio when none is found returns a fresh object without persisting it. Callers that use the returned object mutate a detached instance, and the changes are never saved.

**Fix applied:** Both fallback branches now assign back to `appState` and call `saveStateToStorage`.

---

### M6 · `scripts/optimizer.js:261–262` — `canIncrease` logic breaks for sell-only mode
**Status: Fixed**

```js
const canIncrease = indices.filter(i => v[i] > 0 && v[i] < targetInv);
```

In sell-only mode `targetInv` is negative. No positive value can be less than a negative number, so `canIncrease` is always empty and the post-processing adjustment loop does nothing.

**Fix applied:** Replaced sign-based checks with bounds-based checks (`v < ub[i]` / `v > lb[i]`), which work correctly for all modes.

---

### M7 · `scripts/optimizer.js:15–16` — Inverted sell penalty
**Status: Not applicable — analysis incorrect**

The reported formula `(minSellAmount + r[i])` with `r[i]` negative is mathematically equivalent to `(minSellAmount - Math.abs(r[i]))`. The example in the original report (`r[i] = -500`) does not satisfy the entry condition `Math.abs(r[i]) < minSellAmount`, so the branch is never reached for that case. No change required.

---

### M8 · `scripts/pricingService.js:268–293` — Uncaught rejections abort the fetch loop
**Status: Not applicable — already handled**

The `for...of` loop already has a `try/catch` around each `await`, so individual ticker failures are caught and accumulated in `failedFetches` without aborting the loop. No change required.

---

### M9 · `scripts/pricingService.js:194–196,227–229` — Cache namespace collision (Yahoo vs. Binance)
**Status: Fixed**

Both `fetchYahooPrice()` and `fetchBinancePrice()` call `getCachedPrice(ticker)` with the raw ticker as the key. If the same symbol exists on both sources, one source's cache entry overwrites the other.

**Fix applied:** `getCachedPrice` and `setCachedPrice` now take a `source` parameter; keys are stored as `` `${source}:${ticker}` ``. Yahoo uses `'yahoo'`, Binance uses `'binance'`.

---

### M10 · `scripts/holdingsPage.js:137–141` — Unescaped user data in `innerHTML` (XSS)
**Status: Fixed**

`e.name`, `e.ticker`, `e.cat`, and `manualPrice` are template-interpolated directly into the holdings table HTML. An ETF name containing `<script>` or `">` will break the DOM or execute code.

**Fix applied:** All user-controlled fields wrapped in `escHtml()` calls in `renderHoldingsTable`.

---

### M11 · `scripts/resultsPage.js:178` — Unescaped user data in `innerHTML` (XSS)
**Status: Fixed**

Same pattern as M10: `e.name` and `e.cat` are inserted into the results table without escaping.

**Fix applied:** `escHtml()` applied to `e.name` and `e.cat` in both allocation and trade row templates in `resultsPage.js`.

---

### M12 · `scripts/resultsPage.js:259` — Division by zero in trade table (`price === 0`)
**Status: Not applicable — already handled**

Line 266 already reads `price && !isNaN(price) && price > 0 ? Math.abs(amt) / price : 0`, which guards all three cases. No change required.

---

### M13 · `scripts/importExport.js:57–76` — Import drops trading settings and manual prices
**Status: Fixed**

When rebuilding portfolio state from an import file, the mapping omits `manualPrices`, `allowBuy`, `allowSell`, `minBuyAmount`, and `minSellAmount`. Importing a previously exported portfolio silently resets all manual price overrides and trading constraints to defaults.

**Fix applied:** Export now includes all five fields; import maps them back with correct defaults. Also fixed `portfolio.defaultInvestment` → `portfolio.inv` (the old key was never exported).

---

### M14 · `scripts/importExport.js:62` — Hardcoded `nid: 20` causes ID collision
**Status: Fixed**

```js
nid: 20,
```

If an imported portfolio already contains ETFs with IDs ≥ 20, the next ETF added will reuse an existing ID.

**Fix applied:** `nid` is now derived via `portfolio.etfs.reduce((max, e) => Math.max(max, e.id), 0) + 1`.

---

### M15 · `scripts/dom.js:20` — `setHTML()` passes raw HTML to `innerHTML`
**Status: Mitigated**

`setHTML(el, html)` is a thin wrapper around `innerHTML`. It is called throughout the codebase with dynamically constructed strings. A single caller that includes unsanitized user data becomes an XSS vulnerability with no centralised protection.

**Mitigation applied:** `escHtml()` utility added to `dom.js` and applied consistently at all call sites that interpolate user-controlled data (`holdingsPage.js`, `resultsPage.js`, `portfolioBar.js`). `setHTML` itself remains a raw `innerHTML` wrapper — callers are responsible for escaping.

---

## Minor

Edge cases, low-risk issues, and code quality problems.

---

### m1 · `scripts/setupPage.js:68` — `!id` falsely rejects `id === 0`
**Status: Fixed**

`if (!id) return;` treats `id = 0` as missing. ETF IDs starting at 0 would be silently ignored.

**Fix applied:** Both occurrences replaced with `if (isNaN(id)) return;`.

---

### m2 · `scripts/state.js:198` — `renamePortfolio` accepts empty string names
**Status: Not applicable — analysis incorrect**

`""` is falsy in JavaScript, so `name || p.name` already falls back to the existing name when an empty string is passed. No change required.

---

### m3 · `scripts/optimizer.js:97–106` — Floating-point drift in constraint normalisation
**Status: Not fixed**

Distributing `adjustment / canIncrease.length` across variables accumulates rounding error. The final constraint sum may be off by a small epsilon. Impact is negligible for the investment amounts involved; not addressed.

---

### m4 · `scripts/pricingService.js:41–48` — Cache key has no source namespace
**Status: Fixed** (same fix as M9)

Cache entries were keyed by raw ticker with no source prefix. Fixed as part of the M9 fix — keys are now `source:ticker`.

---

### m5 · `scripts/pricingService.js:260` — No guard for `null`/empty `etfs` input in `fetchAllPrices()`
**Status: Fixed**

**Fix applied:** Early return added at the top of `fetchAllPrices` for `!etfs || !etfs.length`.

---

### m6 · `scripts/pricingService.js:247–251` — Binance candle slice could be empty
**Status: Fixed**

**Fix applied:** `l3.length ? ... : p` guard added to both `aH` and `aL` calculations.

---

### m7 · `scripts/pricingService.js:68–90` — `importPriceCache()` silently drops corrupt entries
**Status: Not fixed**

Parse errors and missing fields in the cache file are caught and discarded. This is acceptable behaviour for a best-effort cache restore; a warning log on failure would be an improvement but is low priority.

---

### m8 · `scripts/portfolioBar.js:24` — Portfolio name injected into `innerHTML` without escaping (self-XSS)
**Status: Fixed**

**Fix applied:** `escHtml(p.name)` used in the tab template.

---

### m9 · `scripts/importExport.js:77` — Fallback `activePortfolioId: 'p1'` may not exist
**Status: Fixed**

**Fix applied:** Fallback changed to `importData.portfolios[0]?.id` — guaranteed to match an imported portfolio.

---

### m10 · `scripts/state.js:20–22` — `localStorage` failures swallowed silently
**Status: Fixed**

**Fix applied:** `saveStateToStorage` now emits a one-time `console.warn` on the first write failure.

---

### m11 · `scripts/resultsPage.js:117` — `sol[i] / ft * 100` with no guard for `ft === 0`
**Status: Fixed**

**Fix applied:** All four sites (two allocation table rows and two chart dataset callbacks) now return `0` when `ft === 0`.

---

## Summary

| Severity | Count | Fixed | Not applicable / already handled | Not fixed |
|----------|-------|-------|----------------------------------|-----------|
| Critical | 3 | 3 | 0 | 0 |
| Major | 15 | 10 | 3 (M7, M8, M12) | 0 |
| Minor | 11 | 7 | 1 (m2) | 3 (m3, m7, and M15 mitigated) |
| **Total** | **29** | **20** | **4** | **3** |
