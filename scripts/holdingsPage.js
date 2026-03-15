import { getActivePortfolio, updateActivePortfolio } from './state.js';
import { byId, setHTML } from './dom.js';

function validateNumberFormat(input) {
  const value = input.trim();
  
  // Check if the input contains comma as decimal separator
  if (value.includes(',') && !value.includes('.')) {
    // Count commas - if more than 1, it's likely a thousands separator, not decimal
    const commaCount = (value.match(/,/g) || []).length;
    if (commaCount === 1) {
      // Check if it's in a decimal position (not at the end)
      const parts = value.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        return {
          isValid: false,
          error: 'Please use point (.) as decimal separator instead of comma (,)',
          suggestedValue: value.replace(',', '.')
        };
      }
    }
  }
  
  // Check if it's a valid number format
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    return {
      isValid: false,
      error: 'Please enter a valid number',
      suggestedValue: null
    };
  }
  
  return {
    isValid: true,
    error: null,
    suggestedValue: null
  };
}

function showInputError(inputElement, message, suggestedValue = null) {
  // Remove any existing error message
  hideInputError(inputElement);
  
  // Create error message element
  const errorDiv = document.createElement('div');
  errorDiv.className = 'input-error';
  errorDiv.style.cssText = `
    color: #e74c3c;
    font-size: 12px;
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
  `;
  
  errorDiv.innerHTML = `
    <span style="font-size: 14px;">⚠️</span>
    <span>${message}</span>
    ${suggestedValue ? `<button class="fix-format-btn" style="background: #3498db; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 11px; cursor: pointer; margin-left: 8px;">Fix: ${suggestedValue}</button>` : ''}
  `;
  
  // Insert error after the input's parent
  inputElement.parentNode.style.position = 'relative';
  inputElement.parentNode.appendChild(errorDiv);
  
  // Add red border to input
  inputElement.style.borderColor = '#e74c3c';
  
  // Add click handler for fix button
  if (suggestedValue) {
    const fixBtn = errorDiv.querySelector('.fix-format-btn');
    fixBtn.addEventListener('click', () => {
      inputElement.value = suggestedValue;
      hideInputError(inputElement);
      // Trigger change event to update the value
      inputElement.dispatchEvent(new Event('change'));
    });
  }
}

function hideInputError(inputElement) {
  const existingError = inputElement.parentNode.querySelector('.input-error');
  if (existingError) {
    existingError.remove();
  }
  inputElement.style.borderColor = '';
}

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
    // Validate the input format
    const validation = validateNumberFormat(ia.value);
    
    if (!validation.isValid) {
      showInputError(ia, validation.error, validation.suggestedValue);
      // Don't update the state if the format is invalid
      return;
    }
    
    // Clear any existing error
    hideInputError(ia);
    
    // Parse the valid number and update state
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
    
    // Validate the input format
    const validation = validateNumberFormat(target.value);
    
    if (!validation.isValid) {
      showInputError(target, validation.error, validation.suggestedValue);
      // Don't update the state if the format is invalid
      return;
    }
    
    // Clear any existing error
    hideInputError(target);
    
    // Parse the valid number and update state
    const value = parseFloat(target.value) || 0;
    updateActivePortfolio(prev => {
      const h = { ...prev.h, [id]: value };
      return { ...prev, h };
    });
  });
}

