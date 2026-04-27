import { getActivePortfolio, updateActivePortfolio } from './state.js';
import { byId, setText, setHTML } from './dom.js';
import { validateAndParseNumber, showInputError, hideInputError } from './validation.js';

function esc(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

function riskyRow(e) {
  return `<tr data-id="${e.id}">
    <td><input type="text" data-field="name" value="${esc(e.name)}"></td>
    <td><input type="text" class="mono" data-field="ticker" value="${esc(e.ticker)}" placeholder="e.g. XZW0.DE"></td>
    <td><input type="text" data-field="cat" value="${esc(e.cat)}"></td>
    <td><input type="number" class="ixs" data-field="tgt" min="0" max="100" step="0.5" value="${e.tgt}"></td>
    <td style="text-align:center"><input type="checkbox" data-field="cr" ${e.cr ? 'checked' : ''}></td>
    <td><button class="btnd" data-action="remove">&times;</button></td>
  </tr>`;
}

function riskFreeRow(e) {
  return `<tr data-id="${e.id}">
    <td><input type="text" data-field="name" value="${esc(e.name)}"></td>
    <td><input type="text" class="mono" data-field="ticker" value="${esc(e.ticker)}" placeholder="blank = cash"></td>
    <td><input type="text" data-field="cat" value="${esc(e.cat)}"></td>
    <td><input type="number" class="ixs" data-field="tgt" min="0" max="100" step="0.5" value="${e.tgt}"></td>
    <td><button class="btnd" data-action="remove">&times;</button></td>
  </tr>`;
}

export function renderSetupPage() {
  const state = getActivePortfolio();
  const rpPct = Math.round(state.rp * 100);
  byId('rp').value = rpPct;
  setText('sp', Math.round((1 - state.rp) * 100));

  const risky = state.etfs.filter(e => !e.rf);
  const riskFree = state.etfs.filter(e => e.rf);
  setHTML('rb', risky.map(riskyRow).join(''));
  setHTML('rfb', riskFree.map(riskFreeRow).join(''));

  attachTableHandlers();
  checkBucket(false);
  checkBucket(true);
}

function attachTableHandlers() {
  const riskyBody = byId('rb');
  const rfBody = byId('rfb');

  riskyBody?.addEventListener('input', onTableInput, { once: false });
  riskyBody?.addEventListener('change', onTableInput, { once: false });
  riskyBody?.addEventListener('click', onTableClick, { once: false });

  rfBody?.addEventListener('input', onTableInput, { once: false });
  rfBody?.addEventListener('change', onTableInput, { once: false });
  rfBody?.addEventListener('click', onTableClick, { once: false });
}

function onTableInput(ev) {
  const target = ev.target;
  if (!(target instanceof HTMLInputElement)) return;
  const field = target.dataset.field;
  if (!field) return;
  const tr = target.closest('tr');
  if (!tr) return;
  const id = Number(tr.dataset.id);
  if (isNaN(id)) return;

  if (field === 'tgt') {
    // Validate target percentage
    const validation = validateAndParseNumber(target.value, { min: 0, max: 100 });
    
    if (!validation.isValid) {
      showInputError(target, validation.error, validation.suggestedValue);
      return;
    }
    
    hideInputError(target);
  }

  updateActivePortfolio(prev => {
    const etfs = prev.etfs.map(e => {
      if (e.id !== id) return e;
      let value;
      if (field === 'tgt') {
        value = parseFloat(target.value) || 0;
      } else if (field === 'cr') {
        value = target.checked;
      } else if (field === 'ticker') {
        value = target.value.trim();
      } else {
        value = target.value;
      }
      return { ...e, [field]: value };
    });
    return { ...prev, etfs };
  });

  const isRf = !!getActivePortfolio().etfs.find(e => e.id === id)?.rf;
  checkBucket(isRf);
}

function onTableClick(ev) {
  const target = ev.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.action !== 'remove') return;
  const tr = target.closest('tr');
  if (!tr) return;
  const id = Number(tr.dataset.id);
  if (isNaN(id)) return;

  updateActivePortfolio(prev => {
    const etf = prev.etfs.find(e => e.id === id);
    const etfs = prev.etfs.filter(e => e.id !== id);
    const h = { ...prev.h };
    delete h[id];
    return { ...prev, etfs, h };
  });

  renderSetupPage();
}

function checkBucket(rf) {
  const state = getActivePortfolio();
  const bucket = state.etfs.filter(e => e.rf === rf);
  const sum = bucket.reduce((a, e) => a + Number(e.tgt), 0);
  const el = byId(rf ? 'rfm' : 'rm');
  if (!el) return true;
  if (sum === 0) {
    el.innerHTML = '';
    return true;
  }
  if (Math.abs(sum - 100) > 0.01) {
    el.innerHTML = `<div class="msg mw">${rf ? 'Risk-free' : 'Risky'} targets sum to ${sum.toFixed(1)}% — must equal 100%</div>`;
    return false;
  }
  el.innerHTML = `<div class="msg mo">${rf ? 'Risk-free' : 'Risky'} targets sum to 100% ✓</div>`;
  return true;
}

export function validateSetup() {
  if (!checkBucket(false)) {
    alert('Risky asset targets must sum to 100%.');
    return false;
  }
  if (!checkBucket(true)) {
    alert('Risk-free asset targets must sum to 100%.');
    return false;
  }
  return true;
}

export function initSetupPage() {
  const rpInput = byId('rp');
  const addRisky = byId('add-risky');
  const addRiskFree = byId('add-riskfree');

  rpInput?.addEventListener('input', () => {
    // Validate risk percentage
    const validation = validateAndParseNumber(rpInput.value, { min: 0, max: 100 });
    
    if (!validation.isValid) {
      showInputError(rpInput, validation.error, validation.suggestedValue);
      return;
    }
    
    hideInputError(rpInput);
    
    const raw = parseFloat(rpInput.value) || 0;
    const pct = Math.min(100, Math.max(0, raw));
    const frac = pct / 100;
    updateActivePortfolio(prev => ({ ...prev, rp: frac }));
    setText('sp', Math.round((1 - frac) * 100));
  });


  addRisky?.addEventListener('click', () => {
    updateActivePortfolio(prev => {
      const nextId = prev.nid ?? 1;
      const etfs = prev.etfs.concat({
        id: nextId,
        isin: '',
        ticker: '',
        name: 'New asset',
        rf: false,
        cr: false,
        cat: '',
        tgt: 0
      });
      return { ...prev, etfs, nid: nextId + 1 };
    });
    renderSetupPage();
  });

  addRiskFree?.addEventListener('click', () => {
    updateActivePortfolio(prev => {
      const nextId = prev.nid ?? 1;
      const etfs = prev.etfs.concat({
        id: nextId,
        isin: '',
        ticker: '',
        name: 'New asset',
        rf: true,
        cr: false,
        cat: '',
        tgt: 0
      });
      return { ...prev, etfs, nid: nextId + 1 };
    });
    renderSetupPage();
  });
}

