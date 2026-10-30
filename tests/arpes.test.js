const assert=require('node:assert/strict');
const path=require('node:path');
const A=require(path.join(path.dirname(__dirname),'assets','js','arpes.js'));
const close=(a,b,tolerance=1e-8)=>assert(Math.abs(a-b)<tolerance*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const vectorClose=(a,b)=>a.forEach((v,i)=>close(v,b[i]));
let passed=0;const test=(name,run)=>{run();passed++;console.log('OK '+name);};
const config=changes=>({...A.DEFAULTS,...changes});
const zoneMeasure=zone=>zone.faces.length===1?Math.abs(zone.faces[0].reduce((s,a,i,face)=>s+A.cross(a,face[(i+1)%face.length])[2],0))/2:zone.faces.reduce((sum,face)=>sum+face.slice(1,-1).reduce((s,b,i)=>s+Math.abs(A.dot(face[0],A.cross(b,face[i+2])))/6,0),0);
test('Normal emission reproduces the reference free-electron final state',()=>{
  vectorClose(A.momentum(config({}),0,0),[0,0,Math.sqrt(A.K2*(21.2-4.5+15))]);
  vectorClose(A.momentum(config({innerPotential:0}),0,0),[0,0,Math.sqrt(A.K2*(21.2-4.5))]);
});
test('Reference analyzer angles and offsets agree with independent trigonometry',()=>{
  const c=config({offsetSlit:5,offsetPerpendicular:-3}),s=20*Math.PI/180,d=10*Math.PI/180,k=Math.sqrt(A.K2*16.7);
  vectorClose(A.momentum(c,25,7),[k*Math.sin(s),-k*Math.cos(s)*Math.sin(d),Math.sqrt(A.K2*(16.7*Math.cos(s)**2*Math.cos(d)**2+15))]);
  vectorClose(A.momentum(c,5,-3),A.momentum(config({}),0,0));
});
test('Only deflector scans are supported',()=>{
  assert.throws(()=>A.simulate(config({scanMode:'polar'})),/deflector/);
});
test('Azimuth and arbitrary sample normals preserve momentum magnitude',()=>{
  const original=A.momentum(config({}),20,10),rotated=A.momentum(config({azimuth:90}),20,10);
  vectorClose(rotated,[-original[1],original[0],original[2]]);
  const oblique=A.momentum(config({normal:'1,2,3',slitDirection:'3,0,1'}),20,10);close(A.norm(oblique),A.norm(original));
  vectorClose(A.momentum(config({normal:'0,0,10',slitDirection:'2,0,7'}),20,10),original);
});
for(const bravais of ['square','rectangular','centered','hexagonal','oblique'])test('2D '+bravais+' zone has the reciprocal primitive area',()=>{
  const cell=A.lattice(config({bravais,b:5,gamma:43})),zone=A.brillouinZone(cell.reciprocal);
  close(zoneMeasure(zone),(2*Math.PI)**2/cell.primitiveMeasure);
  cell.primitive.forEach((a,i)=>cell.reciprocal.forEach((b,j)=>close(A.dot(a,b),i===j?2*Math.PI:0)));
  assert(zone.vertices.length>=4&&zone.vertices.length<=6);
});
test('Square and hexagonal zone boundaries have the analytical dimensions',()=>{
  const square=A.brillouinZone(A.lattice(config({bravais:'square',a:2})).reciprocal);assert.equal(square.vertices.length,4);square.vertices.forEach(p=>{close(Math.abs(p[0]),Math.PI/2);close(Math.abs(p[1]),Math.PI/2);});
  const hex=A.brillouinZone(A.lattice(config({bravais:'hexagonal',a:3})).reciprocal);assert.equal(hex.vertices.length,6);hex.vertices.forEach(p=>close(A.norm(p),4*Math.PI/9));
});
for(const [system,centers] of Object.entries(A.CENTERINGS))for(const centering of centers)test(`3D ${system} ${centering}: reciprocal duality, volume, and Wigner–Seitz faces`,()=>{
  const c=config({dimension:3,system,centering,a:3,b:4,c:5,alpha:77,beta:106,gamma:65}),cell=A.lattice(c),zone=A.brillouinZone(cell.reciprocal);
  cell.primitive.forEach((a,i)=>cell.reciprocal.forEach((b,j)=>close(A.dot(a,b),i===j?2*Math.PI:0)));
  close(cell.conventionalMeasure/cell.primitiveMeasure,{P:1,C:2,I:2,F:4,R:3}[centering]);
  close(zoneMeasure(zone),(2*Math.PI)**3/cell.primitiveMeasure,1e-7);
  for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)for(let k=-2;k<=2;k++){
    const g=A.combine(cell.reciprocal,[i,j,k]);for(const v of zone.vertices)assert(A.dot(v,g)<=A.dot(g,g)/2+1e-7);
  }
});
test('Cubic primitive, body-centered, and face-centered real cells yield expected BZ topology',()=>{
  const expected={P:[8,6],I:[14,12],F:[24,14]};
  for(const centering of Object.keys(expected)){const zone=A.brillouinZone(A.lattice(config({dimension:3,a:4,b:4,c:4,centering})).reciprocal);assert.deepEqual([zone.vertices.length,zone.faces.length],expected[centering]);}
});
test('Rhombohedral axes are primitive and the equivalent hexagonal axes are R-centered',()=>{
  const cell=A.lattice(config({dimension:3,system:'rhombohedral',centering:'R',a:4,alpha:73}));
  cell.primitive.forEach(p=>close(A.norm(p),4));close(A.norm(cell.conventional[0]),A.norm(cell.conventional[1]));
  close(A.dot(cell.conventional[0],cell.conventional[1])/(A.norm(cell.conventional[0])*A.norm(cell.conventional[1])),-.5);
  const other=A.TRANSFORMS.R.map(v=>A.combine(cell.conventional,v));other.forEach((v,i)=>vectorClose(v,cell.primitive[i]));
});
test('Folding finds a true nearest reciprocal point for skew cells, not rounded fractional coordinates',()=>{
  for(const settings of [{dimension:2,bravais:'oblique',a:3,b:4,gamma:18},{dimension:3,system:'triclinic',a:3,b:4,c:5,alpha:64,beta:72,gamma:37}]){
    const cell=A.lattice(config(settings)),nearest=A.nearestSolver(cell.reciprocal),dim=cell.dimension;
    for(let sample=0;sample<22;sample++){
      const p=[Math.sin(sample*1.7)*3,Math.cos(sample*.9)*4,dim===3?Math.sin(sample*.6)*2:0],folded=nearest(p).point;
      let brute=Infinity;
      for(let i=-8;i<=8;i++)for(let j=-8;j<=8;j++)for(let k=dim===3?-8:0;k<=(dim===3?8:0);k++)brute=Math.min(brute,A.norm(A.sub(p,A.combine(cell.reciprocal,[i,j,k]))));
      close(A.norm(folded),brute);vectorClose(nearest(folded).point,folded);
      const shifted=A.add(p,A.combine(cell.reciprocal,[2,-3,1]));vectorClose(nearest(shifted).point,folded);
    }
  }
});
test('2D omits kz, folding stays in the first zone, and hidden BZ does not affect calculation',()=>{
  const c=config({photonEnergy:100,slitStart:-70,slitEnd:70,scanStart:-60,scanEnd:60,slitCount:13,scanCount:11,fold:true});
  const simulation=A.simulate(c),zone=A.brillouinZone(simulation.cell.reciprocal);assert.equal(simulation.points.length,143);
  for(const p of simulation.points){close(p.displayed[2],0);assert(p.absolute[2]>0);assert(A.norm(p.displayed)<=Math.max(...zone.vertices.map(A.norm))+1e-8);}
  assert.deepEqual(A.simulate({...c,showBZ:false}).points,simulation.points);
});
test('Degenerate angle ranges give single cuts without duplicate points',()=>{
  assert.equal(A.simulate(config({slitStart:0,slitEnd:0})).points.length,31);
  assert.equal(A.simulate(config({slitStart:0,slitEnd:0,scanStart:5,scanEnd:5})).points.length,1);
});
test('Invalid energy, orientation, geometry, and scan domains fail explicitly',()=>{
  for(const settings of [{photonEnergy:4},{workFunction:-1},{innerPotential:-1},{normal:'0,0,0'},{slitDirection:'0,0,1'},{normal:'1,2'},{slitStart:10,slitEnd:-10},{offsetSlit:100},{slitCount:0},{scanCount:1},{scanCount:122},{scanCount:2.5}])assert.throws(()=>A.simulate(config(settings)),JSON.stringify(settings));
  for(const settings of [{a:0},{dimension:2,bravais:'oblique',gamma:0},{dimension:3,system:'hexagonal',centering:'F'},{dimension:3,system:'triclinic',alpha:10,beta:10,gamma:170}])assert.throws(()=>A.lattice(config(settings)));
});
test('Nearby zone follows the reciprocal center at the measured kz',()=>{
  const simulation=A.simulate(config({dimension:3})),center=A.zoneCenters(simulation)[0];
  assert(center[2]>2);close(center[0],0);close(center[1],0);
  const mean=A.scale(simulation.points.map(p=>p.displayed).reduce(A.add,[0,0,0]),1/simulation.points.length);
  vectorClose(center,A.nearestSolver(simulation.cell.reciprocal)(mean).shift);
});
test('All occupied cells cover every measured point in both dimensions, including oblique lattices',()=>{
  for(const settings of [{dimension:2,bravais:'oblique',gamma:65},{dimension:3,system:'triclinic',alpha:80,beta:100,gamma:75}]){
    const simulation=A.simulate(config({...settings,photonEnergy:130,slitStart:-55,slitEnd:55,scanStart:-50,scanEnd:50})),centers=A.zoneCenters(simulation,true),nearest=A.nearestSolver(simulation.cell.reciprocal);
    assert(centers.length>1);
    for(const p of simulation.points)assert(centers.some(c=>A.norm(A.sub(c,nearest(p.displayed).shift))<1e-8));
    const folded=A.simulate(config({...settings,fold:true}));
    A.zoneCenters(folded,true).forEach(c=>close(A.norm(c),0));
  }
});
test('All occupied cells retain the reference cell even when no sample falls inside it',()=>{
  const simulation={cell:{reciprocal:[[1,0,0],[0,1,0],[0,0,1]]},points:[{displayed:[-2,0,3]},{displayed:[2,0,3]}]};
  const primary=A.zoneCenters(simulation)[0],centers=A.zoneCenters(simulation,true);
  vectorClose(primary,[0,0,3]);vectorClose(centers[0],primary);assert.equal(centers.length,3);
});
const B=require(path.join(path.dirname(__dirname),'assets','js','arpes-analysis.js'));
test('Normal-emission energy curve agrees with momentum and excludes emission threshold',()=>{
  for(const energy of [6,21.2,100,1000])close(B.normalKz(config({}),energy),A.momentum(config({photonEnergy:energy}),0,0)[2]);
  assert.equal(B.normalKz(config({}),4.5),null);
});
test('Surface square and hexagonal symmetry distances and emission angles match analytical results',()=>{
  const square=B.surfaceZone(config({bravais:'square',a:4}));assert.equal(square.kind,'square');
  for(const p of square.points)close(p.distance,p.label.startsWith('M')?Math.sqrt(2)*Math.PI/4:Math.PI/4);
  const hex=B.surfaceZone(config({bravais:'hexagonal',a:4}));assert.equal(hex.kind,'hexagonal');
  for(const p of hex.points){close(p.distance,p.label.startsWith('K')?Math.PI/3:Math.PI/(2*Math.sqrt(3)));close(Math.sin(p.theta*Math.PI/180)*hex.k0,p.distance);}
});
test('FCC (111) surface is triangular with primitive length a/sqrt(2)',()=>{
  const c=config({dimension:3,a:4,b:4,c:4,centering:'F',normal:'1,1,1',slitDirection:'1,-1,0'}),surface=B.surfaceZone(c);
  assert.equal(surface.kind,'hexagonal');close(surface.surface.area,Math.sqrt(3)*4);
  for(const v of surface.surface.real){close(A.norm(v),4/Math.sqrt(2));close(A.dot(v,[1,1,1]),0);}
});
test('Surface integer kernel supports signed normals and preserves primitive surface area',()=>{
  for(const normal of ['1,2,3','-1,2,3','0,-1,2','0,0,-1']){
    const c=config({dimension:3,a:1,b:1,c:1,normal,slitDirection:'1,0,0'}),surface=B.surfaceZone(c),n=A.vector(normal);
    close(surface.surface.area,A.norm(n));surface.surface.real.forEach(v=>close(A.dot(v,n),0));
  }
});
test('Surface angle settings invert the deflector momentum map and flag unreachable points',()=>{
  const c=config({offsetSlit:5,offsetPerpendicular:-3,azimuth:27,photonEnergy:100}),surface=B.surfaceZone(c);
  for(const p of surface.points){const momentum=A.momentum(c,p.slit,p.deflector);close(A.dot(momentum,surface.surface.orientation.slit),p.point[0]);close(A.dot(momentum,surface.surface.orientation.perpendicular),p.point[1]);}
  assert(B.surfaceZone(config({photonEnergy:4.6})).points.every(p=>!p.reachable&&p.theta===null));
  assert.throws(()=>B.surfaceZone(config({dimension:3,normal:'1,1.41421356237,1'})),/periodic surface/);
});
test('Reduced momentum units use a, b, and c independently for x, y, and z',()=>{
  const c=config({a:4,b:7,c:9,units:'pi'}),scales=A.displayScales(c),k=A.momentum(c,0,0);
  vectorClose(scales.factors,[4/Math.PI,7/Math.PI,9/Math.PI]);assert.deepEqual(scales.units,['π/a','π/b','π/c']);
  close(B.normalKz(c,c.photonEnergy)*scales.factors[2],k[2]/(Math.PI/9));
  close(A.displayScales({...c,a:7}).factors[2],scales.factors[2]);
  close(A.displayScales({...c,c:18}).factors[2],2*scales.factors[2]);
  close(A.displayScales({...c,b:14}).factors[1],2*scales.factors[1]);
  close(A.displayScales({...c,a:8}).factors[1],scales.factors[1]);
  assert.deepEqual(A.displayScales({...c,units:'angstrom'}).factors,[1,1,1]);
});
test('Surface points retain only distinct symmetry orbits without merging equal-radius inequivalent vertices',()=>{
  assert.equal(B.surfaceZone(config({bravais:'hexagonal'})).points.length,2);
  assert.equal(B.surfaceZone(config({bravais:'square'})).points.length,2);
  assert.equal(B.surfaceZone(config({bravais:'rectangular',a:4,b:7})).points.length,3);
  const skew=B.surfaceZone(config({bravais:'oblique',a:4,b:5,gamma:74}));
  assert.equal(skew.points.length,6);assert.equal(skew.points.filter(p=>p.type==='vertex').length,3);
  for(const azimuth of [0,27,90,180])assert.equal(B.surfaceZone(config({azimuth})).points.length,2);
});
test('Surface distance relations agree with geometry including nontrivial surface lengths',()=>{
  for(const settings of [{bravais:'hexagonal'},{bravais:'square'},{bravais:'rectangular',a:4,b:7},{dimension:3,a:4,b:4,c:4,centering:'F',normal:'1,1,1',slitDirection:'1,-1,0'}]){
    const data=B.surfaceZone(config(settings)),r=Object.fromEntries(data.relations.map(r=>[r.label,r.distance]));
    if(data.kind==='hexagonal'){
      close(r['Γ–M'],2*Math.PI/(Math.sqrt(3)*data.lengths.a));close(r['Γ–K'],r['Γ–M']/Math.cos(Math.PI/6));close(r['K–M'],r['Γ–M']*Math.tan(Math.PI/6));
      if(settings.dimension===3)close(data.lengths.a,4/Math.sqrt(2));
    }else if(data.kind==='square'){close(r['Γ–M'],Math.sqrt(2)*r['Γ–X']);close(r['X–M'],r['Γ–X']);}
    else {close(r['Γ–S'],Math.hypot(r['Γ–X'],r['Γ–Y']));close(r['X–S'],r['Γ–Y']);close(r['Y–S'],r['Γ–X']);}
  }
});
test('Primitive orthogonal and hexagonal kz boundaries are pi/c, not the full 2pi/c period',()=>{
  for(const system of ['orthogonal','hexagonal'])for(const centering of (system==='orthogonal'?['P','C']:['P'])){
    const c=config({dimension:3,system,centering,a:4,b:5,c:6,units:'pi'}),cell=A.lattice(c),zone=A.brillouinZone(cell.reciprocal);
    close(Math.max(...zone.vertices.map(p=>p[2])),Math.PI/c.c);close(Math.min(...zone.vertices.map(p=>p[2])),-Math.PI/c.c);
    close(Math.max(...zone.vertices.map(p=>p[2]))*A.displayScales(c).factors[2],1);
    const nearest=A.nearestSolver(cell.reciprocal);
    vectorClose(nearest([0,0,.99*Math.PI/c.c]).shift,[0,0,0]);
    vectorClose(nearest([0,0,1.01*Math.PI/c.c]).shift,[0,0,2*Math.PI/c.c]);
  }
});
test('Cubic centered lattices have a different axial boundary from a primitive conventional cell',()=>{
  for(const centering of ['I','F']){
    const c=config({dimension:3,system:'orthogonal',centering,a:4,b:4,c:4,units:'pi'}),cell=A.lattice(c),zone=A.brillouinZone(cell.reciprocal);
    const intersections=zone.faces.map(face=>{const n=A.cross(A.sub(face[1],face[0]),A.sub(face[2],face[0]));return Math.abs(n[2])>1e-10?A.dot(n,face[0])/n[2]:Infinity;}).filter(t=>t>1e-10);
    const boundary=Math.min(...intersections);close(boundary,2*Math.PI/c.c);close(boundary*A.displayScales(c).factors[2],2);
    const nearest=A.nearestSolver(cell.reciprocal);
    close(A.norm(nearest([0,0,boundary*.99]).shift),0);assert(A.norm(nearest([0,0,boundary*1.01]).shift)>0);
  }
});
console.log(`${passed} ARPES numerical tests passed.`);
