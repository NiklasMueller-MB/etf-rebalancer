/**
 * ui-holdings.js
 * Renders and handles interactions for Page 2 (Holdings / investment amount).
 *
 * Depends on: state.js (State, saveState)
 * Event listeners are wired up in app.js after all modules are loaded.
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

function renderHoldingsPage() {
  setInvestmentMode(State.mode);
  document.getElementById('ia').value = State.inv;

  const all = [
    ...State.etfs.filter(e => !e.rf),
    ...State.etfs.filter(e =>  e.rf),
  ];

  document.getElementById('hb').innerHTML = all.map(etf => `<tr>
    <td>
      <span style="font-weight:500">${etf.name}</span><br>
      <span class="cat">${etf.cat || ''}</span>
    </td>
    <td class="hs mono">${etf.ticker || '—'}</td>
    <td class="hs"><span class="badge ${etf.rf ? 'bt' : 'bb'}">${etf.rf ? 'Risk-free' : 'Risky'}</span></td>
    <td>
      <input type="number" class="ism" min="0" step="any" style="width:110px"
             value="${State.h[etf.id] || 0}"
             onchange="State.h[${etf.id}] = parseFloat(this.value) || 0; saveState();">
    </td>
    <td><span class="badge bx">${etf.tgt}%</span></td>
  </tr>`).join('');
}
