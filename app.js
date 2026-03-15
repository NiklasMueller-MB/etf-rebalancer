/**
 * app.js
 * Top-level orchestration: page navigation, fetch-and-calculate trigger.
 *
 * Depends on all other modules:
 *   state.js, prices.js, optimizer.js, ui-setup.js, ui-holdings.js, ui-results.js
 */

// ── Page navigation ────────────────────────────────────────────────────────

/**
 * Show the given page number (1–3) and update step indicators.
 * @param {number} n
 */
function showPage(n) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('p' + n).classList.add('active');

  [1, 2, 3].forEach(i => {
    const el = document.getElementById('s' + i);
    el.className = 'step' + (i === n ? ' active' : i < n ? ' done' : '');
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Navigate to Page 1 and re-render setup. */
function goToSetup() {
  showPage(1);
  renderSetupPage();
}

/** Validate setup, then navigate to Page 2 and render holdings. */
function goToHoldings() {
  if (!validateSetup()) return;
  saveState();
  showPage(2);
  renderHoldingsPage();
}

/** Navigate back to Page 2. */
function goBackToHoldings() {
  showPage(2);
  renderHoldingsPage();
}

// ── Fetch prices & calculate ───────────────────────────────────────────────

/**
 * Triggered by the "Fetch prices & calculate" button on Page 2.
 * Fetches live prices for all ETFs, then renders the results page.
 */
async function fetchAndCalculate() {
  // Sync the investment amount from the input field
  State.inv = parseFloat(document.getElementById('ia').value) || 0;
  saveState();

  const btn    = document.getElementById('fb');
  const spinner = document.getElementById('fs');

  btn.disabled = true;
  spinner.style.display = 'inline-block';

  try {
    const priceData = await fetchAllPrices(State.etfs);

    showPage(3);
    renderResults(priceData);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

// Render Page 1 on initial load
renderSetupPage();
