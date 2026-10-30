(function attachFilmThickness(root, factory) {
  const api = factory(typeof module !== 'undefined' && module.exports ? require('./escape-depth.js') : root.EscapeDepth);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FilmThickness = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createFilmThickness(escapeDepth) {
  'use strict';
  function number(value, label, min = 0, max = Infinity) {
    if (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) throw new Error(label + ': enter a value in the allowed range.');
    return Number(value);
  }
  function measuredRatio(filmArea, substrateArea) {
    const film=number(filmArea,'Measured film peak area');
    const substrate=number(substrateArea,'Measured substrate peak area');
    if(substrate===0)throw new Error('The measured substrate peak area must be greater than zero.');
    const ratio=film/substrate;
    if(!Number.isFinite(ratio) || (film>0 && ratio===0))throw new Error('The measured area ratio is outside the numerical range. Rescale both areas using the same units.');
    return ratio;
  }
  function attenuation(input) {
    const mode=input.mode??'none';
    if(!['none','tpp','manual'].includes(mode))throw new Error('Select a film attenuation model.');
    if(mode==='none')return {mode,filmLength:null,substrateLength:null,material:null,cosine:1,extrapolated:false};
    const cosine=Math.cos(number(input.angle,'Emission angle / degrees',0,89.9)*Math.PI/180);
    if(mode==='manual')return {mode,cosine,filmLength:number(input.filmLength,'Film-electron attenuation length in film / nm',1e-9),substrateLength:number(input.substrateLength,'Substrate-electron attenuation length in film / nm',1e-9),material:null,extrapolated:false};
    const densityAtoms=number(input.numberDensity,'Film emitter density / nm⁻³',1e-12);
    const molarMass=number(input.molarMass,'Film molar mass / g mol⁻¹',1e-9);
    const emitterAtoms=number(input.emitterAtoms,'Selected atoms per formula unit',1e-9);
    const material={molarMass,density:densityAtoms*molarMass/(602.214076*emitterAtoms),valence:number(input.valence,'Film valence electrons per formula unit',1e-9),gap:number(input.gap,'Film band gap / eV')};
    const energies=[input.filmEnergy,input.substrateEnergy].map(value=>number(value,'Film TPP-2M electron energy / eV',50,10000));
    return {mode,cosine,material,filmLength:escapeDepth.imfp(energies[0],material),substrateLength:escapeDepth.imfp(energies[1],material),extrapolated:energies.some(value=>value>2000)};
  }
  function estimate(input) {
    const ratio=number(input.ratio,'Measured film/substrate area ratio');
    const density=number(input.numberDensity,'Film emitter density / nm⁻³',1e-12);
    const sigma=number(input.sigma,'Film cross section / Mb',1e-15)*1e-4;
    const baseline=number(input.baseline,'Uncoated substrate yield',1e-30);
    const surfaceArea=number(input.surfaceArea,'Substrate surface-cell area / nm²',1e-15);
    const transport=attenuation(input);
    let thickness=ratio*baseline/(sigma*density),substrateSurvival=1,filmAverageSurvival=1;
    if(transport.mode!=='none'){
      const a=transport.filmLength*transport.cosine,b=transport.substrateLength*transport.cosine;
      if(ratio>0){
        const logScale=Math.log(sigma)+Math.log(density)+Math.log(a)-Math.log(baseline),target=Math.log(ratio);
        const x=target-logScale,softplus=x>0?x+Math.log1p(Math.exp(-x)):Math.log1p(Math.exp(x));
        const logRatio=t=>logScale+Math.log(-Math.expm1(-t/a))+t/b;
        let lo=0,hi=Math.max(a,b)*softplus;
        for(let i=0;i<100 && logRatio(hi)<target;i++)hi*=2;
        if(!Number.isFinite(hi) || hi<=0 || logRatio(hi)<target)throw new Error('The film estimate is outside the numerical range. Check the input parameters.');
        for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(logRatio(mid)<target)lo=mid;else hi=mid;}
        thickness=(lo+hi)/2;
      }else thickness=0;
      substrateSurvival=Math.exp(-thickness/b);
      filmAverageSurvival=thickness===0?1:-Math.expm1(-thickness/a)/(thickness/a);
    }
    // The supplied substrate yield retains its own internal depth attenuation.
    const arealDensity=density*thickness,atomsPerCell=arealDensity*surfaceArea;
    if(![arealDensity,thickness,atomsPerCell].every(value=>Number.isFinite(value) && (ratio===0 || value>0)))throw new Error('The film estimate is outside the numerical range. Check the input parameters.');
    return {thickness,arealDensity,atomsPerCell,ratio,transport,substrateSurvival,filmAverageSurvival};
  }
  return {estimate,measuredRatio,attenuation};
}));
