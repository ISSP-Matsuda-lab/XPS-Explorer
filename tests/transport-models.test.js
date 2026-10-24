const assert = require('node:assert/strict');
const dielectric = require('../assets/js/dielectric.js');
const eal = require('../assets/js/effective-depth.js');
const escape = require('../assets/js/escape-depth.js');
let passed = 0;
const test = (name, run) => { run(); console.log('OK ' + name); passed++; };
const close = (actual, expected, relative = 1e-8) => assert(Math.abs(actual - expected) <= relative * Math.max(Math.abs(expected), 1e-12), actual + ' != ' + expected);
const spectrum = dielectric.parseSpectrum('energy_eV,loss\n0,0\n10,0.1\n20,1\n30,.1\n50,0\n2000,0');
test('ELF and complex dielectric input give the same loss function', () => {
  const a = dielectric.parseSpectrum('0 0\n10 .5\n20 .25');
  const b = dielectric.parseSpectrum('0 1 0\n10 1 1\n20 0 4', 'epsilon');
  assert.deepEqual(a.points, b.points);
  ['0 0\n0 1', '0 0\n10 -1', '0 0', '0 0\n10 0', '0 0\nNaN 1', '0 1 2\n10 1 2'].forEach(text => assert.throws(() => dielectric.parseSpectrum(text)));
  assert.throws(() => dielectric.parseSpectrum('0 0 0\n10 1 1', 'epsilon'));
});
test('SPA momentum kernel agrees with an independent dense kinematic quadrature', () => {
  // Direct integration over log(q), applying energy-conservation and Pauli bounds
  // point by point rather than using the model's analytic interval/root selection.
  const reference = (wp, t, gap, maximum) => {
    const k = Math.sqrt(2*t), kF = Math.pow(3*Math.PI/4, 1/3)*Math.pow(wp, 2/3);
    const lo = Math.log(wp/(4*k)), hi = Math.log(2*k), steps = 200000, step = (hi-lo)/steps;
    let integral = 0;
    for (let i=0; i<steps; i++) {
      const q = Math.exp(lo+(i+.5)*step);
      const loss = Math.sqrt(wp*wp+kF*kF*q*q/3+q**4/4);
      if (loss >= gap && loss <= maximum && loss <= k*q-q*q/2) integral += wp/loss*step;
    }
    return integral;
  };
  [[.5, 40, 0, 36], [.5, 8, .8, 6], [3, 10, 0, 8]].forEach(args => close(dielectric.spaKernel(...args), reference(...args), 5e-5));
});
test('SPA absolute prefactor and energy conversion match independent outer integration', () => {
  // Integrate optical energy in eV, applying the explicit 1/Hartree Jacobian.
  const E = 1000, H = dielectric.HARTREE_EV, step = .01;
  let integral = 0;
  for (let energy = step/2; energy < 50; energy += step) {
    const points = spectrum.points;
    const i = points.findIndex(point => point.energy > energy), a = points[i-1], b = points[i];
    const loss = a.loss+(b.loss-a.loss)*(energy-a.energy)/(b.energy-a.energy);
    integral += loss*dielectric.spaKernel(energy/H, E/H, 0, E/H)*step/H;
  }
  const expected = dielectric.BOHR_NM * Math.PI * (E/H) / integral;
  close(dielectric.calculate(E, { spectrum }).lambda, expected, 2e-6);
});
test('doubling optical ELF halves IMFP; optical sampling refinement converges', () => {
  const original = dielectric.calculate(1000, { spectrum }).lambda;
  const doubled = { points: spectrum.points.map(p => ({ energy:p.energy, loss:2*p.loss })) };
  close(dielectric.calculate(1000, { spectrum:doubled }).lambda, original/2);
  const refined = { points: spectrum.points.flatMap((p, i, a) => i===a.length-1 ? [p] : [p, {energy:(p.energy+a[i+1].energy)/2, loss:(p.loss+a[i+1].loss)/2}]) };
  close(dielectric.calculate(1000, { spectrum:refined }).lambda, original, 1e-7);
  assert(original > 0 && original < 100);
  assert(dielectric.calculate(2000, { spectrum }).lambda > original);
});
test('dielectric ranges are explicit; no extrapolation or hidden TPP substitution', () => {
  [199,10001].forEach(E => assert.throws(() => dielectric.calculate(E,{spectrum})));
  const truncated = dielectric.parseSpectrum('5 0\n20 1\n40 0');
  assert.throws(() => dielectric.calculate(1000,{spectrum:truncated}));
  const result = dielectric.calculate(1000,{spectrum:truncated,rangePolicy:'zero'});
  assert(result.rangeIncomplete && result.warnings.some(w => w.includes('打切り')));
  const settings = {
    imfpModel:'dielectric', structure:{lattice:[[10,0,0],[0,10,0],[0,0,10]],atoms:[{symbol:'Si',frac:[0,0,0],occupancy:1}]},
    material:{density:0,molarMass:0,valence:0,gap:0}, photonEnergy:1104.5,workFunction:4.5,angle:0,miller:[0,0,1],phase:0,thickness:3,
    peaks:[{id:'Si-2p',symbol:'Si',label:'2p',bindingEnergy:100,sigma:1,lambda:''}],instrument:{enabled:false}
  };
  const successful = escape.predict(settings, null, E => dielectric.calculate(E,{spectrum}));
  close(successful.rows[0].lambda,dielectric.calculate(1000,{spectrum}).lambda);
  assert(successful.rows[0].area > 0);
  const failed = escape.predict(settings, null, () => {throw new Error('Missing ELF');});
  assert.equal(failed.rows[0].lambda,null); assert.equal(failed.rows[0].area,null);
  assert(failed.rows[0].status.some(s => s.includes('Missing ELF')));
  const sheet = escape.predict({...settings,thickness:0},null,()=>{throw new Error('Missing ELF');});
  close(sheet.rows[0].area,1e-4);
});
const base = {method:'transport',energy:1000,imfp:2,transportMfp:5,manualEal:1.5,angle:45,halfAngle:0,depth:1};
test('NIST transport approximation and no-elastic-scattering limit', () => {
  const result = eal.calculate(base);
  close(result.albedo,2/7); close(result.eal,1.58);
  close(eal.transportEal(2,1e15).eal,2,1e-12);
  assert(result.eal < 2);
});
test('normal and oblique information depths match closed-form exponential integrals', () => {
  [0,30,50].forEach(angle => {
    const result = eal.calculate({...base,angle}), length = result.eal*Math.cos(angle*Math.PI/180);
    close(result.corrected.mean,length);
    [50,90,95,99].forEach(p => close(result.corrected['d'+p],-Math.log1p(-p/100)*length));
    close(result.fraction,1-Math.exp(-1/length));
    close(result.corrected.cumulative(result.corrected.d95),.95);
  });
});
test('finite acceptance integrates uniform solid angle and weights depth contributions', () => {
  const result = eal.calculate({...base,angle:0,halfAngle:20});
  const c = Math.cos(20*Math.PI/180);
  // For a cone around the normal: <mu^2>/<mu> = 2(1+c+c^2)/(3(1+c)).
  close(result.corrected.mean, result.eal*2*(1+c+c*c)/(3*(1+c)), 1e-6);
  assert(result.corrected.d95 < eal.calculate({...base,angle:0}).corrected.d95);
  close(result.corrected.cumulative(result.corrected.d99),.99);
});
test('transport applicability guards and low-energy external EAL path', () => {
  [{energy:49},{energy:2001},{angle:51},{angle:49,halfAngle:2},{imfp:0},{transportMfp:0},{depth:-1},{angle:'',halfAngle:0}].forEach(change => assert.throws(()=>eal.calculate({...base,...change})));
  const result = eal.calculate({...base,method:'manual',energy:20,angle:70,halfAngle:5});
  close(result.eal,1.5); assert.equal(result.albedo,null); assert(result.corrected.d95>0);
  assert.throws(()=>eal.calculate({...base,method:'manual',angle:80,halfAngle:10}));
  assert.throws(()=>eal.calculate({...base,method:'manual',manualEal:0}));
});
console.log(passed + ' transport model tests passed.');
