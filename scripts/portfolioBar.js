import { getState, setActivePortfolio, addPortfolio, removePortfolio, renamePortfolio, getActivePortfolio } from './state.js';
import { byId } from './dom.js';
import { renderSetupPage } from './setupPage.js';
import { renderHoldingsPage } from './holdingsPage.js';

function getCurrentPage() {
  const p1 = document.getElementById('p1');
  const p2 = document.getElementById('p2');
  const p3 = document.getElementById('p3');
  if (p3 && p3.classList.contains('active')) return 3;
  if (p2 && p2.classList.contains('active')) return 2;
  return 1;
}

export function renderPortfolioBar() {
  const { portfolios, activePortfolioId } = getState();
  const container = byId('ptabs');
  if (!container) return;
  const tabs = portfolios
    .map(p => {
      const isActive = p.id === activePortfolioId;
      const canClose = portfolios.length > 1;
      return `<button class="ptab${isActive ? ' active' : ''}" data-id="${p.id}" title="Click portfolio name to switch, double-click to rename">
        <span class="ptab-label-text">${p.name}</span>
        ${canClose ? '<span class="ptab-rename" data-action="rename" title="Rename portfolio">✏️</span><span class="ptab-x" data-action="close" title="Delete portfolio">×</span>' : ''}
      </button>`;
    })
    .join('');
  const add = `<button class="ptab-add" data-action="add">+ New</button>`;
  container.innerHTML = tabs + add;
}

function handleSwitch(id) {
  setActivePortfolio(id);
  renderPortfolioBar();
  const page = getCurrentPage();
  if (page === 1) {
    renderSetupPage();
  } else if (page === 2) {
    renderHoldingsPage();
  } else {
    renderSetupPage();
  }
}

export function initPortfolioBar() {
  const container = byId('ptabs');
  if (!container) return;

  container.addEventListener('click', e => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.dataset.action === 'add') {
      const state = getState();
      if (state.portfolios.length >= 5) {
        alert('You can have up to 5 portfolios.');
        return;
      }
      addPortfolio();
      renderPortfolioBar();
      const page = getCurrentPage();
      if (page === 1) renderSetupPage();
      else if (page === 2) renderHoldingsPage();
      return;
    }

    if (target.dataset.action === 'close') {
      const tab = target.closest('.ptab');
      if (!tab) return;
      const id = tab.getAttribute('data-id');
      if (!id) return;
      if (!confirm('Delete this portfolio?')) return;
      removePortfolio(id);
      renderPortfolioBar();
      const page = getCurrentPage();
      if (page === 1) renderSetupPage();
      else if (page === 2) renderHoldingsPage();
      return;
    }

    if (target.dataset.action === 'rename') {
      const tab = target.closest('.ptab');
      if (!tab) return;
      const id = tab.getAttribute('data-id');
      if (!id) return;
      const currentName = getState().portfolios.find(p => p.id === id)?.name || '';
      const next = window.prompt('Portfolio name:', currentName);
      if (next && next.trim()) {
        renamePortfolio(id, next.trim());
        renderPortfolioBar();
      }
      return;
    }

    const tab = target.closest('.ptab');
    if (tab && tab.getAttribute('data-id')) {
      const id = tab.getAttribute('data-id');
      if (!id) return;
      handleSwitch(id);
    }
  });

  container.addEventListener('dblclick', e => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const tab = target.closest('.ptab');
    if (!tab) return;
    const id = tab.getAttribute('data-id');
    if (!id) return;
    const portfolio = getActivePortfolio();
    const currentName = portfolio.id === id ? portfolio.name : (getState().portfolios.find(p => p.id === id)?.name || '');
    const next = window.prompt('Portfolio name:', currentName);
    if (next && next.trim()) {
      renamePortfolio(id, next.trim());
      renderPortfolioBar();
    }
  });
}

