/**
 * ui-setup.js
 * Renders and handles interactions for Page 1 (Setup / target allocation).
 *
 * Depends on: state.js (State, saveState, updateEtf, addEtf, removeEtf)
 */

/** Escape HTML special characters for safe injection. */
function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** Build a table row for a risky asset. */
function buildRiskyRow(etf) {
  return `
    <tr>
      <td><input type="text" value="${escHtml(etf.name)}"
            onchange="updateEtf(${etf.id},'name',this.value)"></td>
      <td><input type="text" class="mono" value="${escHtml(etf.ticker)}"
            onchange="updateEtf(${etf.id},'ticker',this.value.trim())"
            placeholder="e.g. XZW0.DE"></td>
      <td><input type="text" value="${escHtml(etf.cat)}"
            onchange="updateEtf(${etf.id},'cat',this.value)"></td>
      <td><input type="number" class="ixs" min="0" max="100" step="0.5"
            value="${etf.tgt}"
            onchange="updateEtf(${etf.id},'tgt',parseFloat(this.value)||0)"></td>
      <td style="text-align:center">
        <input type="checkbox" ${etf.cr ? 'checked' : ''}
               onchange="updateEtf(${etf.id},'cr',this.checked)">
      </td>
      <td><button class="btnd" onclick="handleRemoveEtf(${etf.id})">&times;</button></td>
    </tr>`;
}

/** Build a table row for a risk-free asset. */
function buildRiskFreeRow(etf) {
  return `
    <tr>
      <td><input type="text" value="${escHtml(etf.name)}"
            onchange="updateEtf(${etf.id},'name',this.value)"></td>
      <td><input type="text" class="mono" value="${escHtml(etf.ticker)}"
            onchange="updateEtf(${etf.id},'ticker',this.value.trim())"
            placeholder="blank = cash"></td>
      <td><input type="text" value="${escHtml(etf.cat)}"
            onchange="updateEtf(${etf.id},'cat',this.value)"></td>
      <td><input type="number" class="ixs" min="0" max="100" step="0.5"
            value="${etf.tgt}"
            onchange="updateEtf(${etf.id},'tgt',parseFloat(this.value)||0)"></td>
      <td><button class="btnd" onclick="handleRemoveEtf(${etf.id})">&times;</button></td>
    </tr>`;
}

/**
 * Validate that target weights for one bucket sum to 100%.
 * Shows a status message and returns true/false.
 *
 * @param {boolean} isRiskFree
 * @returns {boolean}
 */
function checkBucketSum(isRiskFree) {
  const bucket = State.etfs.filter(e => e.rf === isRiskFree);
  const sum    = bucket.reduce((a, e) => a + Number(e.tgt), 0);
  const msgEl  = document.getElementById(isRiskFree ? 'rfm' : 'rm');
  if (!msgEl) return true;

  if (sum === 0) { msgEl.innerHTML = ''; return true; }

  if (Math.abs(sum - 100) > 0.01) {
    msgEl.innerHTML = `<div class="msg mw">${isRiskFree ? 'Risk-free' : 'Risky'} targets sum to ${sum.toFixed(1)}% — must equal 100%</div>`;
    return false;
  }

  msgEl.innerHTML = `<div class="msg mo">${isRiskFree ? 'Risk-free' : 'Risky'} targets sum to 100% ✓</div>`;
  return true;
}

/** Re-render the full Setup page from State. */
function renderSetupPage() {
  document.getElementById('rp').value = Math.round(State.rp * 100);
  document.getElementById('sp').textContent = Math.round((1 - State.rp) * 100);
  document.getElementById('di').value = State.di;

  document.getElementById('rb').innerHTML  = State.etfs.filter(e => !e.rf).map(buildRiskyRow).join('');
  document.getElementById('rfb').innerHTML = State.etfs.filter(e =>  e.rf).map(buildRiskFreeRow).join('');

  checkBucketSum(false);
  checkBucketSum(true);
}

/**
 * Validate setup before proceeding.
 * Shows alerts and returns false if validation fails.
 */
function validateSetup() {
  if (!checkBucketSum(false)) { alert('Risky asset targets must sum to 100%.'); return false; }
  if (!checkBucketSum(true))  { alert('Risk-free asset targets must sum to 100%.'); return false; }
  return true;
}

// ── Event handlers exposed to inline HTML ──────────────────────────────────

/** Called when user removes an asset row. */
function handleRemoveEtf(id) {
  removeEtf(id);
  renderSetupPage();
}

/** Called by "Add risky/risk-free asset" buttons. */
function handleAddEtf(isRiskFree) {
  addEtf(isRiskFree);
  renderSetupPage();
}

// ── Wire up persistent controls ───────────────────────────────────────────

document.getElementById('rp').addEventListener('input', function () {
  State.rp = Math.min(100, Math.max(0, parseFloat(this.value) || 0)) / 100;
  document.getElementById('sp').textContent = Math.round((1 - State.rp) * 100);
  saveState();
});

document.getElementById('di').addEventListener('change', function () {
  State.di = parseFloat(this.value) || 0;
  saveState();
});
