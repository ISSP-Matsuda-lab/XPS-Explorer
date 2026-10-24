const assert=require('node:assert/strict'),model=require('../assets/js/film-thickness.js');
const base={ratio:1,numberDensity:50,filmLength:2,substrateLength:2,sigma:.1,baseline:.001,transmission:1,angle:0};
const close=(a,b)=>assert(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),a+' != '+b);
for(const angle of [0,45,70]){
  const input={...base,angle},mu=Math.cos(angle*Math.PI/180),scale=.1*1e-4*50*2*mu/.001;
  close(model.estimate(input).thickness,2*mu*Math.log1p(1/scale));
}
for(const thickness of [0,1e-7,.05,1,5,100]){
  const input={...base,filmLength:1.5,substrateLength:3.4,angle:42,transmission:1.7};
  const ratio=model.predictRatio(thickness,input),result=model.estimate({...input,ratio});
  close(result.thickness,thickness);close(result.arealDensity,50*thickness);
  close(result.substrateSurvival,Math.exp(-thickness/(3.4*Math.cos(42*Math.PI/180))));
}
for(const changes of [{ratio:-1},{ratio:''},{numberDensity:0},{filmLength:0},{substrateLength:0},{sigma:0},{baseline:0},{transmission:0},{angle:90}]){
  assert.throws(()=>model.estimate({...base,...changes}));
}
// A 2D substrate has finite uncoated areal yield, without a bulk density assumption.
const sheet={...base,baseline:.1*1e-4*2};
const ratio=model.predictRatio(.4,sheet);close(model.estimate({...sheet,ratio}).thickness,.4);
assert(model.estimate({...base,ratio:2}).thickness>model.estimate(base).thickness);
for(const ratio of [1e-100,1e-15,1e100]){
  const result=model.estimate({...base,ratio});
  assert(Math.abs(Math.log(result.ratio/ratio))<1e-10);
}
console.log('Film thickness checks passed: closed form, unequal attenuation lengths, zero/thick limits, angle, 2D baseline, and invalid inputs.');
