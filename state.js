/**
 * state.js
 * Central state store with localStorage persistence.
 */

const STORAGE_KEY = 'etf_reb_v5';

const DEFAULT_STATE = {
  rp: 1,          // risky fraction (0–1)
  di: 500,         // default investment amount
  nid: 20,         // next auto-increment id
  mode: 'onetime', // 'onetime' | 'savings'
  inv: 500,        // investment amount for current session
  h: {},           // { [etfId]: sharesHeld }
  etfs: [
    { id:1,  isin:'IE00BZ02LR44', ticker:'XZW0.DE',  name:'Xtrackers MSCI World ESG',     rf:false, cr:false, cat:'Akt. Ind.',    tgt:52 },
    { id:2,  isin:'IE00BZ0PKT83', ticker:'IFSW.MI',   name:'iShares World Multifactor',    rf:false, cr:false, cat:'Akt. Ind.',    tgt:0  },
    { id:3,  isin:'IE00BF4RFH31', ticker:'WSML.L',    name:'iShares MSCI World Small Cap', rf:false, cr:false, cat:'Akt. Ind. SM', tgt:15 },
    { id:4,  isin:'LU0380865021', ticker:'XESC.MU',   name:'Xtrackers Euro Stoxx 50',      rf:false, cr:false, cat:'Akt. Eur.',    tgt:0  },
    { id:5,  isin:'IE00BFMNHK08', ticker:'XZEU.DE',   name:'Xtrackers MSCI Europe ESG',    rf:false, cr:false, cat:'Akt. Eur.',    tgt:0  },
    { id:6,  isin:'IE00BG370F43', ticker:'XZEM.DE',   name:'Xtrackers MSCI EM ESG',        rf:false, cr:false, cat:'Akt. EM',      tgt:0  },
    { id:7,  isin:'IE00BFNM3P36', ticker:'AYEM.DE',   name:'iShares MSCI EM IMI ESG',      rf:false, cr:false, cat:'Akt. EM',      tgt:33 },
    { id:8,  isin:'IE00BKM4GZ66', ticker:'EMIM.AS',   name:'iShares Core MSCI EM IMI',     rf:false, cr:false, cat:'Akt. EM',      tgt:0  },
    { id:10, isin:'BitCoin',      ticker:'BTCEUR',     name:'Bitcoin',                      rf:false, cr:true,  cat:'Krypto',       tgt:3  },
    { id:11, isin:'Ethereum',     ticker:'ETHEUR',     name:'Ethereum',                     rf:false, cr:true,  cat:'Krypto',       tgt:2  },
    { id:9,  isin:'LU1829219556', ticker:'MA13.PA',   name:'Amundi Govt Bond 1-3Y',        rf:true,  cr:false, cat:'StaatsAnl.',   tgt:0  },
    { id:12, isin:'Tagesgeld',    ticker:'',           name:'Tagesgeld / Cash',             rf:true,  cr:false, cat:'Bank',         tgt:100},
  ],
};

/** Load state from localStorage, falling back to a fresh copy of defaults. */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore parse errors */ }
  return null;
}

/** Persist current state to localStorage. */
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(State));
  } catch (_) { /* storage full or unavailable */ }
}

/**
 * The single mutable state object.
 * Initialised from localStorage or defaults.
 */
const State = loadState() || {
  ...DEFAULT_STATE,
  etfs: DEFAULT_STATE.etfs.map(e => ({ ...e })),
};

/** Return the ETF entry with the given id, or undefined. */
function getEtf(id) {
  return State.etfs.find(e => e.id === id);
}

/** Update a field on an ETF entry and persist. */
function updateEtf(id, field, value) {
  const etf = getEtf(id);
  if (etf) {
    etf[field] = value;
    saveState();
  }
}

/** Add a new ETF (risky or risk-free) and persist. */
function addEtf(isRiskFree) {
  State.etfs.push({
    id: State.nid++,
    isin: '',
    ticker: '',
    name: 'New asset',
    rf: isRiskFree,
    cr: false,
    cat: '',
    tgt: 0,
  });
  saveState();
}

/** Remove an ETF by id, also clearing its holdings entry. */
function removeEtf(id) {
  State.etfs = State.etfs.filter(e => e.id !== id);
  delete State.h[id];
  saveState();
}
