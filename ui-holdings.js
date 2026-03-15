/**
 * ui-holdings.js
 * Renders and handles interactions for Page 2 (Holdings / investment amount).
 *
 * Depends on: state.js (State, saveState)
 */

/**
 * Switch the investment mode ('onetime' | 'savings') and update the UI.
 * Exposed globally so the tab buttons can call it.
 */
function setInvestmentMode(mode) {
  State.mode = mode;

  document.getElementById('to').classList.toggle('active', mode === 'onetime');
  document.getElementById('ts').classList.toggle('active', mode === 'savings');
  document.getElementById('mh').textContent =
    mode === 'onetime'
      ? 'invested as a one-time purchase'
      : 'per month (3× used for target calculation)';

  saveState();
}

/** Render Page 2 from State. */
function renderHoldingsPage() {
  setInvestmentMode(State.mode);
  document.getElementById('ia').value = State.inv;

  // All ETFs: risky first, then risk-free
  const all = [
    ...State.etfs.filter(e => !e.rf),
    ...State.etfs.filter(e =>  e.rf),
  ];

  document.getElementById('hb').innerHTML = all.map(etf => `
    <tr>
      <td>
        <span style="font-weight:500">${etf.name}</span><br>
        <span class="cat">${etf.cat || ''}</span>
      </td>
      <td class="hs mono">${etf.ticker || '—'}</td>
      <td class="hs">
        <span class="badge ${etf.rf ? 'bt' : 'bb'}">${etf.rf ? 'Risk-free' : 'Risky'}</span>
      </td>
      <td>
        <input type="number" class="ism" min="0" step="any" style="width:110px"
               value="${State.h[etf.id] || 0}"
               onchange="State.h[${etf.id}] = parseFloat(this.value) || 0; saveState();">
      </td>
      <td><span class="badge bx">${etf.tgt}%</span></td>
    </tr>
  `).join('');
}

// ── Wire up investment amount input ───────────────────────────────────────

document.getElementById('ia').addEventListener('change', function () {
  State.inv = parseFloat(this.value) || 0;
  saveState();
});
