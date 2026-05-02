# Frontend Error Report

Reviewed: 2026-05-02  
Scope: UI interactions, button reactivity, dark/light mode colors, input validation, navigation  
Method: Playwright E2E test suite (`tests/e2e/`, 106 automated tests — all pass)

---

## How to Run the Tests

```bash
cd tests
npm install
npx playwright test                          # all tests, headless Chromium
npx playwright test --reporter=html          # visual report in tests/playwright-report/
npx playwright test e2e/buttons.spec.js      # single spec file
```

The test suite starts a local dev server automatically (`npx serve ..` on port 3000).

---

## Critical

No critical frontend errors were found. All navigation buttons are reactive, all pages render correctly, and both color themes apply as expected.

---

## Major

---

### F1 · Comma-decimal validation is dead code for all `input[type=number]` elements

**Status: Not fixed**

**Affected files:** `scripts/validation.js:1-36`, `scripts/setupPage.js:162`, `scripts/holdingsPage.js`, `scripts/resultsPage.js:302,330,344`

The function `validateNumberFormat(input)` in `validation.js` checks whether the string `input` contains a comma (`,`) decimal separator and, if so, returns an error with a "Fix" button that replaces it with a period. However, every call site passes `inputElement.value` from an `input[type=number]` element:

```js
// Example from setupPage.js:162
const validation = validateAndParseNumber(rpInput.value, { min: 0, max: 100 });
```

**The problem:** The HTML spec requires that `input[type=number]` sanitises its value before exposing it to JavaScript. When a user types `7,5` into a number input, the browser silently discards the comma — `inputElement.value` returns `""` (empty string) or the last valid numeric value, never `"7,5"`. As a result:

- The comma check inside `validateNumberFormat` never matches
- The "Fix: 7.5" button is never shown
- Users with a locale that uses `,` as the decimal separator receive no feedback; their input is silently lost

**Steps to reproduce:** Open the app on a German/French locale keyboard, type `7,5` into the Risk % field. The field accepts nothing and shows no error or suggestion.

**Evidence:** `tests/e2e/validation.spec.js` — *"Comma decimal in risk% — browser sanitizes to empty, no Fix button shown (known limitation)"* documents this behaviour. The companion test *"validateNumberFormat detects comma in string (unit-level check)"* confirms the JS function itself can detect commas, but they never reach it via number inputs.

**Suggested fix:** Change all numeric input fields that need comma-decimal support to `type="text"` with `inputmode="decimal"` (preserves numeric keyboard on mobile, allows any character, comma detection then works), or intercept the `keydown`/`input` event before the browser sanitizes the value.

---

## Minor

---

### F2 · Risk % accepts 0 and 100 without validation error

**Status: Not fixed**

`scripts/setupPage.js:162` validates the risk-% input with `{ min: 0, max: 100 }`. Values of exactly `0` and `100` pass validation silently, resulting in a degenerate portfolio:

- **Risk = 0%:** all assets are risk-free; the risky bucket is empty but still rendered
- **Risk = 100%:** all assets are risky; the risk-free bucket (including Cash) is empty but the app still tries to allocate 0% across those assets

Neither state is explicitly blocked, but it can lead to confusing optimizer output (one bucket has 0 total allocation). The current tests document this as intentional behavior (`setup-page.spec.js` — *"Risk % of 0/100 is accepted without error (edge case)"*), but it may warrant a warning.

---

### F3 · Investment amount of €0 is accepted without error or explanation

**Status: Not fixed**

`scripts/resultsPage.js:302` validates the investment amount with `{ min: 0 }` (default `allowZero: true`). A value of €0 is silently accepted. When the user clicks "Calculate optimal trades" with a €0 investment amount:

- In **savings mode:** no trades are displayed; the trades card appears with an empty table and no explanation
- In **one-time mode:** similarly, no trades are shown

There is no message explaining that €0 means "no new investment" or redirecting the user. The test `validation.spec.js` — *"Zero investment amount is accepted without error"* confirms the current behaviour.

**Suggested fix:** Show an informational note (not an error) when investment amount is 0, e.g. *"Set an amount above €0 to get trade recommendations."*

---

### F4 · Portfolio rename icon hidden for single-portfolio users

**Status: Not fixed — by design, partially**

`scripts/portfolioBar.js:22` only renders the rename (✏) and delete (×) icons when `portfolios.length > 1` (`canClose = portfolios.length > 1`). Users with a single portfolio have no visible rename icon.

The rename action IS available via **double-click** on the tab label (`portfolioBar.js:104`), but this interaction is undiscovered. The tooltip on the tab reads *"Click portfolio name to switch, double-click to rename"* — this is the intended mechanism, but it is easy to miss.

The test `portfolio-bar.spec.js` — *"Rename button is only visible when 2+ portfolios exist"* explicitly documents this behavior.

**Suggested fix:** Either always show the rename icon (removing it for delete-only makes sense — you can't delete the last portfolio — but rename is always valid), or add a visible label/tooltip hint to single-portfolio users.

---

### F5 · CLAUDE.md lists four modules that do not exist in the codebase

**Status: Documentation error**

`CLAUDE.md` describes four modules that are not present in `scripts/`:

| Module in docs | Status |
|---|---|
| `scripts/analytics.js` | File does not exist |
| `scripts/basicAnalytics.js` | File does not exist |
| `scripts/consent.js` | File does not exist |
| `scripts/settingsModal.js` | File does not exist |

Neither `index.html` nor any JS module imports or references these files, so there is no runtime impact. However, the documentation describes their interfaces and behavior as if they exist, which creates confusion for contributors.

**Suggested fix:** Remove these four entries from `CLAUDE.md`, or create stub files with `// TODO` markers if the features are planned.

---

## Summary

| Severity | Count | Status |
|---|---|---|
| Critical | 0 | — |
| Major | 1 | F1 — comma validation dead code |
| Minor | 4 | F2–F5 |
| **Total** | **5** | 0 fixed, 5 open |

All 5 items above were identified by running the Playwright suite in `tests/`. The suite covers:
- 18+ buttons for visibility and click reactivity (`buttons.spec.js`)
- Full step 1 → 2 → 3 navigation and back-navigation (`navigation.spec.js`)
- Setup page interactions (risk %, add/delete rows, bucket validation) (`setup-page.spec.js`)
- Holdings page (inputs, fetch-prices modal, readonly cash field) (`holdings-page.spec.js`)
- Results page (tabs, optimization, trade table, trading warning) (`results-page.spec.js`)
- Portfolio bar (add, delete, rename, max-5 enforcement) (`portfolio-bar.spec.js`)
- Dark mode and light mode CSS variable correctness and contrast ratio (`color-theme.spec.js`)
- All numeric input validation with error display and red-border styling (`validation.spec.js`)
