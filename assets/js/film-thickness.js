(function attachFilmThickness(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FilmThickness = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createFilmThickness() {
  'use strict';
  function number(value, label, min = 0, max = Infinity) {
    if (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) throw new Error(label + ': enter a value in the allowed range.');
    return Number(value);
  }
  function parameters(input) {
    const ratio = number(input.ratio, 'Measured film/substrate area ratio');
    const density = number(input.numberDensity, 'Film emitter density / nm⁻³', 1e-12);
    const filmLength = number(input.filmLength, 'Film-electron attenuation length in film / nm', 1e-9);
    const substrateLength = number(input.substrateLength, 'Substrate-electron attenuation length in film / nm', 1e-9);
    const sigma = number(input.sigma, 'Film cross section / Mb', 1e-15);
    const baseline = number(input.baseline, 'Uncoated substrate yield', 1e-30);
    const transmission = number(input.transmission, 'Film/substrate transmission ratio', 1e-12);
    const angle = number(input.angle, 'Emission angle / degrees', 0, 89.9);
    const cosine = Math.cos(angle*Math.PI/180), a = filmLength*cosine, b = substrateLength*cosine;
    const scale = sigma*1e-4*density*a*transmission/baseline;
    if (!Number.isFinite(scale) || scale<=0) throw new Error('Film sensitivity is not finite. Check the input parameters.');
    return {ratio,density,a,b,scale};
  }
  function logRatio(thickness, p) {
    return Math.log(p.scale) + Math.log(-Math.expm1(-thickness/p.a)) + thickness/p.b;
  }
  function predictRatio(thickness, input) {
    const p = parameters({...input,ratio:0}), t=number(thickness,'Film thickness / nm');
    return t===0 ? 0 : Math.exp(logRatio(t,p));
  }
  function estimate(input) {
    const p = parameters(input);
    let thickness = 0;
    if(p.ratio>0){
      const target=Math.log(p.ratio);
      const logScaledRatio=target-Math.log(p.scale);
      const softplus=logScaledRatio>0 ? logScaledRatio+Math.log1p(Math.exp(-logScaledRatio)) : Math.log1p(Math.exp(logScaledRatio));
      let lo=0, hi=Math.max(p.a,p.b)*softplus;
      // Solve in log space: substrate attenuation can underflow long before
      // a measured intensity ratio becomes numerically unrepresentable.
      for(let i=0;logRatio(hi,p)<target && i<100;i++)hi*=2;
      if(!Number.isFinite(hi) || logRatio(hi,p)<target)throw new Error('No finite film thickness was found for this ratio.');
      for(let i=0;i<80;i++){const mid=(lo+hi)/2;if(logRatio(mid,p)<target)lo=mid;else hi=mid;}
      thickness=(lo+hi)/2;
    }
    return {thickness,arealDensity:p.density*thickness,substrateSurvival:Math.exp(-thickness/p.b),ratio:thickness===0?0:Math.exp(logRatio(thickness,p)),scale:p.scale};
  }
  return {estimate,predictRatio};
}));
