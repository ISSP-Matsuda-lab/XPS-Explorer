const assert = require('node:assert/strict');
const model = require('../assets/js/escape-depth.js');
const photoionization = require('../assets/js/photoionization.js');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`OK ${name}`); }
function close(actual, expected, relative = 1e-10) { assert(Math.abs(actual - expected) <= relative * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`); }
const silicon = { density: 2.329, molarMass: 28.085, valence: 4, gap: 1.12 };
const crystal = { lattice: [[10,0,0],[0,10,0],[0,0,10]], atoms: [{ symbol:'Si', frac:[0,0,0], occupancy:1 }] };
const base = { structure:crystal, material:silicon, photonEnergy:1486.6, workFunction:4.5, angle:0, miller:[0,0,1], phase:0, thickness:3, peaks:[{ id:'Si-2p',symbol:'Si',label:'2p',bindingEnergy:100,lambda:1,sigma:1 }], instrument:{enabled:false} };
const run = overrides => model.predict({ ...base, ...overrides }, photoionization.crossSection);

test('Si agrees with supplied rounded reference values (within 0.03 nm)', () => {
  [[100,.53],[200,.76],[500,1.41],[1000,2.38],[2000,4.13]].forEach(([energy, expected]) => assert(Math.abs(model.imfp(energy,silicon)-expected)<.03));
  // Independent calculation using NIST's angstrom coefficients and Ep=28.8.
  const u=4*2.329/28.085, ep=28.8*Math.sqrt(u), energy=1000;
  const angstrom=energy/(ep*ep*((-.1+.944/Math.hypot(ep,1.12)+.069*2.329**.1)*Math.log(.191/Math.sqrt(2.329)*energy)-(1.97-.91*u)/energy+(53.4-20.8*u)/energy**2));
  close(model.imfp(energy,silicon),angstrom/10,.001);
});
test('IMFP is invariant to formula-unit scaling of M and Nv', () => close(model.imfp(1000,silicon),model.imfp(1000,{...silicon,molarMass:56.17,valence:8})));
test('invalid material and energy inputs are rejected', () => {
  ['density','molarMass','valence'].forEach(key=>assert.throws(()=>model.imfp(1000,{...silicon,[key]:0})));
  assert.throws(()=>model.imfp(0,silicon)); assert.throws(()=>model.imfp(NaN,silicon)); assert.throws(()=>model.imfp(1000,{...silicon,gap:-1}));
});
test('one mean free path gives exp(-1); angle measured from normal', () => {
  close(model.attenuation(1,1,0),Math.exp(-1)); close(model.attenuation(1,1,60),Math.exp(-2));
  assert.throws(()=>model.attenuation(1,1,90));
});
test('kinetic energy subtracts binding energy and work function', () => close(run({}).rows[0].energy,1382.1));
test('finite slab excludes the bottom boundary and preserves absolute units', () => {
  const result=run({}); close(result.surface.spacing,1); close(result.surface.volume,1000);
  close(result.rows[0].effectiveAtoms,1+Math.exp(-1)+Math.exp(-2));
  close(result.rows[0].area,1e-4*(1+Math.exp(-1)+Math.exp(-2)));
  close(result.rows[0].fraction,1);
});
test('manual IMFP controls depth attenuation and 95% information depth', () => {
  close(run({}).rows[0].informationDepth,-Math.log(.05));
  const grazing=run({angle:60}); close(grazing.rows[0].effectiveAtoms,1+Math.exp(-2)+Math.exp(-4));
  assert(grazing.total<run({}).total);
});
test('thickness saturates at the infinite geometric sum', () => {
  const result=run({thickness:10000}); close(result.rows[0].effectiveAtoms,1/(1-Math.exp(-1)));
  assert(run({thickness:.9}).total < run({thickness:2}).total);
});
test('occupancy, sigma and collected counts have linear scaling', () => {
  const half={...crystal,atoms:[{...crystal.atoms[0],occupancy:.5}]}; close(run({structure:half}).total,run({}).total/2);
  const instrument={enabled:true,flux:1e10,time:2,solidAngle:.01,efficiency:.1,exponent:0};
  close(run({instrument}).rows[0].counts,run({}).total*1e10*2*.01/(4*Math.PI)*.1);
  const peaks=[{...base.peaks[0],sigma:2}]; close(run({peaks}).total,run({}).total*2);
  assert.throws(()=>run({instrument:{...instrument,efficiency:2}}));
});
test('unphysical energy-dependent efficiency does not produce counts', () => {
  const result=run({instrument:{enabled:true,flux:1e10,time:1,solidAngle:.01,efficiency:1,exponent:1}});
  assert.equal(result.rows[0].counts,null); assert.match(result.rows[0].status.join(),/透過関数/);
});
test('non-orthogonal cells use reciprocal vectors, not lattice lengths', () => {
  const oblique={...crystal,lattice:[[10,0,0],[0,10,0],[6,0,8]]};
  const result=run({structure:oblique}); close(result.surface.spacing,.8); close(result.surface.sites[0].arealDensity,1);
});
test('Miller direction and greatest-common-divisor normalization are correct', () => {
  close(run({miller:[1,1,1]}).surface.spacing,1/Math.sqrt(3));
  close(run({miller:[0,0,2]}).total,run({}).total);
  assert.throws(()=>run({miller:[0,0,0]})); assert.throws(()=>run({miller:[.5,0,1]}));
});
test('surface phase and opposite normals change termination', () => {
  const binary={...crystal,atoms:[{symbol:'Si',frac:[0,0,.25],occupancy:1}]};
  close(run({structure:binary}).surface.sites[0].firstDepth,.75);
  close(run({structure:binary,miller:[0,0,-1]}).surface.sites[0].firstDepth,.25);
  close(run({structure:binary,phase:.25}).surface.sites[0].firstDepth,0);
  close(run({phase:1}).total,run({phase:0}).total);
});
test('closed thresholds are zero; missing data remains missing', () => {
  const closed=run({photonEnergy:104.5}); assert.equal(closed.rows[0].area,0); assert.equal(closed.rows[0].lambda,null);
  const missing=run({photonEnergy:20000,peaks:[{...base.peaks[0],sigma:'',lambda:''}]});
  assert.equal(missing.rows[0].area,null); assert.equal(missing.rows[0].lambda,null); assert.equal(missing.rows[0].fraction,null); assert(missing.incomplete);
});
test('energy ranges are explicit and can be overridden with measured IMFP', () => {
  const peaks=[{...base.peaks[0],lambda:''}];
  assert.equal(run({photonEnergy:120,peaks}).rows[0].lambda,null);
  assert.equal(run({photonEnergy:5000,peaks}).rows[0].imfpMethod,'TPP-2M 外挿');
  assert.equal(run({photonEnergy:120}).rows[0].lambda,1);
});
test('spin orbit cross sections preserve statistical weights', () => {
  const peaks=['2p1/2','2p3/2'].map((label,i)=>({id:String(i),symbol:'Si',label,bindingEnergy:100,lambda:1}));
  const result=run({peaks}); close(result.rows[1].area/result.rows[0].area,2); close(result.rows[0].fraction,1/3);
});
test('disabled peaks and unavailable peaks are excluded from normalization', () => {
  const peaks=[...base.peaks,{...base.peaks[0],id:'missing',label:'9z',sigma:''},{...base.peaks[0],id:'disabled',enabled:false}];
  const result=run({peaks}); assert.equal(result.rows.length,2); close(result.rows[0].fraction,1); assert(result.incomplete);
});
test('empty, duplicate and singular structures fail visibly', () => {
  assert.throws(()=>model.validateStructure({...crystal,atoms:[]}));
  assert.throws(()=>model.validateStructure({...crystal,atoms:[...crystal.atoms,{symbol:'Si',frac:[0,0,1],occupancy:1}]}));
  assert.throws(()=>model.latticeGeometry([[1,0,0],[2,0,0],[0,0,1]]));
  assert.throws(()=>model.parseAtoms('Si 0 0')); assert.throws(()=>model.parseAtoms('Si 0 0 0 -1'));
});
test('direct coordinate editor accepts comments and optional occupancy', () => {
  const atoms=model.parseAtoms('# comment\nSi 0 0 0\nO .5 .5 .5 .4'); assert.equal(atoms.length,2); assert.equal(atoms[0].occupancy,1); close(atoms[1].occupancy,.4);
});
const poscar=`Silicon\n2\n5 0 0\n0 5 0\n0 0 5\nSi O\n1 1\nSelective dynamics\nDirect\n0 0 0 T T T\n.25 .5 .75 F F F`;
test('POSCAR supports VASP 5 and selective dynamics', () => {
  const parsed=model.parsePoscar(poscar); close(parsed.volume,1000); assert.equal(parsed.atoms.length,2); assert.deepEqual(parsed.atoms[1].frac,[.25,.5,.75]);
});
test('POSCAR Cartesian scale and negative target volume are handled', () => {
  const parsed=model.parsePoscar(poscar.replace('Direct','Cartesian').replace('.25 .5 .75','1.25 2.5 3.75'));
  assert.deepEqual(parsed.atoms[1].frac,[.25,.5,.75]);
  close(model.parsePoscar(poscar.replace('\n2\n','\n-1000\n')).volume,1000);
  assert.throws(()=>model.parsePoscar(poscar.replace('\nSi O\n','\n2 1\n')));
});
const cif=`data_test
_cell_length_a 5.431(1)
_cell_length_b 5.431
_cell_length_c 5.431
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
loop_
_space_group_symop_id
_space_group_symop_operation_xyz
1 'x,y,z'
2 '-x,-y,-z'
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_occupancy
Si1 Si .25 .25 .25 1
`;
test('CIF expands supplied symmetry and handles crystallographic uncertainties', () => {
  const parsed=model.parseCif(cif); assert.equal(parsed.atoms.length,2); close(parsed.lattice[0][0],5.431); assert.deepEqual(parsed.atoms[1].frac,[.75,.75,.75]);
});
test('CIF special positions are deduplicated', () => assert.equal(model.parseCif(cif.replace('Si .25 .25 .25','Si 0 0 0')).atoms.length,1));
test('CIF fractional translations and hexagonal symmetry are parsed without eval', () => {
  const parsed=model.parseCif(cif.replace("'-x,-y,-z'","'x-y,x,z+1/2'")); assert.deepEqual(parsed.atoms[1].frac,[0,.25,.75]);
  assert.throws(()=>model.parseCif(cif.replace("'-x,-y,-z'","'alert(1),y,z'")));
});
test('CIF with absent nontrivial symmetry or multiple blocks is refused', () => {
  const without=cif.replace(/loop_\n_space_group_symop_id[\s\S]*?2 '-x,-y,-z'\n/,'');
  assert.throws(()=>model.parseCif(without));
  assert.equal(model.parseCif(without.replace('data_test','data_test\n_space_group_IT_number 1')).atoms.length,1);
  assert.throws(()=>model.parseCif(cif+'\ndata_other\n'));
});
test('CIF uncertainties, comments, quoted names and semicolon fields coexist', () => {
  const extra=cif.replace('data_test',`data_test\n_chemical_name_common 'silicon example' # comment\n_description\n;multiple\nlines\n;`);
  assert.equal(model.parseStructure(extra).atoms.length,2);
});
console.log(`${passed} escape-depth tests passed.`);
