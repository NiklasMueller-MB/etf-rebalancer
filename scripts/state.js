const DEF = {
  riskPct: 1,
  defInv: 500,
  etfs: [
    { id: 1, isin: 'IE00BZ02LR44', ticker: 'XZW0.DE', name: 'Xtrackers MSCI World ESG', rf: false, cr: false, cat: 'Akt. Ind.', tgt: 52 },
    { id: 2, isin: 'IE00BZ0PKT83', ticker: 'IFSW.MI', name: 'iShares World Multifactor', rf: false, cr: false, cat: 'Akt. Ind.', tgt: 0 },
    { id: 3, isin: 'IE00BF4RFH31', ticker: 'WSML.L', name: 'iShares MSCI World Small Cap', rf: false, cr: false, cat: 'Akt. Ind. SM', tgt: 15 },
    { id: 4, isin: 'LU0380865021', ticker: 'XESC.MU', name: 'Xtrackers Euro Stoxx 50', rf: false, cr: false, cat: 'Akt. Eur.', tgt: 0 },
    { id: 5, isin: 'IE00BFMNHK08', ticker: 'XZEU.DE', name: 'Xtrackers MSCI Europe ESG', rf: false, cr: false, cat: 'Akt. Eur.', tgt: 0 },
    { id: 6, isin: 'IE00BG370F43', ticker: 'XZEM.DE', name: 'Xtrackers MSCI EM ESG', rf: false, cr: false, cat: 'Akt. EM', tgt: 0 },
    { id: 7, isin: 'IE00BFNM3P36', ticker: 'AYEM.DE', name: 'iShares MSCI EM IMI ESG', rf: false, cr: false, cat: 'Akt. EM', tgt: 33 },
    { id: 8, isin: 'IE00BKM4GZ66', ticker: 'EMIM.AS', name: 'iShares Core MSCI EM IMI', rf: false, cr: false, cat: 'Akt. EM', tgt: 0 },
    { id: 10, isin: 'BitCoin', ticker: 'BTCEUR', name: 'Bitcoin', rf: false, cr: true, cat: 'Krypto', tgt: 3 },
    { id: 11, isin: 'Ethereum', ticker: 'ETHEUR', name: 'Ethereum', rf: false, cr: true, cat: 'Krypto', tgt: 2 },
    { id: 9, isin: 'LU1829219556', ticker: 'MA13.PA', name: 'Amundi Govt Bond 1-3Y', rf: true, cr: false, cat: 'StaatsAnl.', tgt: 0 },
    { id: 12, isin: 'Tagesgeld', ticker: '', name: 'Tagesgeld / Cash', rf: true, cr: false, cat: 'Bank', tgt: 100 }
  ]
};

const STORAGE_KEY = 'etf_reb_v5';

function loadStateFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStateToStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function createDefaultState() {
  return {
    etfs: DEF.etfs.map(e => ({ ...e })),
    rp: DEF.riskPct,
    di: DEF.defInv,
    nid: 20,
    mode: 'onetime',
    inv: DEF.defInv,
    h: {}
  };
}

let state = loadStateFromStorage() || createDefaultState();

export function getState() {
  return state;
}

export function setState(updater) {
  const next = typeof updater === 'function' ? updater(state) : updater;
  state = next;
  saveStateToStorage(state);
  return state;
}

export function updateState(patch) {
  return setState(prev => ({ ...prev, ...patch }));
}

