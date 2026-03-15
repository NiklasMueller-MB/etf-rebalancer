/**
 * ui-setup.js
 * Renders and handles interactions for Page 1 (Setup / target allocation).
 *
 * Depends on: state.js (State, saveState, getEtf, updateEtf, addEtf, removeEtf)
 * Event listeners are wired up in app.js after all modules are loaded.
 */

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Update an ETF field and refresh the bucket-sum validation banner.
 * Called from inline onchange handlers in generated table rows.
 */
function updateEtfAndCheck(id, field, value) {
  updateEtf(id, field, value);
  const etf = getEtf(id);
  if (etf) checkBucketSum(etf.rf);
}

function buildRiskyRow(etf) {
  return `<tr>
    <td><input type="text" value="${escHtml(etf.name)}"
          onchange="updateEtfAndCheck(${etf.id},'name',this.value)"></td>
    <td><input type="text" class="mono" value="${escHtml(etf.ticker)}"
          onchange="updateEtfAndCheck(${etf.id},'ticker',this.value.trim())"
          placeholder="e.g. XZW0.DE"></td>
    <td><input type="text" value="${escHtml(etf.cat)}"
          onchange="updateEtfAndCheck(${etf.id},'cat',this.value)"></td>
    <td><input type="number" class="ixs" min="0" max="100" step="0.5"
          value="${etf.tgt}"
          onchange="updateEtfAndCheck(${etf.id},'tgt',parseFloat(this.value)||0)"></td>
    <td style="text-align:center">
      <input type="checkbox" ${etf.cr ? 'checked' : ''}
             onchange="updateEtfAndCheck(${etf.id},'cr',this.checked)">
    </td>
    <td><button class="btnd" onclick="handleRemoveEtf(${etf.id})">&times;</button></td>
  </tr>`;
}

function buildRiskFreeRow(etf) {
  return `<tr>
    <td><input type="text" value="${escHtml(etf.name)}"
          onchange="updateEtfAndCheck(${etf.id},'name',this.value)"></td>
    <td><input type="text" class="mono" value="${escHtml(etf.ticker)}"
          onchange="updateEtfAndCheck(${etf.id},'ticker',this.value.trim())"
          placeholder="blank = cash"></td>
    <td><input type="text" value="${escHtml(etf.cat)}"
          onchange="updateEtfAndCheck(${etf.id},'cat',this.value)"></td>
    <td><input type="number" class="ixs" min="0" max="100" step="0.5"
          value="${etf.tgt}"
          onchange="updateEtfAndCheck(${etf.id},'tgt',parseFloat(this.value)||0)"></td>
    <td><button class="btnd" onclick="handleRemoveEtf(${etf.id})">&times;</button></td>
  </tr>`;
}

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

function renderSetupPage() {
  document.getElementById('rp').value = Math.round(State.rp * 100);
  document.getElementById('sp').textContent = Math.round((1 - State.rp) * 100);
  document.getElementById('di').value = State.di;

  document.getElementById('rb').innerHTML  = State.etfs.filter(e => !e.rf).map(buildRiskyRow).join('');
  document.getElementById('rfb').innerHTML = State.etfs.filter(e =>  e.rf).map(buildRiskFreeRow).join('');

  checkBucketSum(false);
  checkBucketSum(true);
}

function validateSetup() {
  if (!checkBucketSum(false)) { alert('Risky asset targets must sum to 100%.'); return false; }
  if (!checkBucketSum(true))  { alert('Risk-free asset targets must sum to 100%.'); return false; }
  return true;
}

// Called from inline onclick in generated rows
function handleRemoveEtf(id) {
  removeEtf(id);
  renderSetupPage();
}

function handleAddEtf(isRiskFree) {
  addEtf(isRiskFree);
  renderSetupPage();
}
