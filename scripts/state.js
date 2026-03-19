const DEF = {
  riskPct: 1,
  etfs: [
    { id: 1, isin: 'IE00BZ02LR44', ticker: 'XZW0.DE', name: 'Xtrackers MSCI World ESG', rf: false, cr: false, cat: 'Akt. Ind.', tgt: 50 },
    { id: 2, isin: 'IE00BZ0PKT83', ticker: 'IFSW.MI', name: 'iShares World Multifactor', rf: false, cr: false, cat: 'Akt. Ind.', tgt: 0 },
    { id: 3, isin: 'IE00BF4RFH31', ticker: 'WSML.L', name: 'iShares MSCI World Small Cap', rf: false, cr: false, cat: 'Akt. Ind. SM', tgt: 14 },
    { id: 4, isin: 'LU0380865021', ticker: 'XESC.MU', name: 'Xtrackers Euro Stoxx 50', rf: false, cr: false, cat: 'Akt. Eur.', tgt: 0 },
    { id: 5, isin: 'IE00BFMNHK08', ticker: 'XZEU.DE', name: 'Xtrackers MSCI Europe ESG', rf: false, cr: false, cat: 'Akt. Eur.', tgt: 0 },
    { id: 6, isin: 'IE00BG370F43', ticker: 'XZEM.DE', name: 'Xtrackers MSCI EM ESG', rf: false, cr: false, cat: 'Akt. EM', tgt: 0 },
    { id: 7, isin: 'IE00BFNM3P36', ticker: 'AYEM.DE', name: 'iShares MSCI EM IMI ESG', rf: false, cr: false, cat: 'Akt. EM', tgt: 31 },
    { id: 8, isin: 'IE00BKM4GZ66', ticker: 'EMIM.AS', name: 'iShares Core MSCI EM IMI', rf: false, cr: false, cat: 'Akt. EM', tgt: 0 },
    { id: 10, isin: 'BitCoin', ticker: 'BTCEUR', name: 'Bitcoin', rf: false, cr: true, cat: 'Krypto', tgt: 3 },
    { id: 11, isin: 'Ethereum', ticker: 'ETHEUR', name: 'Ethereum', rf: false, cr: true, cat: 'Krypto', tgt: 2 },
    { id: 9, isin: 'LU1829219556', ticker: 'MA13.PA', name: 'Amundi Govt Bond 1-3Y', rf: true, cr: false, cat: 'StaatsAnl.', tgt: 0 },
    { id: 12, isin: 'Tagesgeld', ticker: '', name: 'Tagesgeld / Cash', rf: true, cr: false, cat: 'Bank', tgt: 100 }
  ]
};

const STORAGE_KEY = 'etf_reb_v5';
const MAX_PORTFOLIOS = 5;

function loadRawFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function createDefaultPortfolio(id = 'p1', name = 'Main') {
  return {
    id,
    name,
    etfs: DEF.etfs.map(e => ({ ...e })),
    rp: DEF.riskPct,
    nid: 20,
    mode: 'onetime',
    inv: 500,
    h: {},
    manualPrices: {}
  };
}

function migrateLegacy(raw) {
  // Legacy shape looks like a single portfolio: has etfs/rp/di etc., but no portfolios array
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (Array.isArray(raw.portfolios)) {
    // Ensure all portfolios have manualPrices field
    raw.portfolios.forEach(portfolio => {
      if (!portfolio.manualPrices) {
        portfolio.manualPrices = {};
      }
    });
    return raw;
  }
  if (Array.isArray(raw.etfs)) {
    const portfolio = {
      id: 'p1',
      name: 'Main',
      etfs: raw.etfs,
      rp: raw.rp ?? DEF.riskPct,
      nid: raw.nid ?? 20,
      mode: raw.mode ?? 'onetime',
      inv: raw.inv ?? 500,
      h: raw.h ?? {},
      manualPrices: raw.manualPrices ?? {}
    };
    return {
      portfolios: [portfolio],
      activePortfolioId: 'p1'
    };
  }
  return null;
}

function createInitialAppState() {
  const raw = loadRawFromStorage();
  if (!raw) {
    const p = createDefaultPortfolio('p1', 'Main');
    return { portfolios: [p], activePortfolioId: 'p1' };
  }
  if (Array.isArray(raw.portfolios) && raw.activePortfolioId) {
    return raw;
  }
  const migrated = migrateLegacy(raw);
  if (migrated) {
    return migrated;
  }
  const p = createDefaultPortfolio('p1', 'Main');
  return { portfolios: [p], activePortfolioId: 'p1' };
}

export function saveStateToStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

let appState = createInitialAppState();

export function getState() {
  return appState;
}

export function setState(updater) {
  const next = typeof updater === 'function' ? updater(appState) : updater;
  appState = next;
  saveStateToStorage(appState);
  return appState;
}

export function updateState(patch) {
  return setState(prev => ({ ...prev, ...patch }));
}

export function getActivePortfolio() {
  const { portfolios, activePortfolioId } = appState;
  let p = portfolios.find(pf => pf.id === activePortfolioId);
  if (!p) {
    p = portfolios[0] || createDefaultPortfolio('p1', 'Main');
  }
  // Ensure manualPrices is always available
  if (!p.manualPrices) {
    p.manualPrices = {};
  }
  return p;
}

export function updateActivePortfolio(updater) {
  return setState(prev => {
    const current = getActivePortfolio();
    const nextPortfolio =
      typeof updater === 'function' ? updater(current) : updater;
    // Ensure manualPrices is always available in the updated portfolio
    if (!nextPortfolio.manualPrices) {
      nextPortfolio.manualPrices = current.manualPrices || {};
    }
    const portfolios = prev.portfolios.map(p =>
      p.id === current.id ? nextPortfolio : p
    );
    return { ...prev, portfolios };
  });
}

export function addPortfolio(name) {
  return setState(prev => {
    if (prev.portfolios.length >= MAX_PORTFOLIOS) return prev;
    const idx = prev.portfolios.length + 1;
    const id = `p${idx}`;
    const portfolio = createDefaultPortfolio(id, name || `Portfolio ${idx}`);
    const portfolios = [...prev.portfolios, portfolio];
    return { ...prev, portfolios, activePortfolioId: id };
  });
}

export function removePortfolio(id) {
  return setState(prev => {
    if (prev.portfolios.length <= 1) return prev;
    const portfolios = prev.portfolios.filter(p => p.id !== id);
    let activePortfolioId = prev.activePortfolioId;
    if (!portfolios.find(p => p.id === activePortfolioId)) {
      activePortfolioId = portfolios[0]?.id || '';
    }
    return { ...prev, portfolios, activePortfolioId };
  });
}

export function renamePortfolio(id, name) {
  return setState(prev => {
    const portfolios = prev.portfolios.map(p =>
      p.id === id ? { ...p, name: name || p.name } : p
    );
    return { ...prev, portfolios };
  });
}

export function setActivePortfolio(id) {
  return setState(prev => {
    if (!prev.portfolios.find(p => p.id === id)) return prev;
    return { ...prev, activePortfolioId: id };
  });
}

