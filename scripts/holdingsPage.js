import { getActivePortfolio, updateActivePortfolio } from './state.js';
import { byId, setHTML } from './dom.js';
import { validateAndParseNumber, showInputError, hideInputError } from './validation.js';
import { fetchAllPrices } from './pricingService.js';

function showFetchPricesWarning() {
  const state = getActivePortfolio();
  const hasManualPrices = Object.keys(state.manualPrices).length > 0;
  
  const message = hasManualPrices 
    ? 'You already have manually entered prices. Fetching prices will overwrite your manual entries. Choose an option:'
    : 'Fetch prices for all ETFs? Choose an option:';
    
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;
  
  dialog.innerHTML = `
    <div style="background: white; padding: 20px; border-radius: 8px; max-width: 400px; margin: 20px;">
      <h3 style="margin-top: 0; color: #333;">Fetch Prices</h3>
      <p style="margin-bottom: 20px; color: #666;">${message}</p>
      <div style="display: flex; gap: 10px; flex-direction: column;">
        <button class="btn btnp" id="fetch-all-btn">Fetch All Prices</button>
        ${hasManualPrices ? '<button class="btn btns" id="fetch-empty-btn">Fetch Only Empty Fields</button>' : ''}
        <button class="btn" id="cancel-fetch-btn">Cancel</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  const closeDialog = () => {
    document.body.removeChild(dialog);
  };
  
  dialog.querySelector('#fetch-all-btn')?.addEventListener('click', () => {
    closeDialog();
    fetchPrices('all');
  });
  
  dialog.querySelector('#fetch-empty-btn')?.addEventListener('click', () => {
    closeDialog();
    fetchPrices('empty');
  });
  
  dialog.querySelector('#cancel-fetch-btn')?.addEventListener('click', closeDialog);
  
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeDialog();
  });
}

async function fetchPrices(mode) {
  const btn = byId('fetch-prices-btn');
  const originalText = btn.textContent;
  
  if (btn) {
    btn.disabled = true;
    btn.textContent = '🔄 Fetching...';
  }
  
  try {
    const state = getActivePortfolio();
    const priceData = await fetchAllPrices(state.etfs);
    
    updateActivePortfolio(prev => {
      const updatedManualPrices = { ...prev.manualPrices };
      const etfsToFetch = mode === 'all' 
        ? prev.etfs 
        : prev.etfs.filter(e => !updatedManualPrices[e.id]);
      
      etfsToFetch.forEach(e => {
        if (priceData.pricesById[e.id] !== undefined) {
          updatedManualPrices[e.id] = priceData.pricesById[e.id];
        }
      });
      
      return { ...prev, manualPrices: updatedManualPrices };
    });
    
    renderHoldingsTable();
    
    // Check for any failed fetches
    if (priceData.hasErrors && priceData.failedFetches.length > 0) {
      highlightMissingPrices(priceData.failedFetches.map(f => f.etf.id));
      alert(`Could not fetch prices for: ${priceData.failedFetches.map(f => f.etf.name).join(', ')}\n\nPlease enter these prices manually (highlighted in amber).`);
    }
    
  } catch (err) {
    alert('Error fetching prices: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

function highlightMissingPrices(etfIds) {
  etfIds.forEach(id => {
    const input = document.querySelector(`tr[data-id="${id}"] input[data-field="price"]`);
    if (input) {
      input.classList.add('highlighted');
    }
  });
}

function clearPriceHighlight(input) {
  if (input) {
    input.classList.remove('highlighted');
  }
}

function renderHoldingsTable() {
  const state = getActivePortfolio();
  const all = [...state.etfs.filter(e => !e.rf), ...state.etfs.filter(e => e.rf)];
  const rows = all.map(e => {
    const held = state.h[e.id] || 0;
    // Auto-set price to 1 for cash/risk-free assets with empty ticker
    let manualPrice = state.manualPrices[e.id] || '';
    if (e.rf && !e.ticker && !manualPrice) {
      manualPrice = '1';
    }
    const badgeClass = e.rf ? 'bt' : 'bb';
    const typeLabel = e.rf ? 'Risk-free' : 'Risky';
    return `<tr data-id="${e.id}">
      <td><span style="font-weight:500">${e.name}</span><br><span class="cat">${e.cat || ''}</span></td>
      <td class="hs mono">${e.ticker || '—'}</td>
      <td class="hs"><span class="badge ${badgeClass}">${typeLabel}</span></td>
      <td><input type="number" class="ism" min="0" step="any" style="width:110px" value="${held}" data-field="held"></td>
      <td><input type="number" class="ism price-input${e.rf && !e.ticker ? ' readonly' : ''}" min="0" step="0.01" style="width:100px" value="${manualPrice}" placeholder="0.00" data-field="price" ${e.rf && !e.ticker ? 'readonly' : ''}></td>
    </tr>`;
  }).join('');
  setHTML('hb', rows);
}

export function renderHoldingsPage() {
  const state = getActivePortfolio();
  
  // Auto-save price 1 for cash/risk-free assets with empty ticker
  const updatedManualPrices = { ...state.manualPrices };
  let hasChanges = false;
  
  state.etfs.forEach(e => {
    if (e.rf && !e.ticker && !updatedManualPrices[e.id]) {
      updatedManualPrices[e.id] = 1;
      hasChanges = true;
    }
  });
  
  if (hasChanges) {
    updateActivePortfolio(prev => ({ ...prev, manualPrices: updatedManualPrices }));
  }
  
  renderHoldingsTable();
}


export function initHoldingsPage() {
  const hb = byId('hb');
  const fetchPricesBtn = byId('fetch-prices-btn');

  fetchPricesBtn?.addEventListener('click', () => {
    showFetchPricesWarning();
  });

  hb?.addEventListener('change', ev => {
    const target = ev.target;
    if (!(target instanceof HTMLInputElement)) return;
    
    if (target.dataset.field === 'held') {
      const tr = target.closest('tr');
      if (!tr) return;
      const id = Number(tr.dataset.id);
      if (!id) return;
      
      // Validate the holdings input
      const validation = validateAndParseNumber(target.value, { min: 0 });
      
      if (!validation.isValid) {
        showInputError(target, validation.error, validation.suggestedValue);
        return;
      }
      
      hideInputError(target);
      
      const value = parseFloat(target.value) || 0;
      updateActivePortfolio(prev => {
        const h = { ...prev.h, [id]: value };
        return { ...prev, h };
      });
    } else if (target.dataset.field === 'price') {
      const tr = target.closest('tr');
      if (!tr) return;
      const id = Number(tr.dataset.id);
      if (!id) return;
      
      // Don't allow editing of cash/risk-free prices (they should remain 1)
      const etf = state.etfs.find(e => e.id === id);
      if (etf && etf.rf && !etf.ticker) {
        return; // Skip editing for cash assets
      }
      
      // Clear highlighting when user manually enters a price
      clearPriceHighlight(target);
      
      // Validate the price input
      const validation = validateAndParseNumber(target.value, { min: 0 });
      
      if (!validation.isValid) {
        showInputError(target, validation.error, validation.suggestedValue);
        return;
      }
      
      hideInputError(target);
      
      const value = parseFloat(target.value) || 0;
      updateActivePortfolio(prev => {
        const manualPrices = { ...prev.manualPrices };
        if (value > 0) {
          manualPrices[id] = value;
        } else {
          delete manualPrices[id];
        }
        return { ...prev, manualPrices };
      });
    }
  });
}

