/**
 * app.js
 * Top-level orchestration: page navigation, fetch-and-calculate trigger,
 * and bootstrap. Loaded last, after all other modules.
 *
 * Depends on: state.js, prices.js, optimizer.js, ui-setup.js, ui-holdings.js, ui-results.js
 */

// ── Page navigation ────────────────────────────────────────────────────────

function showPage(n) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('p' + n).classList.add('active');

  [1, 2, 3].forEach(i => {
    const el = document.getElementById('s' + i);
    el.className = 'step' + (i === n ? ' active' : i < n ? ' done' : '');
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToSetup() {
  showPage(1);
  renderSetupPage();
}

function goToHoldings() {
  if (!validateSetup()) return;
  saveState();
  showPage(2);
  renderHoldingsPage();
}

function goBackToHoldings() {
  showPage(2);
  renderHoldingsPage();
}

// ── Fetch & calculate ──────────────────────────────────────────────────────

async function fetchAndCalculate() {
  State.inv = parseFloat(document.getElementById('ia').value) || 0;
  saveState();

  const btn     = document.getElementById('fb');
  const spinner = document.getElementById('fs');
  btn.disabled  = true;
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
// Scripts are placed at the end of <body>, so the DOM is already parsed when
// this runs. We wire up all persistent event listeners here (instead of
// relying on DOMContentLoaded inside the other modules) to keep one clear
// entry point.

// Risky-fraction slider
document.getElementById('rp').addEventListener('input', function () {
  State.rp = Math.min(100, Math.max(0, parseFloat(this.value) || 0)) / 100;
  document.getElementById('sp').textContent = Math.round((1 - State.rp) * 100);
  saveState();
});

// Default investment amount
document.getElementById('di').addEventListener('change', function () {
  State.di = parseFloat(this.value) || 0;
  saveState();
});

// Investment amount on page 2
document.getElementById('ia').addEventListener('change', function () {
  State.inv = parseFloat(this.value) || 0;
  saveState();
});

// Initial render of Page 1
renderSetupPage();
