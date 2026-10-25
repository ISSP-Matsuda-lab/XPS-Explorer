const assert=require('node:assert/strict'),model=require('../assets/js/film-thickness.js');
const base={ratio:1,numberDensity:50,sigma:.1,baseline:.001,surfaceArea:.3};
const close=(a,b)=>assert(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),a+' != '+b);
const result=model.estimate(base);
// 0.1 Mb = 1e-5 nm²: Y=0.001 corresponds to 100 atoms/nm².
close(result.arealDensity,100);close(result.thickness,2);close(result.atomsPerCell,30);
for(const ratio of [0,1e-7,.05,1,5,100]){
  const current=model.estimate({...base,ratio});
  close(current.thickness,2*ratio);close(current.arealDensity,100*ratio);close(current.atomsPerCell,30*ratio);
}
// Density changes equivalent thickness, but never inferred areal coverage.
const dense=model.estimate({...base,numberDensity:100});
close(dense.thickness,1);close(dense.atomsPerCell,result.atomsPerCell);
close(model.estimate({...base,surfaceArea:.6}).atomsPerCell,60);
// Old attenuation, sensitivity, and angle fields cannot affect the new model.
assert.deepEqual(model.estimate({...base,filmLength:0,substrateLength:0,transmission:17,angle:85}),result);
for(const changes of [{ratio:-1},{ratio:''},{numberDensity:0},{numberDensity:''},{sigma:0},{baseline:0},{surfaceArea:0},{surfaceArea:NaN}]){
  assert.throws(()=>model.estimate({...base,...changes}));
}
// A 2D substrate has finite uncoated areal yield, without a bulk density assumption.
const sheet={...base,baseline:.1*1e-4*2,surfaceArea:.5};
close(model.estimate(sheet).atomsPerCell,1);close(model.estimate(sheet).thickness,.04);
assert(model.estimate({...base,ratio:2}).thickness>model.estimate(base).thickness);
close(model.measuredRatio(2500,5000),.5);
close(model.measuredRatio(250000,500000),.5);
close(model.measuredRatio(0,5000),0);
for(const [film,substrate] of [[-1,2],[2,0],[2,-1],['',2],[2,''],[Infinity,2],[2,NaN],[1e308,1e-308],[1e-308,1e308]]){
  assert.throws(()=>model.measuredRatio(film,substrate));
}
for(const ratio of [1e-100,1e-15,1e100]){
  const result=model.estimate({...base,ratio});
  assert(Math.abs(Math.log(result.ratio/ratio))<1e-10);
}
// Equal lengths have an independent closed form; unequal lengths round trip.
for(const angle of [0,45,80]){
  const a=2*Math.cos(angle*Math.PI/180),scale=base.sigma*1e-4*base.numberDensity*a/base.baseline;
  close(model.estimate({...base,mode:'manual',angle,filmLength:2,substrateLength:2}).thickness,a*Math.log1p(1/scale));
}
for(const t of [0,1e-8,.1,1,10,100]){
  const angle=35,mu=Math.cos(angle*Math.PI/180),a=1.5*mu,b=3.4*mu;
  const ratio=base.sigma*1e-4*base.numberDensity*a*(-Math.expm1(-t/a))*Math.exp(t/b)/base.baseline;
  const result=model.estimate({...base,ratio,mode:'manual',angle,filmLength:1.5,substrateLength:3.4});
  close(result.thickness,t);close(result.atomsPerCell,base.numberDensity*t*base.surfaceArea);
  close(result.substrateSurvival,Math.exp(-t/b));
}
close(model.estimate({...base,mode:'manual',angle:60,filmLength:1e12,substrateLength:1e12}).thickness,result.thickness);
const silicon={...base,mode:'tpp',numberDensity:602.214076*2.329/28.085,molarMass:28.085,valence:4,emitterAtoms:1,gap:1.12,filmEnergy:1000,substrateEnergy:1500,angle:30};
const siResult=model.estimate(silicon),transport=siResult.transport;
close(transport.material.density,2.329);
assert(transport.filmLength>2.3 && transport.filmLength<2.5);
assert(transport.substrateLength>transport.filmLength);
close(siResult.thickness,model.estimate({...silicon,mode:'manual',filmLength:transport.filmLength,substrateLength:transport.substrateLength}).thickness);
assert.equal(model.estimate({...silicon,filmEnergy:3000}).transport.extrapolated,true);
close(model.attenuation({...silicon,emitterAtoms:2}).material.density,2.329/2);
for(const changes of [{filmEnergy:49},{substrateEnergy:10001},{emitterAtoms:0},{molarMass:''},{valence:0},{gap:-1},{angle:90},{mode:'invalid'}])assert.throws(()=>model.estimate({...silicon,...changes}));
for(const ratio of [1e-100,1e100]){
  const output=model.estimate({...base,mode:'manual',angle:0,filmLength:2,substrateLength:2,ratio});
  close(output.thickness,2*Math.log1p(ratio/(base.sigma*1e-4*base.numberDensity*2/base.baseline)));
}
console.log('Film thickness checks passed: three models, TPP density conversion and ranges, closed-form/unequal-length inverses, no-attenuation limit, angles, surface-cell counts, and validation.');
