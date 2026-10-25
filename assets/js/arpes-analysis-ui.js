(function(){
  'use strict';
  const A=Arpes,B=ArpesAnalysis,$=id=>document.getElementById(id),t=s=>window.I18n?.translate(s)||s,f=ArpesPlot.format;
  const svgNS='http://www.w3.org/2000/svg';
  function node(parent,tag,attrs={},text){const e=document.createElementNS(svgNS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;parent.append(e);return e;}
  const line=(svg,x1,y1,x2,y2,color='#29434b',extra={})=>node(svg,'line',{x1,y1,x2,y2,stroke:color,...extra});
  const label=(svg,x,y,text,extra={})=>node(svg,'text',{x,y,fill:'#aac5c1','font-size':12,'text-anchor':'middle',...extra},text);
  let energyContext=null,lastSurface=null,energyView=null,energyKey='',drag=null;
  function resetEnergyView(){energyView=null;}
  function energy(config){
    const svg=$('kzPlot');svg.replaceChildren();$('kzReadout').textContent='';energyContext=null;
    const start=$('energyStart').valueAsNumber,end=$('energyEnd').valueAsNumber;
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start)throw Error('Enter an increasing nonnegative photon-energy range.');
    if(end<=config.workFunction)throw Error('The energy range must extend above the work function.');
    const scales=A.displayScales(config),factor=scales.factors[2],unit=scales.units[2];
    const lo=Math.max(start,config.workFunction+1e-8),low=B.normalKz(config,lo)*factor,high=B.normalKz(config,end)*factor;
    const pad=Math.max((high-low)*.15,Math.abs(high)*1e-4,1e-6);
    const baseView={start,end,ymin:Math.max(0,low-pad),ymax:high+pad};
    const key=JSON.stringify([start,end,config.workFunction,config.innerPotential,factor,unit]);
    if(key!==energyKey){energyView=null;energyKey=key;}
    const view=energyView||baseView;
    const x=e=>65+(e-view.start)/(view.end-view.start)*510,y=k=>275-(k-view.ymin)/(view.ymax-view.ymin)*245;
    for(let i=0;i<=5;i++){const e=view.start+(view.end-view.start)*i/5,kv=view.ymin+(view.ymax-view.ymin)*i/5;line(svg,x(e),30,x(e),275);label(svg,x(e),294,f(e));line(svg,65,y(kv),575,y(kv));label(svg,56,y(kv)+4,f(kv),{'text-anchor':'end'});}
    label(svg,320,321,t('Photon Energy / eV'));label(svg,17,152,`kz (${unit})`,{transform:'rotate(-90 17 152)'});
    const defs=node(svg,'defs'),clip=node(defs,'clipPath',{id:'kzClip'});node(clip,'rect',{x:65,y:30,width:510,height:245});
    const layer=node(svg,'g',{'clip-path':'url(#kzClip)'}),curveStart=Math.max(lo,view.start),curveEnd=Math.min(end,view.end);
    if(curveEnd>curveStart){
      const points=Array.from({length:301},(_,i)=>{const e=curveStart+(curveEnd-curveStart)*i/300;return `${x(e)},${y(B.normalKz(config,e)*factor)}`;});
      node(layer,'polyline',{points:points.join(' '),fill:'none',stroke:'#77e4c8','stroke-width':2.5});
    }
    const current=B.normalKz(config,config.photonEnergy)*factor;
    if(config.photonEnergy>=view.start&&config.photonEnergy<=view.end){line(layer,x(config.photonEnergy),30,x(config.photonEnergy),275,'#ffb45d',{'stroke-dasharray':'4 4'});node(layer,'circle',{cx:x(config.photonEnergy),cy:y(current),r:4,fill:'#ffb45d'});}
    const crosshair=node(svg,'g',{id:'kzCrosshair',visibility:'hidden','pointer-events':'none'});
    const vertical=line(crosshair,0,30,0,275,'#c9ddd8',{'stroke-dasharray':'4 3'}),horizontal=line(crosshair,65,0,575,0,'#c9ddd8',{'stroke-dasharray':'4 3'});
    const selection=node(svg,'rect',{id:'kzSelection',visibility:'hidden',fill:'#77e4c828',stroke:'#77e4c8','pointer-events':'none'});
    const summary=`hν = ${f(config.photonEnergy)} eV · kz = ${f(current)} ${unit}`;$('kzReadout').textContent=summary;
    energyContext={config:{...config},view,baseView,factor,unit,summary,crosshair,vertical,horizontal,selection};
  }
  function cursor(event){
    const svg=$('kzPlot'),point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }
  const clamp=p=>({x:Math.max(65,Math.min(575,p.x)),y:Math.max(30,Math.min(275,p.y))});
  const inside=p=>p.x>=65&&p.x<=575&&p.y>=30&&p.y<=275;
  const energyAt=(p,v)=>v.start+(p.x-65)/510*(v.end-v.start);
  const kzAt=(p,v)=>v.ymax-(p.y-30)/245*(v.ymax-v.ymin);
  $('kzPlot').addEventListener('pointerdown',event=>{
    if(event.button!==0||!energyContext)return;const p=cursor(event);if(!inside(p))return;
    event.preventDefault();$('kzPlot').focus();$('kzPlot').setPointerCapture(event.pointerId);drag={start:p,id:event.pointerId};
  });
  $('kzPlot').addEventListener('pointermove',event=>{
    if(!energyContext)return;const c=energyContext,raw=cursor(event),p=clamp(raw);
    if(!drag&&!inside(raw)){c.crosshair.setAttribute('visibility','hidden');$('kzReadout').textContent=c.summary;return;}
    c.crosshair.setAttribute('visibility','visible');c.vertical.setAttribute('x1',p.x);c.vertical.setAttribute('x2',p.x);c.horizontal.setAttribute('y1',p.y);c.horizontal.setAttribute('y2',p.y);
    $('kzReadout').textContent=`hν = ${f(energyAt(p,c.view))} eV · kz = ${f(kzAt(p,c.view))} ${c.unit}`;
    if(drag){const attrs={visibility:'visible',x:Math.min(p.x,drag.start.x),y:Math.min(p.y,drag.start.y),width:Math.abs(p.x-drag.start.x),height:Math.abs(p.y-drag.start.y)};for(const [k,v] of Object.entries(attrs))c.selection.setAttribute(k,v);}
  });
  $('kzPlot').addEventListener('pointerup',event=>{
    if(!drag||!energyContext)return;const p=clamp(cursor(event)),start=drag.start,c=energyContext;drag=null;c.selection.setAttribute('visibility','hidden');
    if($('kzPlot').hasPointerCapture(event.pointerId))$('kzPlot').releasePointerCapture(event.pointerId);
    if(Math.abs(p.x-start.x)<5||Math.abs(p.y-start.y)<5)return;
    energyView={start:Math.min(energyAt(p,c.view),energyAt(start,c.view)),end:Math.max(energyAt(p,c.view),energyAt(start,c.view)),ymin:Math.min(kzAt(p,c.view),kzAt(start,c.view)),ymax:Math.max(kzAt(p,c.view),kzAt(start,c.view))};energy(c.config);
  });
  const cancelDrag=()=>{drag=null;energyContext?.selection.setAttribute('visibility','hidden');};
  $('kzPlot').addEventListener('pointercancel',cancelDrag);$('kzPlot').addEventListener('lostpointercapture',cancelDrag);
  $('kzPlot').addEventListener('pointerleave',()=>{if(energyContext&&!drag){energyContext.crosshair.setAttribute('visibility','hidden');$('kzReadout').textContent=energyContext.summary;}});
  const restoreEnergy=()=>{if(energyContext){const config=energyContext.config;resetEnergyView();energy(config);}};
  $('kzPlot').addEventListener('dblclick',restoreEnergy);
  $('kzPlot').addEventListener('keydown',event=>{if(event.key==='Home'||event.key==='Escape'){event.preventDefault();cancelDrag();restoreEnergy();}});
  function surface(config,cell){
    const data=B.surfaceZone(config,cell);lastSurface=data;
    const svg=$('sbzPlot');svg.replaceChildren();
    const factor=config.units==='pi'?config.a/Math.PI:1,unit=config.units==='pi'?'π/a':'Å⁻¹',radius=Math.max(...data.vertices.map(A.norm)),scale=125/radius;
    const project=p=>[300+p[0]*scale,165-p[1]*scale];
    line(svg,95,165,505,165);line(svg,300,15,300,315);
    label(svg,492,185,`kₛ (${unit})`);label(svg,340,25,`kᵈ (${unit})`);
    node(svg,'polygon',{points:data.vertices.map(p=>project(p).join(',')).join(' '),fill:'#77e4c80b',stroke:'#77e4c8','stroke-width':2});
    label(svg,310,157,'Γ');node(svg,'circle',{cx:300,cy:165,r:3,fill:'#fff'});
    const targetLine=line(svg,300,165,300,165,'#ffb45d',{'stroke-dasharray':'5 4','stroke-width':2});
    for(const p of data.points){
      const [x,y]=project(p.point),labelPoint=project(A.scale(p.point,1+17/(A.norm(p.point)*scale)));
      const dot=node(svg,'circle',{cx:x,cy:y,r:4,fill:p.reachable?'#ffb45d':'#fa718a',tabindex:0,role:'button','aria-label':p.label});
      node(dot,'title',{},`${p.label}: ${f(p.distance*factor)} ${unit}, θ = ${p.theta===null?t('Unreachable'):f(p.theta)+'°'}`);
      label(svg,labelPoint[0],labelPoint[1]+4,p.label,{'font-size':11});
      const select=()=>{targetLine.setAttribute('x2',x);targetLine.setAttribute('y2',y);};
      dot.addEventListener('click',select);dot.addEventListener('focus',select);
      dot.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select();}});
    }
    $('sbzRelations').replaceChildren();
    for(const relation of data.relations){
      const row=document.createElement('div');row.className='relation';
      const formula=document.createElement('span');formula.textContent=`${relation.label} = ${relation.expression} = ${f(relation.distance*factor)} ${unit}`;row.append(formula);
      if(relation.theta!==undefined){const angle=document.createElement('span');angle.className='relation-angle';angle.textContent=relation.theta===null?t('Unreachable'):`θ = ${f(relation.theta)}°`;row.append(angle);}
      $('sbzRelations').append(row);
    }
    if(data.lengths.a){const length=document.createElement('div');length.className='surface-length';length.textContent=`aₛ = ${f(data.lengths.a)} Å`+(data.lengths.b?` · bₛ = ${f(data.lengths.b)} Å`:'');$('sbzRelations').append(length);}
  }
  function clear(){energyContext=null;lastSurface=null;drag=null;resetEnergyView();for(const id of ['kzPlot','sbzPlot','sbzRelations'])$(id).replaceChildren();$('kzReadout').textContent='';for(const id of ['kzError','sbzError'])$(id).hidden=true;}
  function render(config,cell){
    for(const [run,error,outputs] of [[()=>energy(config),'kzError',['kzPlot','kzReadout']],[()=>surface(config,cell),'sbzError',['sbzPlot','sbzRelations']]]){
      try{run();$(error).hidden=true;}catch(e){if(error==='sbzError')lastSurface=null;for(const id of outputs)$(id).replaceChildren();$(error).textContent=t(e.message);$(error).hidden=false;}
    }
  }
  window.ArpesAnalysisUI={render,clear,resetEnergyView,getSurface:()=>lastSurface,getEnergyView:()=>energyContext?{...energyContext.view}:null};
}());
