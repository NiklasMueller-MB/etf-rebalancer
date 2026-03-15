import { getActivePortfolio, updateActivePortfolio } from './state.js';
import { byId, setHTML } from './dom.js';

function renderHoldingsTable() {
  const state = getActivePortfolio();
  const all = [...state.etfs.filter(e => !e.rf), ...state.etfs.filter(e => e.rf)];
  const rows = all.map(e => {
    const held = state.h[e.id] || 0;
    const badgeClass = e.rf ? 'bt' : 'bb';
    const typeLabel = e.rf ? 'Risk-free' : 'Risky';
    return `<tr data-id="${e.id}">
      <td><span style="font-weight:500">${e.name}</span><br><span class="cat">${e.cat || ''}</span></td>
      <td class="hs mono">${e.ticker || '—'}</td>
      <td class="hs"><span class="badge ${badgeClass}">${typeLabel}</span></td>
      <td><input type="number" class="ism" min="0" step="any" style="width:110px" value="${held}" data-field="held"></td>
      <td><span class="badge bx">${e.tgt}%</span></td>
    </tr>`;
  }).join('');
  setHTML('hb', rows);
}

export function renderHoldingsPage() {
  const state = getActivePortfolio();
  setMode(state.mode);
  const ia = byId('ia');
  if (ia) ia.value = state.inv;
  renderHoldingsTable();
}

function setMode(mode) {
  const to = byId('to');
  const ts = byId('ts');
  to?.classList.toggle('active', mode === 'onetime');
  ts?.classList.toggle('active', mode === 'savings');
  const mh = byId('mh');
  if (mh) {
    mh.textContent = mode === 'onetime'
      ? 'invested as a one-time purchase'
      : 'per month (3× used for target calculation)';
  }
}

export function initHoldingsPage() {
  const to = byId('to');
  const ts = byId('ts');
  const ia = byId('ia');
  const hb = byId('hb');

  to?.addEventListener('click', () => {
    updateActivePortfolio(prev => ({ ...prev, mode: 'onetime' }));
    setMode('onetime');
  });

  ts?.addEventListener('click', () => {
    updateActivePortfolio(prev => ({ ...prev, mode: 'savings' }));
    setMode('savings');
  });

  ia?.addEventListener('change', () => {
    const v = parseFloat(ia.value) || 0;
    updateActivePortfolio(prev => ({ ...prev, inv: v }));
  });

  hb?.addEventListener('change', ev => {
    const target = ev.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.field !== 'held') return;
    const tr = target.closest('tr');
    if (!tr) return;
    const id = Number(tr.dataset.id);
    if (!id) return;
    const value = parseFloat(target.value) || 0;
    updateActivePortfolio(prev => {
      const h = { ...prev.h, [id]: value };
      return { ...prev, h };
    });
  });
}

