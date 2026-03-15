export function optim(ist, sol, inv, lb, ub) {
  const n = ist.length;
  let r = new Array(n).fill(inv / n);
  for (let i = 0; i < n; i++) r[i] = Math.max(lb[i], Math.min(ub[i], r[i]));
  for (let it = 0; it < 10000; it++) {
    for (let i = 0; i < n; i++) {
      const so = r.reduce((s, v, j) => (j === i ? s : s + v), 0);
      r[i] = Math.max(lb[i], Math.min(ub[i], inv - so));
    }
    const s = r.reduce((a, v) => a + v, 0);
    const d = inv - s;
    if (Math.abs(d) > 0.01) {
      const eg = r.map((v, i) => (d > 0 ? v < ub[i] : v > lb[i]));
      const ct = eg.filter(Boolean).length || 1;
      for (let i = 0; i < n; i++) if (eg[i]) r[i] = Math.max(lb[i], Math.min(ub[i], r[i] + d / ct));
    }
  }
  return r;
}

export function optimizeAllocation(state, priceData) {
  const etfs = state.etfs;
  const inv = state.inv;
  const rp = state.rp;
  const mode = state.mode;
  const { pricesById: pr, hiById: hi, loById: lo, currenciesById: cu } = priceData;

  const ist = etfs.map(e => (state.h[e.id] || 0) * pr[e.id]);
  const tot = ist.reduce((a, v) => a + v, 0);
  const ft = mode === 'onetime' ? tot + inv : tot + 3 * inv;
  const hasCrypto = etfs.some(e => e.cr && (state.h[e.id] || 0) > 0);
  const cs = hasCrypto ? 1 / 1.05 : 1;
  const sol = etfs.map(e =>
    e.rf ? (e.tgt / 100) * (1 - rp) * ft : (e.tgt / 100) * rp * cs * ft
  );
  const r = optim(ist, sol, inv, etfs.map(() => 0), etfs.map(() => inv));

  return {
    etfs,
    inv,
    rp,
    mode,
    ist,
    tot,
    ft,
    hasCrypto,
    cs,
    sol,
    r,
    pr,
    hi,
    lo,
    cu
  };
}

