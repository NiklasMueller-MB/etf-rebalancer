// ── Optimiser ────────────────────────────────────────────────────────────
function optim(ist,sol,inv,lb,ub){
  const n=ist.length; let r=new Array(n).fill(inv/n);
  for(let i=0;i<n;i++) r[i]=Math.max(lb[i],Math.min(ub[i],r[i]));
  for(let it=0;it<10000;it++){
    for(let i=0;i<n;i++){
      const so=r.reduce((s,v,j)=>j===i?s:s+v,0);
      r[i]=Math.max(lb[i],Math.min(ub[i],inv-so));
    }
    const s=r.reduce((a,v)=>a+v,0), d=inv-s;
    if(Math.abs(d)>0.01){
      const eg=r.map((v,i)=>d>0?v<ub[i]:v>lb[i]), ct=eg.filter(Boolean).length||1;
      for(let i=0;i<n;i++) if(eg[i]) r[i]=Math.max(lb[i],Math.min(ub[i],r[i]+d/ct));
    }
  }
  return r;
}