(function () {
  'use strict';
  const A=window.Arpes,P=window.ArpesPlot,$=id=>document.getElementById(id),translate=text=>window.I18n?.translate(text)||text;
  const key='xps-toolkit.arpes.v1',keys=Object.keys(A.DEFAULTS).filter(id=>id!=='scanMode'),ranges=['slitStart','slitEnd','scanStart','scanEnd'];
  const vectorKeys=['normal','slitDirection'],componentFields=id=>['X','Y','Z'].map(axis=>$(id+axis));
  const plot=new P.MomentumPlot($('momentumCanvas'),$('plotTooltip'),$('momentumHairlines'));
  for(const [label,names] of P.PALETTE_GROUPS){
    const group=document.createElement('optgroup');group.label=translate(label);group.dataset.paletteGroup=label;
    for(const name of names){const option=document.createElement('option');option.value=name;option.textContent=P.paletteLabel(name);option.setAttribute('data-no-i18n','');group.append(option);}
    $('colorScale').append(group);
  }
  function syncPlotControls(){
    $('plotRotate').hidden=plot.config?.dimension!==3;
    for(const button of $('plotModebar').querySelectorAll('button')){button.disabled=!result;if(button.dataset.dragMode)button.setAttribute('aria-pressed',String(button.dataset.dragMode===plot.dragMode));}
    for(const group of $('colorScale').querySelectorAll('optgroup'))group.label=translate(group.dataset.paletteGroup);
  }
  let result=null,zone=null,cell=null,latticeKey='',frame=0;
  function write(config){for(const id of keys){if(vectorKeys.includes(id)){const values=A.vector(config[id]);componentFields(id).forEach((field,i)=>{field.value=values[i];});continue;}const field=$(id);if(field.type==='checkbox')field.checked=config[id];else field.value=config[id];}}
  function read(){const config={scanMode:'deflector'};for(const id of keys){if(vectorKeys.includes(id)){config[id]=componentFields(id).map(field=>field.value.trim()===''?NaN:Number(field.value)).join(', ');continue;}const field=$(id);config[id]=field.type==='checkbox'?field.checked:(field.type==='number'||id==='dimension'?field.value===''?NaN:Number(field.value):field.value);}return config;}
  function constraints(){
    const dim=Number($('dimension').value),system=$('system').value,bravais=$('bravais').value;
    for(const id of ['topView','sideView','sideYView'])$(id).hidden=dim!==3;
    $('backgroundToggle').setAttribute('aria-pressed',String($('whiteBackground').checked));
    $('zoneLegend').hidden=!$('showBZ').checked;
    $('allZones').disabled=!$('showBZ').checked;
    $('bravaisField').hidden=dim===3;$('crystalFields').hidden=dim===2;
    const allowed=A.CENTERINGS[system];for(const option of $('centering').options)option.disabled=!allowed.includes(option.value);
    if(!allowed.includes($('centering').value))$('centering').value=allowed[0];
    const fixed={};
    if(dim===2){fixed.alpha=fixed.beta=90;if(['square','hexagonal'].includes(bravais))fixed.b=$('a').value;if(bravais!=='oblique')fixed.gamma=bravais==='hexagonal'?120:90;}
    else if(system==='orthogonal')fixed.alpha=fixed.beta=fixed.gamma=90;
    else if(system==='hexagonal'){fixed.b=$('a').value;fixed.alpha=fixed.beta=90;fixed.gamma=120;}
    else if(system==='rhombohedral'){fixed.b=fixed.c=$('a').value;fixed.beta=fixed.gamma=$('alpha').value;}
    else if(system==='monoclinic')fixed.alpha=fixed.gamma=90;
    for(const id of ['b','c','alpha','beta','gamma']){$(id).disabled=Object.hasOwn(fixed,id);if($(id).disabled)$(id).value=fixed[id];$(id).parentElement.hidden=dim===2&&['alpha','beta'].includes(id);}
    $('latticeHelp').textContent=translate(dim===2?'2D uses the crystal xy plane. c sets the π/c reference for kz; it does not change the 2D lattice.':system==='orthogonal'?'Orthogonal: a, b, c are independent; all angles are 90°. Equal lengths include cubic and tetragonal metrics.':system==='rhombohedral'?'Rhombohedral axes: a = b = c and α = β = γ. These axes already define a primitive cell.':system==='hexagonal'?'Hexagonal axes: a = b, γ = 120°. R uses the obverse setting with three lattice points.':'Symmetry fixes the disabled parameters. Monoclinic cells use unique axis b.');
    $('scanHelp').textContent=translate('Angles advance from Start by Step without exceeding End. End is included only when reached by the step. Start = end gives a single cut. Maximum 121 points per angle.');
    for(const id of ranges)if(Number.isFinite($(id).valueAsNumber))$(id+'Range').value=$(id).value;
  }
  function drawCell(){
    $('cellDiagram').innerHTML=P.cellSvg(cell.conventional,cell.primitive,cell.centering,cell.dimension);
    const multiplicity=Math.round(cell.conventionalMeasure/cell.primitiveMeasure),measure=cell.dimension===2?'Å²':'Å³';
    $('cellBadge').textContent=`${cell.dimension}D · ${cell.centering}`;
    $('cellSummary').textContent=translate('Lattice points per conventional cell:')+` ${multiplicity} · `+translate('Primitive / conventional:')+` 1/${multiplicity}. `+translate(cell.dimension===2?'Primitive area:':'Primitive volume:')+` ${P.format(cell.primitiveMeasure)} ${measure}.`;
    $('primitiveVectors').textContent=cell.primitive.map((p,i)=>`p${i+1} = (${p.map(P.format).join(', ')}) Å`).join('\n');
    $('cellSettingNote').textContent=translate(cell.dimension===3&&$('system').value==='rhombohedral'?'The diagram shows the equivalent R-centered hexagonal conventional cell around the entered rhombohedral primitive axes.':'Mint edges show one choice of primitive vectors; dashed edges show the conventional cell. Points are lattice sites, not an atomic basis.');
    $('centeringGuide').replaceChildren();
    const descriptions={P:'Primitive · 1 point',C:'Base-centered · 2 points',I:'Body-centered · 2 points',F:'Face-centered · 4 points',R:'R / hexagonal axes · 3 points'};
    for(const center of ['P','C','I','F','R']){
      const conventional=center==='R'?[[1,0,0],[-.5,Math.sqrt(3)/2,0],[0,0,1.6]]:[[1,0,0],[0,1,0],[0,0,1]],primitive=A.TRANSFORMS[center].map(v=>A.combine(conventional,v));
      const card=document.createElement('div');card.className='centering-card'+(center===cell.centering?' selected':'');
      const title=document.createElement('strong');title.textContent=center;
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 500 300');svg.setAttribute('role','img');svg.setAttribute('aria-label',translate(descriptions[center]));svg.innerHTML=P.cellSvg(conventional,primitive,center,3,true);
      const caption=document.createElement('span');caption.textContent=translate(descriptions[center]);card.append(title,svg,caption);$('centeringGuide').append(card);
    }
  }
  function render(){
    frame=0;constraints();const config=read();
    try{
      if(vectorKeys.some(id=>componentFields(id).some(field=>field.value.trim()===''||!Number.isFinite(Number(field.value)))))throw Error('Enter a finite number for each vector component.');
      for(const field of keys.flatMap(id=>vectorKeys.includes(id)?componentFields(id):[$(id)]))if(!field.disabled&&field.type==='number'&&!field.checkValidity())throw Error('Check the numeric input limits.');
      const nextKey=JSON.stringify(['dimension','bravais','system','centering','a','b','c','alpha','beta','gamma'].map(id=>config[id]));
      if(nextKey!==latticeKey){const nextCell=A.lattice(config),nextZone=A.brillouinZone(nextCell.reciprocal);cell=nextCell;zone=nextZone;latticeKey=nextKey;}
      result=A.simulate(config,cell);plot.update(result,zone,config);
      $('plannerError').hidden=true;$('kineticEnergy').textContent=P.format(config.photonEnergy-config.workFunction);
      $('plotSummary').textContent=`${result.points.length.toLocaleString()} ${translate('points')} · ${translate(config.fold?'First Brillouin zone':'Extended momentum')} · ${config.dimension}D`;
      drawCell();
      ArpesAnalysisUI.render(config,cell);
      try{localStorage.setItem(key,JSON.stringify(config));}catch{$('storageStatus').hidden=false;$('storageStatus').textContent=translate('Browser storage is unavailable; changes work for this session.');}
    }catch(error){
      result=null;plot.clear();ArpesAnalysisUI.clear();$('plannerError').textContent=translate(error.message);$('plannerError').hidden=false;$('kineticEnergy').textContent='—';$('plotSummary').textContent=translate('No valid simulation');
      $('cellDiagram').replaceChildren();$('primitiveVectors').textContent='';$('cellSummary').textContent=translate('Enter valid settings to display the unit cell.');$('cellBadge').textContent='—';$('cellSettingNote').textContent='';$('centeringGuide').replaceChildren();
      for(const id of ['colorMinimum','colorMaximum','colorLabel'])$(id).textContent='';$('colorGradient').style.background='none';
    }
    syncPlotControls();
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(render);};
  let initial={...A.DEFAULTS};
  try{const raw=localStorage.getItem(key);if(raw){const stored=JSON.parse(raw);if(!stored||typeof stored!=='object')throw Error('Invalid saved state');for(const id of keys)if(typeof stored[id]===typeof initial[id])initial[id]=stored[id];for(const axis of ['slit','scan'])if(stored[axis+'Step']===undefined&&stored[axis+'Count']!==undefined){
      const count=stored[axis+'Count'];if(!Number.isInteger(count)||count<1||count>121)throw Error('Invalid saved count');
      const width=initial[axis+'End']-initial[axis+'Start'];if(width!==0&&count===1)throw Error('Invalid saved count');
      initial[axis+'Step']=width===0?1:width/(count-1);
    }A.simulate(initial);if(!['angstrom','pi'].includes(initial.units)||!Object.hasOwn(P.PALETTES,initial.colorScale)||!['slit','scan','kz'].includes(initial.colorBy))throw Error('Invalid saved view');}}
  catch{initial={...A.DEFAULTS};$('storageStatus').hidden=false;$('storageStatus').textContent=translate('Saved settings could not be loaded. Defaults are shown.');}
  write(initial);render();
  // Match natural content heights while keeping collapsed panels independent.
  const panelPairs=[[$('scanPanel'),$('cellPanel')],[$('kzPanel'),$('sbzPanel')]],wideLayout=matchMedia('(min-width:1001px)'),naturalHeights=new Map();
  const panelBody=panel=>panel.querySelector('.paired-panel-content, .analysis-body');
  function alignPanels(){
    for(const pair of panelPairs){
      for(const panel of pair)if(panel.open)naturalHeights.set(panel,panel.querySelector('summary').getBoundingClientRect().height+panelBody(panel).getBoundingClientRect().height+2);
      const height=Math.max(0,...pair.map(panel=>naturalHeights.get(panel)||0));
      for(const panel of pair)panel.style.minHeight=wideLayout.matches&&panel.open?`${height}px`:'';
    }
  }
  const panelObserver=new ResizeObserver(alignPanels);
  for(const panel of panelPairs.flat()){panelObserver.observe(panelBody(panel));panelObserver.observe(panel.querySelector('summary'));panel.addEventListener('toggle',alignPanels);}
  wideLayout.addEventListener('change',alignPanels);alignPanels();
  for(const id of keys)$(id).addEventListener('input',()=>{
    if(id==='system'){
      const system=$('system').value;if(system==='rhombohedral')$('alpha').value=75;
      if(system==='monoclinic')$('beta').value=105;
      if(system==='triclinic'){$('alpha').value=80;$('beta').value=95;$('gamma').value=105;}
    }
    if(id==='bravais'&&$('bravais').value==='oblique')$('gamma').value=75;
    schedule();
  });
  for(const id of ranges)$(id+'Range').addEventListener('input',()=>{$(id).value=$(id+'Range').value;schedule();});
  $('topView').addEventListener('click',()=>plot.setView('top'));
  $('sideView').addEventListener('click',()=>plot.setView('side'));
  $('sideYView').addEventListener('click',()=>plot.setView('sideY'));
  $('backgroundToggle').addEventListener('click',()=>{$('whiteBackground').checked=!$('whiteBackground').checked;schedule();});
  $('plotReset').addEventListener('click',()=>plot.reset());
  $('plotZoomIn').addEventListener('click',()=>plot.zoomBy(1.25));
  $('plotZoomOut').addEventListener('click',()=>plot.zoomBy(.8));
  for(const button of $('plotModebar').querySelectorAll('[data-drag-mode]'))button.addEventListener('click',()=>{plot.setDragMode(button.dataset.dragMode);syncPlotControls();});
  $('plotDownload').addEventListener('click',()=>plot.downloadPng());
  $('resetArpes').addEventListener('click',()=>{write(A.DEFAULTS);for(const panel of document.querySelectorAll('.planner-column > details'))panel.open=true;ArpesAnalysisUI.resetEnergyView(true);$('energyStart').value=5;$('energyEnd').value=150;plot.reset(false);$('storageStatus').hidden=true;render();});
  for(const id of ['energyStart','energyEnd'])$(id).addEventListener('input',()=>{if(result)ArpesAnalysisUI.render(read(),cell);});
  window.addEventListener('languagechange',schedule);
  window.ArpesWorkspace={getResult:()=>result,getZone:()=>zone,getConfig:read,getView:()=>({zoom:plot.zoom,azimuth:plot.azimuth,panX:plot.panX,panY:plot.panY,elevation:plot.elevation,dragMode:plot.dragMode,centers:plot.centers,scales:plot.scales})};
}());
