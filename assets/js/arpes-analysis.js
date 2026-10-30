/* Surface-cell geometry and free-electron planning calculations. */
(function(root){
  'use strict';
  const A=typeof module!=='undefined'&&module.exports?require('./arpes.js'):root.Arpes;
  const unit=v=>A.scale(v,1/A.norm(v)),gcd=(a,b)=>b?gcd(b,a%b):Math.abs(a);
  function bezout(a,b){if(!b)return [Math.sign(a),0];const [x,y]=bezout(b,a%b);return [y,x-Math.trunc(a/b)*y];}
  function normalKz(config,energy){
    if(!Number.isFinite(energy)||energy<=config.workFunction) return null;
    return Math.sqrt(A.K2*(energy-config.workFunction+config.innerPotential));
  }
  // Orthogonal maps must preserve the whole polygon, not only a point's radius.
  function symmetryMaps(vertices){
    const seed=unit(vertices[0]),tolerance=1e-6*Math.max(...vertices.map(A.norm));
    const maps=[];
    for(const vertex of vertices)for(const sign of [1,-1]){
      const target=unit(vertex),map=p=>{
        const x=p[0]*seed[0]+p[1]*seed[1],y=(-p[0]*seed[1]+p[1]*seed[0])*sign;
        return [x*target[0]-y*target[1],x*target[1]+y*target[0],0];
      };
      if(vertices.every(p=>vertices.some(q=>A.norm(A.sub(map(p),q))<tolerance)))maps.push(map);
    }
    return {maps,tolerance};
  }
  function surfaceBasis(config,cell){
    const orientation=A.orientation(config),n=orientation.normal;
    let real;
    if(cell.dimension===2){
      if(Math.abs(n[2])<1-1e-8)throw Error('For a 2D crystal, the surface normal must be parallel to crystal z.');
      real=cell.primitive;
    }else{
      // A periodic surface exists when n is proportional to an integer reciprocal vector.
      const projections=cell.primitive.map(v=>A.dot(v,n)),largest=Math.max(...projections.map(Math.abs)),ratios=projections.map(v=>v/largest);
      let h=null;
      for(let denominator=1;denominator<=24;denominator++){
        const candidate=ratios.map(v=>Math.round(v*denominator));
        if(ratios.every((v,i)=>Math.abs(v-candidate[i]/denominator)<1e-7)){h=candidate;break;}
      }
      if(!h)throw Error('No periodic surface found for this normal (primitive Miller indices up to 24). Choose a crystallographic normal.');
      const common=gcd(gcd(h[0],h[1]),h[2]);h=h.map(v=>v/common);
      const g=gcd(h[0],h[1]);
      if(g===0)real=cell.primitive.slice(0,2);
      else {const [x,y]=bezout(h[0],h[1]);real=[[h[1]/g,-h[0]/g,0],[-h[2]*x,-h[2]*y,g]].map(v=>A.combine(cell.primitive,v));}
    }
    // Gauss-reduce the surface basis; each operation is an integer change of basis.
    real=real.map(v=>v.slice());
    for(let i=0;i<100;i++){
      if(A.norm(real[1])<A.norm(real[0]))[real[0],real[1]]=[real[1],real[0]];
      const q=Math.round(A.dot(real[0],real[1])/A.dot(real[0],real[0]));if(!q)break;
      real[1]=A.sub(real[1],A.scale(real[0],q));
    }
    const xy=real.map(v=>[A.dot(v,orientation.slit),A.dot(v,orientation.perpendicular),0]);
    const area=xy[0][0]*xy[1][1]-xy[0][1]*xy[1][0];
    if(Math.abs(area)<1e-12)throw Error('The surface cell is degenerate.');
    const reciprocal=[[xy[1][1],-xy[1][0],0],[-xy[0][1],xy[0][0],0]].map(v=>A.scale(v,2*Math.PI/area));
    return {real,reciprocal,area:Math.abs(area),orientation};
  }
  function surfaceZone(config,cell=A.lattice(config)){
    const surface=surfaceBasis(config,cell),zone=A.brillouinZone(surface.reciprocal);
    const vertices=zone.vertices.slice().sort((a,b)=>Math.atan2(a[1],a[0])-Math.atan2(b[1],b[0]));
    const radii=vertices.map(A.norm),equalRadii=Math.max(...radii)-Math.min(...radii)<1e-6*Math.max(...radii);
    const edges=vertices.map((v,i)=>A.sub(vertices[(i+1)%vertices.length],v)),edgeLengths=edges.map(A.norm);
    const regular=equalRadii&&Math.max(...edgeLengths)-Math.min(...edgeLengths)<1e-6*Math.max(...edgeLengths);
    const rectangular=vertices.length===4&&edges.every((v,i)=>Math.abs(A.dot(v,edges[(i+1)%4]))<1e-6*A.norm(v)*A.norm(edges[(i+1)%4]));
    const kind=regular&&vertices.length===6?'hexagonal':regular&&vertices.length===4?'square':rectangular?'rectangular':'oblique';
    const k0=Math.sqrt(A.K2*(config.photonEnergy-config.workFunction));
    const {maps,tolerance}=symmetryMaps(vertices),representatives=[];
    // Start with a vertex and its adjacent midpoint so distance relations refer to a visible triangle.
    const boundary=vertices.flatMap((p,i)=>[{type:'vertex',point:p},{type:'edge',point:A.scale(A.add(p,vertices[(i+1)%vertices.length]),.5)}]).sort((a,b)=>A.norm(A.sub(a.point,vertices[0]))-A.norm(A.sub(b.point,vertices[0])));
    for(const p of boundary){
      if(!representatives.some(q=>q.type===p.type&&maps.some(map=>A.norm(A.sub(map(p.point),q.point))<tolerance)))representatives.push(p);
    }
    const counts={vertex:0,edge:0};
    const candidates=representatives.map(p=>{
      const i=++counts[p.type];
      const name=p.type==='vertex'?(kind==='hexagonal'?'K':kind==='square'?'M':kind==='rectangular'?'S':`V${i}`)
        :(kind==='hexagonal'?'M':kind==='square'?'X':kind==='rectangular'?(i===1?'X':'Y'):`E${i}`);
      return {...p,label:name};
    });
    const points=candidates.map(p=>{
      const distance=A.norm(p.point),reachable=distance<=k0*(1+1e-12),theta=reachable?Math.asin(Math.min(1,distance/k0))*180/Math.PI:null;
      const azimuth=Math.atan2(p.point[1],p.point[0])*180/Math.PI;
      let slit=null,deflector=null;
      if(reachable){const s=Math.asin(Math.max(-1,Math.min(1,p.point[0]/k0))),denominator=k0*Math.cos(s);slit=s*180/Math.PI+config.offsetSlit;
        if(Math.abs(denominator)>1e-10)deflector=Math.asin(Math.max(-1,Math.min(1,-p.point[1]/denominator)))*180/Math.PI+config.offsetPerpendicular;}
      return {...p,distance,theta,azimuth,slit,deflector,reachable};
    });
    const relations=[],byName=name=>points.find(p=>p.label===name);
    const radial=(name,expression)=>relations.push({label:`Γ–${name}`,expression,distance:byName(name).distance,theta:byName(name).theta});
    const between=(a,b,expression)=>relations.push({label:`${a}–${b}`,expression,distance:A.norm(A.sub(byName(a).point,byName(b).point)),theta:undefined});
    const lengths={};
    if(kind==='hexagonal'){
      lengths.a=2*Math.PI/(Math.sqrt(3)*byName('M').distance);
      radial('M','2π / (√3 aₛ)');radial('K','Γ–M / cos(30°)');between('K','M','Γ–M · tan(30°)');
    }else if(kind==='square'){
      lengths.a=Math.PI/byName('X').distance;
      radial('X','π / aₛ');radial('M','√2 · Γ–X');between('X','M','Γ–X');
    }else if(kind==='rectangular'){
      lengths.a=Math.PI/byName('X').distance;lengths.b=Math.PI/byName('Y').distance;
      radial('X','π / aₛ');radial('Y','π / bₛ');radial('S','√[(Γ–X)² + (Γ–Y)²]');between('X','S','Γ–Y');between('Y','S','Γ–X');
    }else{
      for(const p of points)radial(p.label,`√[kₛ(${p.label})² + kᵈ(${p.label})²]`);
      const [v,e]=points;
      if(v&&e)between(v.label,e.label,`√[(Γ–${v.label})² + (Γ–${e.label})² − 2(Γ–${v.label})(Γ–${e.label}) cos Δφ]`);
    }
    return {surface,zone,vertices,points,kind,k0,relations,lengths};
  }
  const api={normalKz,surfaceBasis,surfaceZone};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ArpesAnalysis=api;
}(typeof window!=='undefined'?window:globalThis));
