(function attachDielectric(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Dielectric = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createDielectric() {
  'use strict';
  const HARTREE_EV = 27.211386245988, BOHR_NM = 0.0529177210903;
  function number(value, label, min, max = Infinity) {
    if (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) throw new Error(`${label}の数値・範囲を確認してください。`);
    return Number(value);
  }
  function parseSpectrum(text, format = 'elf') {
    if (!['elf','epsilon'].includes(format)) throw new Error('損失関数またはε₁・ε₂の形式を指定してください。');
    if (typeof text !== 'string' || text.length > 1000000) throw new Error('誘電データは1 MB以下にしてください。');
    const rows = text.replace(/^\uFEFF/,'').split(/\r?\n/).map(line=>line.split('#')[0].trim()).filter(Boolean);
    if (rows.length && /^(energy|loss|omega|エネルギー)/i.test(rows[0])) rows.shift();
    if (rows.length < 2 || rows.length > 2000) throw new Error('誘電データはエネルギー昇順で2〜2000点を入力してください。');
    const points = rows.map((line,index)=>{
      const columns = line.split(/[,\s]+/);
      if (columns.length !== (format === 'elf' ? 2 : 3)) throw new Error(`誘電データ${index+1}行目の列数が違います。`);
      const energy = number(columns[0],'損失エネルギー / eV',0);
      let loss;
      if (format === 'elf') loss = number(columns[1],'Im(−1/ε)',0);
      else {
        const real = number(columns[1],'ε₁',-Infinity), imaginary = number(columns[2],'ε₂',0);
        const denominator = real*real+imaginary*imaginary;
        if (!Number.isFinite(denominator) || denominator === 0) throw new Error('ε₁² + ε₂²は有限の正の値にしてください。');
        loss = imaginary/denominator;
      }
      return {energy,loss};
    });
    if (points.some((point,i)=>i>0 && point.energy<=points[i-1].energy)) throw new Error('損失エネルギーは重複なく昇順にしてください。');
    if (!points.some(point=>point.loss>0)) throw new Error('損失関数に正の値がありません。');
    return {format,points};
  }
  // Gauss–Legendre integration; each pair represents ±x.
  const GAUSS8 = [[.1834346424956498,.3626837833783620],[.5255324099163290,.3137066458778873],[.7966664774136267,.2223810344533745],[.9602898564975363,.1012285362903763]];
  const GAUSS16 = [[.0950125098376374,.1894506104550685],[.2816035507792589,.1826034150449236],[.4580167776572274,.1691565193950025],[.6178762444026438,.1495959888165767],[.7554044083550030,.1246289712555339],[.8656312023878318,.0951585116824928],[.9445750230732326,.0622535239386479],[.9894009349916499,.0271524594117541]];
  function integrate(fn, lo, hi, rule) {
    if (hi <= lo) return 0;
    const mid = (lo+hi)/2, half = (hi-lo)/2;
    return half * rule.reduce((sum,[x,w])=>sum+w*(fn(mid-half*x)+fn(mid+half*x)),0);
  }
  // SPA dispersion in atomic units, from Shinotsuka et al. (2017), Eq. 8.
  // Integrating the plasmon delta function over loss energy first avoids a
  // sampled delta peak. The remaining integral is ∫dq/q · wp/wq.
  function spaKernel(plasmon, kinetic, gap, maxLoss) {
    if (plasmon <= 0 || plasmon >= maxLoss) return 0;
    const k = Math.sqrt(2*kinetic), kF = (3*Math.PI/4)**(1/3)*plasmon**(2/3), b = kF*kF/3;
    const dispersion = q=>Math.sqrt(plasmon*plasmon+b*q*q+q**4/4);
    const allowed = q=>k*q-q*q/2-dispersion(q);
    const slope = q=>k-q-(b*q+q**3/2)/dispersion(q);
    let left = 0, right = k;
    for (let i=0;i<48;i++) { const mid=(left+right)/2; if(slope(mid)>0)left=mid;else right=mid; }
    const peak=(left+right)/2;
    if(allowed(peak)<=0)return 0;
    left=0;right=peak;
    for(let i=0;i<48;i++){const mid=(left+right)/2;if(allowed(mid)>0)right=mid;else left=mid;}
    let qMin=(left+right)/2;
    left=peak;right=k;
    for(let i=0;i<48;i++){const mid=(left+right)/2;if(allowed(mid)>0)left=mid;else right=mid;}
    let qMax=(left+right)/2;
    const qAtLoss=loss=>{const delta=loss*loss-plasmon*plasmon;return delta<=0?0:Math.sqrt(2*delta/(Math.sqrt(b*b+delta)+b));};
    qMin=Math.max(qMin,qAtLoss(gap)); qMax=Math.min(qMax,qAtLoss(maxLoss));
    if(qMax<=qMin || qMin<=0)return 0;
    return integrate(logQ=>plasmon/dispersion(Math.exp(logQ)),Math.log(qMin),Math.log(qMax),GAUSS16);
  }
  function calculate(energy, {spectrum,gap=0,bandWidth=0,energyOffset=0,rangePolicy='strict'}) {
    const e = number(energy,'運動エネルギー',0)+number(energyOffset,'真空→伝導帯基準の補正 / eV',-100,100);
    if(e<200 || e>10000)throw new Error('Penn SPAは200〜10000 eVの近似です。範囲外はIMFPを手入力してください。');
    const eg=number(gap,'バンドギャップ',0), ev=number(bandWidth,'価電子帯幅 / Fermiエネルギー',0);
    if(eg>=e)throw new Error('利用可能なエネルギー損失範囲がありません。');
    if(!spectrum?.points || spectrum.points.length<2)throw new Error('損失関数データを入力してください。');
    if(!['strict','zero'].includes(rangePolicy))throw new Error('データ範囲の扱いを選択してください。');
    const points=spectrum.points, warnings=['Penn SPA（Full Penn法とは異なる近似）'];
    const incomplete=points[0].energy>0 || points[points.length-1].energy<e;
    if(incomplete && rangePolicy==='strict')throw new Error(`損失関数は0〜${e.toFixed(1)} eVを覆う必要があります。範囲外を0とする場合は打切り近似を選択してください。`);
    if(incomplete)warnings.push('ELF範囲外を0とした打切り近似');
    if(e>2000)warnings.push('非相対論近似 > 2 keV');
    const kinetic=(e+ev)/HARTREE_EV, maxLoss=e/HARTREE_EV, minLoss=eg/HARTREE_EV;
    let integral=0;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],lo=a.energy/HARTREE_EV,hi=Math.min(b.energy/HARTREE_EV,maxLoss);
      if(lo>=maxLoss)break;
      const integrand=wp=>{
        const fraction=(wp*HARTREE_EV-a.energy)/(b.energy-a.energy);
        return (a.loss+(b.loss-a.loss)*fraction)*spaKernel(wp,kinetic,minLoss,maxLoss);
      };
      // Subdivide broad optical-data intervals geometrically. Otherwise a single
      // quadrature rule could miss the low-loss kernel in a coarse 0–10 keV bin.
      for(let start=lo;start<hi;){
        const end=Math.min(hi,start+Math.max(1/HARTREE_EV,start*.12));
        integral+=integrate(integrand,start,end,GAUSS8);
        start=end;
      }
    }
    const inverse=integral/(Math.PI*kinetic);
    if(!Number.isFinite(inverse) || inverse<=0)throw new Error('入力ELFから有限のIMFPが得られません。エネルギー範囲と損失ピークを確認してください。');
    return {lambda:BOHR_NM/inverse,method:'Penn SPA',warnings,energy:e,rangeIncomplete:incomplete};
  }
  return {parseSpectrum,calculate,spaKernel,HARTREE_EV,BOHR_NM};
}));
