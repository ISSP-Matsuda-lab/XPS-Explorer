const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=fs.realpathSync(path.dirname(__dirname)),artifacts=path.join(root,'.browser-qa');
fs.mkdirSync(artifacts,{recursive:true});assert.equal(fs.realpathSync(artifacts),artifacts);
process.env.TEMP=artifacts;process.env.TMP=artifacts;
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!/^\/(index\.html|escape-depth\.html|effective-depth\.html|arpes-cut-planner\.html|assets\/[\w./-]+)$/.test(pathname)){res.writeHead(404);return res.end();}
  const file=path.resolve(root,'.'+pathname),type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'}[path.extname(file)];
  if(!type||!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.realpathSync(file)!==file){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',type);res.end(fs.readFileSync(file));
});
let browser;
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({...(process.env.XPS_BROWSER_EXE?{executablePath:process.env.XPS_BROWSER_EXE}:{channel:'msedge'}),headless:true,downloadsPath:artifacts,artifactsDir:artifacts});
  const page=await browser.newPage({viewport:{width:1480,height:1080}}),exceptions=[];page.on('pageerror',error=>exceptions.push(error.message));
  const flush=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const fill=async(id,value)=>{await page.locator('#'+id).fill(String(value));await flush();};
  const select=async(id,value)=>{await page.locator('#'+id).selectOption(String(value));await flush();};
  const valid=async()=>assert.equal(await page.locator('#plannerError').isVisible(),false,await page.locator('#plannerError').textContent());
  const canvasImage=()=>page.locator('#momentumCanvas').evaluate(canvas=>canvas.toDataURL());
  const equalPanelHeights=async()=>{for(const pair of [['scanPanel','cellPanel'],['kzPanel','sbzPanel']]){const a=await page.locator('#'+pair[0]).boundingBox(),b=await page.locator('#'+pair[1]).boundingBox();assert(Math.abs(a.height-b.height)<1,`${pair} heights: ${a.height}, ${b.height}`);}};
  await page.goto(url+'/index.html');await page.locator('.site-menu-toggle').click();await page.locator('.app-menu a[href="arpes-cut-planner.html"]').click();await flush();
  assert.equal(await page.title(),'ARPES Cut Planner — Surface Analysis Toolkit');await valid();
  assert.equal(await page.locator('.app-menu a[aria-current="page"]').textContent(),'ARPES Cut Planner');assert.equal(await page.locator('.depth-view-switch').count(),0);
  assert.equal(await page.locator('canvas').count(),1);assert.equal(await page.evaluate(()=>ArpesWorkspace.getResult().points.length),961);
  assert.equal(await page.locator('#colorScale').inputValue(),'rainbow');assert.equal(await page.locator('#colorBy').inputValue(),'scan');
  for(const [id,values] of [['normal',['0','0','1']],['slitDirection',['1','0','0']]]){
    assert.equal(await page.locator('#'+id+' input[type=text]').count(),3);
    assert.deepEqual(await page.locator('#'+id+' input').evaluateAll(inputs=>inputs.map(input=>input.value)),values);
    const components=await page.locator('#'+id+' input').evaluateAll(inputs=>inputs.map(input=>({x:input.getBoundingClientRect().x,y:input.getBoundingClientRect().y})));
    assert(components.every(p=>Math.abs(p.y-components[0].y)<1));assert(components[0].x<components[1].x&&components[1].x<components[2].x);
  }
  const normalBox=await page.locator('#normal').boundingBox(),slitBox=await page.locator('#slitDirection').boundingBox();
  assert(Math.abs(normalBox.y-slitBox.y)<1);assert(slitBox.x>=normalBox.x+normalBox.width);
  assert.equal(await page.locator('#resetView').count(),0);
  assert.equal(await page.locator('#momentumCanvas').evaluate(canvas=>getComputedStyle(canvas).cursor),'default');
  const graph=await page.locator('.momentum-panel').boundingBox(),configuration=await page.locator('.configuration-panel').boundingBox();assert(configuration.x>graph.x+graph.width);assert(Math.abs(configuration.y-graph.y)<2);
  const scanBox=await page.locator('.scan-panel').boundingBox(),cellBox=await page.locator('.cell-panel').boundingBox();assert(cellBox.x>scanBox.x+scanBox.width);assert(Math.abs(scanBox.y-cellBox.y)<2);
  await equalPanelHeights();
  assert.equal(await page.locator('#innerPotential').inputValue(),'15');
  for(const id of ['slitStart','scanStart'])assert.equal(await page.locator('#'+id).inputValue(),'-15');
  for(const id of ['slitEnd','scanEnd'])assert.equal(await page.locator('#'+id).inputValue(),'15');
  for(const id of ['slitCount','scanCount'])assert.equal(await page.locator('#'+id).inputValue(),'31');
  assert.equal(await page.locator('#topView').isVisible(),false);
  assert.equal(await page.locator('.configuration-panel #dimension').count(),1);
  const offsetBoxes=await Promise.all(['offsetSlit','offsetPerpendicular','azimuth'].map(id=>page.locator('#'+id).boundingBox()));assert(offsetBoxes.every(b=>Math.abs(b.y-offsetBoxes[0].y)<2));
  const kzBox=await page.locator('.kz-panel').boundingBox(),sbzBox=await page.locator('.sbz-panel').boundingBox();assert(kzBox.y>=scanBox.y+scanBox.height);assert(sbzBox.y>=cellBox.y+cellBox.height);assert(Math.abs(kzBox.x-scanBox.x)<2);assert(Math.abs(sbzBox.x-cellBox.x)<2);
  assert.equal(await page.locator('#kzPlot polyline').count(),1);assert.equal(await page.locator('#sbzPlot circle[role="button"]').count(),2);assert.equal(await page.locator('#sbzError').isVisible(),false);
  assert.equal(await page.locator('#sbzPanel table, #sbzSummary, #sbzPanel .planner-note, #sbzAttribution').count(),0);
  assert.equal(await page.locator('a[href="https://pesto.readthedocs.io/en/latest/pesto_core.html#sbz"]').count(),1);
  assert.equal(await page.locator('.footer-detail a[href="https://pesto.readthedocs.io/en/latest/pesto_core.html#sbz"]').textContent(),'blochpesto · SBZ');
  assert.equal(await page.locator('.footer-disclosure').getAttribute('open'),null);
  await page.locator('.footer-disclosure > summary').click();
  await page.locator('#momentumCanvas').scrollIntoViewIfNeeded();
  const modebar=await page.locator('#plotModebar').boundingBox(),canvasBounds=await page.locator('#momentumCanvas').boundingBox(),legend=await page.locator('.color-legend').boundingBox(),background=await page.locator('#backgroundToggle').boundingBox();
  assert(modebar.x>=legend.x+legend.width&&modebar.x+modebar.width<=background.x);
  assert(modebar.y>=canvasBounds.y+canvasBounds.height);assert(Math.abs((modebar.y+modebar.height/2)-(background.y+background.height/2))<1);
  assert.equal(await page.locator('#plotRotate').isVisible(),false);
  assert.equal(await page.locator('#plotPan').getAttribute('aria-pressed'),'true');
  await page.locator('#plotZoomIn').click();assert.equal(await page.evaluate(()=>ArpesWorkspace.getView().zoom),1.25);
  await page.locator('#plotZoomOut').click();assert.equal(await page.evaluate(()=>ArpesWorkspace.getView().zoom),1);
  await page.locator('#plotZoom').click();assert.equal(await page.locator('#plotZoom').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#momentumCanvas').evaluate(canvas=>getComputedStyle(canvas).cursor),'default');
  await page.mouse.move(canvasBounds.x+canvasBounds.width/2,canvasBounds.y+canvasBounds.height/2);await page.mouse.down();await page.mouse.move(canvasBounds.x+canvasBounds.width/2,canvasBounds.y+canvasBounds.height/2-40,{steps:5});await page.mouse.up();
  assert((await page.evaluate(()=>ArpesWorkspace.getView().zoom))>1);
  await page.locator('#plotReset').click();await page.locator('#plotPan').click();assert.equal(await page.evaluate(()=>ArpesWorkspace.getView().zoom),1);
  assert.equal(await page.locator('.footer-detail').count(),6);
  assert.equal(await page.locator('#modelTitle').isVisible(),true);
  await page.locator('.footer-disclosure > summary').click();
  assert((await page.locator('#sbzRelations').textContent()).includes('cos(30°)'));
  // Each stack collapses independently and brings its following panel upward.
  const position=selector=>page.locator(selector).evaluate(e=>e.getBoundingClientRect().top+window.scrollY);
  const sbzBefore=await position('.sbz-panel'),kzBefore=await position('.kz-panel');
  await page.locator('#cellPanel > summary').click();await flush();assert((await position('.sbz-panel'))<sbzBefore-100);assert.equal(await position('.kz-panel'),kzBefore);
  await page.locator('#scanPanel > summary').click();await flush();assert((await position('.kz-panel'))<kzBefore-100);
  await page.locator('#kzPanel > summary').click();assert((await page.locator('#kzPanel').boundingBox()).height<80);
  for(const id of ['scanPanel','cellPanel','kzPanel'])await page.locator('#'+id+' > summary').click();
  await flush();await equalPanelHeights();
  await page.locator('#kzPlot').scrollIntoViewIfNeeded();
  const kzSvg=await page.locator('#kzPlot').boundingBox(),kx=x=>kzSvg.x+x/600*kzSvg.width,ky=y=>kzSvg.y+y/330*kzSvg.height;
  const fullEnergyView=await page.evaluate(()=>ArpesAnalysisUI.getEnergyView());
  const configuredEnergy=await page.locator('#kzReadout').textContent();
  assert(configuredEnergy.includes('21.2 eV'));assert.equal(await page.locator('#kzCursorReadout').textContent(),configuredEnergy);
  await page.mouse.move(kx(200),ky(100));assert.equal(await page.locator('#kzCrosshair').getAttribute('visibility'),'visible');
  assert.equal(await page.locator('#kzCursorReadout').textContent(),configuredEnergy,'Hover must not move the probe');
  await fill('probeEnergy',60);
  assert.equal(await page.locator('#kzReadout').textContent(),configuredEnergy);
  assert((await page.locator('#kzCursorReadout').textContent()).includes('60 eV'));
  const probeKz=await page.evaluate(()=>ArpesPlot.format(ArpesAnalysis.normalKz(ArpesWorkspace.getConfig(),60)));
  assert((await page.locator('#kzCursorReadout').textContent()).includes('kz = '+probeKz));
  const probeBox=await page.locator('#kzProbe .probe-dot').boundingBox();
  await page.mouse.move(probeBox.x+probeBox.width/2,probeBox.y+probeBox.height/2);await page.mouse.down();await page.mouse.move(kx(65+(80-5)/145*510),ky(70),{steps:8});await page.mouse.up();
  assert(Math.abs(Number(await page.locator('#probeEnergy').inputValue())-80)<.02);
  const persistentProbe=await page.locator('#kzCursorReadout').textContent();
  await page.locator('#kzPanel').screenshot({path:path.join(artifacts,'arpes-energy-dual-readouts.png')});
  await page.mouse.move(kx(20),ky(10));assert.equal(await page.locator('#kzCursorReadout').textContent(),persistentProbe);assert.equal(await page.locator('#kzReadout').textContent(),configuredEnergy);
  for(const invalid of ['',3,200]){await fill('probeEnergy',invalid);assert.equal(await page.locator('#probeError').isVisible(),true);assert.equal(await page.locator('#kzCursorReadout').textContent(),persistentProbe);}
  await fill('probeEnergy',80);assert.equal(await page.locator('#probeError').isVisible(),false);
  await page.locator('#kzProbe').focus();await page.keyboard.press('ArrowRight');assert(Number(await page.locator('#probeEnergy').inputValue())>80);await fill('probeEnergy',80);
  await page.mouse.move(kx(200),ky(100));
  await page.mouse.down();await page.mouse.move(kx(430),ky(230),{steps:8});await page.mouse.up();
  const zoomedEnergyView=await page.evaluate(()=>ArpesAnalysisUI.getEnergyView());assert(zoomedEnergyView.start>fullEnergyView.start);assert(zoomedEnergyView.end<fullEnergyView.end);assert(zoomedEnergyView.ymin>fullEnergyView.ymin);assert(zoomedEnergyView.ymax<fullEnergyView.ymax);
  await page.locator('#kzAutoscale').click();assert.deepEqual(await page.evaluate(()=>ArpesAnalysisUI.getEnergyView()),fullEnergyView);assert.equal(await page.locator('#probeEnergy').inputValue(),'80');
  await page.locator('#sbzPlot circle[role="button"]').first().click();assert.notEqual(await page.locator('#sbzPlot line[stroke="#ffb45d"]').getAttribute('y2'),'165');
  await fill('energyEnd',3);assert.equal(await page.locator('#kzError').isVisible(),true);await valid();await fill('energyEnd',150);assert.equal(await page.locator('#kzError').isVisible(),false);
  await fill('photonEnergy',4.6);assert((await page.locator('#sbzRelations').textContent()).includes('Unreachable'));await fill('photonEnergy',21.2);
  await page.screenshot({path:path.join(artifacts,'arpes-2d.png'),fullPage:true});
  const original=await canvasImage();await page.locator('#showBZ').uncheck();await flush();assert.notEqual(await canvasImage(),original);await page.locator('#showBZ').check();
  await page.locator('#backgroundToggle').click();await flush();assert.equal(await page.locator('#backgroundToggle').getAttribute('aria-pressed'),'true');
  assert.deepEqual(await page.locator('#momentumCanvas').evaluate(c=>Array.from(c.getContext('2d').getImageData(2,2,1,1).data)),[255,255,255,255]);
  for(const white of [true,false]){
    assert(await page.evaluate(white=>ArpesPlot.zoneColor([0,0,0],white)!==ArpesPlot.zoneColor([0,0,1],white),white));
    assert(await page.evaluate(white=>ArpesPlot.zoneColor([0,0,0],white)===ArpesPlot.zoneColor([0,0,1],white,[0,0,1]),white));
  }
  await page.screenshot({path:path.join(artifacts,'arpes-white.png'),fullPage:true});
  await page.locator('#backgroundToggle').click();await flush();
  const palettes=await page.locator('#colorScale option').evaluateAll(options=>options.map(option=>option.value));
  assert.equal(palettes.length,48);assert.equal(new Set(palettes).size,48);
  for(const palette of palettes){await select('colorScale',palette);await valid();assert((await page.locator('#colorGradient').getAttribute('style')).includes('linear-gradient'));}
  await select('colorScale','viridis');
  await select('units','pi');assert.equal(await page.evaluate(()=>ArpesWorkspace.getConfig().units),'pi');assert.notEqual(await canvasImage(),original);
  await select('bravais','rectangular');await fill('b',7);
  const scale2d=await page.evaluate(()=>ArpesWorkspace.getView().scales);assert.deepEqual(scale2d.units,['π/a','π/b','π/c']);assert.equal(scale2d.factors[1],7/Math.PI);
  await select('bravais','hexagonal');
  await select('colorBy','kz');
  assert((await page.locator('#colorLabel').textContent()).includes('π/c'));assert((await page.locator('#kzReadout').textContent()).includes('π/c'));
  const normalized=await page.evaluate(()=>{const c=ArpesWorkspace.getConfig(),result=ArpesWorkspace.getResult();return {kz:ArpesAnalysis.normalKz(c,c.photonEnergy)*c.c/Math.PI,max:Math.max(...result.points.map(p=>p.absolute[2]))*c.c/Math.PI};});
  assert((await page.locator('#kzReadout').textContent()).includes(Number(normalized.kz.toPrecision(4)).toString()));
  assert(Math.abs(Number(await page.locator('#colorMaximum').textContent())-normalized.max)<0.001);
  await select('colorScale','magma');assert((await page.locator('#colorGradient').getAttribute('style')).includes('linear-gradient'));
  const colors=await canvasImage();await select('colorBy','scan');assert.notEqual(await canvasImage(),colors);
  await page.locator('#slitStartRange').fill('-35.5');await flush();assert.equal(await page.locator('#slitStart').inputValue(),'-35.5');
  await fill('scanEnd',31.2);assert.equal(await page.locator('#scanEndRange').inputValue(),'31.2');
  for(const bravais of ['square','rectangular','centered','hexagonal','oblique']){await select('bravais',bravais);await valid();assert.equal(await page.evaluate(()=>ArpesWorkspace.getResult().cell.dimension),2);}
  assert.equal(await page.locator('#scanMode').count(),0);assert.equal(await page.locator('.scan-axis h2').first().textContent(),'Deflector angle');
  await fill('photonEnergy',100);await page.locator('#fold').check();await flush();await valid();
  assert(await page.evaluate(()=>ArpesWorkspace.getResult().points.some(p=>Math.hypot(...p.absolute.slice(0,2))>Math.hypot(...p.displayed)+.1)));
  const box=await page.locator('#momentumCanvas').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-250);await flush();assert((await page.evaluate(()=>ArpesWorkspace.getView().zoom))>1);
  await page.locator('#momentumCanvas').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>ArpesWorkspace.getView().panX),20);await page.locator('#plotReset').click();assert.equal(await page.evaluate(()=>ArpesWorkspace.getView().zoom),1);
  await select('dimension',3);await valid();assert.equal(await page.locator('#crystalFields').isVisible(),true);assert.equal(await page.locator('#bravaisField').isVisible(),false);
  assert.equal(await page.locator('#plotRotate').isVisible(),true);assert.equal(await page.locator('#plotRotate').getAttribute('aria-pressed'),'true');
  const rearPlanes=await page.evaluate(()=>{
    const results=[],minimum=[-1,-2,-3],maximum=[4,5,6];
    for(const azimuth of [-3,-1,1,3].map(n=>n*Math.PI/4))for(const elevation of [-Math.PI/6,Math.PI/6]){
      const {eye}=ArpesPlot.cameraFrame(azimuth,elevation),panes=ArpesPlot.backPanes(minimum,maximum,eye);
      results.push(panes.length===3&&new Set(panes.map(p=>p.axis)).size===3&&panes.every(pane=>{
        const midpoint=pane.vertices.reduce((sum,p)=>sum.map((v,i)=>v+p[i]/4),[0,0,0]);
        // A ray from a rear face toward the viewer must enter the box, not leave it.
        return midpoint.map((v,i)=>v+eye[i]*.001).every((v,i)=>v>minimum[i]&&v<maximum[i]);
      }));
    }
    const view=ArpesWorkspace.getView(),eye=ArpesPlot.cameraFrame(view.azimuth,view.elevation).eye;
    return {results,eye};
  });
  assert(rearPlanes.results.every(Boolean));rearPlanes.eye.forEach(value=>assert(Math.abs(value-1/Math.sqrt(3))<1e-10));
  await page.locator('#plotPan').click();
  const pan3dBox=await page.locator('#momentumCanvas').boundingBox(),beforePan=await page.evaluate(()=>ArpesWorkspace.getView());
  await page.mouse.move(pan3dBox.x+pan3dBox.width/2,pan3dBox.y+pan3dBox.height/2);await page.mouse.down();await page.mouse.move(pan3dBox.x+pan3dBox.width/2+35,pan3dBox.y+pan3dBox.height/2+20,{steps:5});await page.mouse.up();
  const afterPan=await page.evaluate(()=>ArpesWorkspace.getView());assert.equal(afterPan.azimuth,beforePan.azimuth);assert.equal(afterPan.elevation,beforePan.elevation);assert(Math.abs(afterPan.panX-35)<1);assert(Math.abs(afterPan.panY-20)<1);
  await page.locator('#plotReset').click();await page.locator('#plotRotate').click();
  await equalPanelHeights();
  const latticeBoxes=await Promise.all(['dimension','system','centering'].map(id=>page.locator('#'+id).boundingBox()));assert(latticeBoxes.every(b=>Math.abs(b.y-latticeBoxes[0].y)<2));
  const scale3d=await page.evaluate(()=>ArpesWorkspace.getView().scales);assert.equal(scale3d.units[2],'π/c');assert.equal(scale3d.factors[2],6/Math.PI);
  await page.locator('#fold').uncheck();await flush();assert((await page.evaluate(()=>ArpesWorkspace.getView().centers[0][2]))>0);
  const referenceCenter=await page.evaluate(()=>ArpesWorkspace.getView().centers[0]);
  assert.equal(await page.locator('#firstZoneLabel').textContent(),'Brillouin zone');assert.equal(await page.locator('#otherZoneLegend').isVisible(),false);
  await page.locator('#allZones').check();await flush();await valid();assert((await page.evaluate(()=>ArpesWorkspace.getView().centers.length))>1);
  assert.deepEqual(await page.evaluate(()=>ArpesWorkspace.getView().centers[0]),referenceCenter);
  assert.equal(await page.locator('#firstZoneLabel').textContent(),'Brillouin zone');assert.equal(await page.locator('#otherZoneLegend').isVisible(),true);
  // Inspect actual canvas drawing: extra boundaries must precede the green reference,
  // and opaque axis panes must be behind both the boundaries and measured points.
  for(const white of [false,true]){
    if(white){await page.locator('#backgroundToggle').click();await flush();}
    const drawing=await page.evaluate(()=>{
      const config=ArpesWorkspace.getConfig(),data=ArpesWorkspace.getResult(),zone=ArpesWorkspace.getZone();
      const bounds=document.getElementById('momentumCanvas').getBoundingClientRect(),canvas=document.createElement('canvas'),host=document.createElement('div');
      host.append(canvas);canvas.getBoundingClientRect=()=>bounds;
      const ctx=canvas.getContext('2d'),events=[],stroke=ctx.stroke,fill=ctx.fill,arc=ctx.arc;
      ctx.stroke=function(){events.push({type:'stroke',color:this.strokeStyle});return stroke.apply(this,arguments);};
      ctx.fill=function(){events.push({type:'fill',color:this.fillStyle});return fill.apply(this,arguments);};
      ctx.arc=function(){events.push({type:'point'});return arc.apply(this,arguments);};
      const plot=new ArpesPlot.MomentumPlot(canvas,document.getElementById('plotTooltip'));
      try{plot.update(data,zone,config);}finally{ctx.stroke=stroke;ctx.fill=fill;ctx.arc=arc;plot.observer.disconnect();}
      const primary=Arpes.zoneCenters(data)[0];
      return {events:events.slice(0,events.findIndex(e=>e.type==='point')),green:ArpesPlot.zoneColor(primary,config.whiteBackground,primary),purple:ArpesPlot.zoneColor(Arpes.add(primary,[0,0,1]),config.whiteBackground,primary),edges:zone.edges.length};
    });
    const boundaries=drawing.events.filter(e=>e.type==='stroke'&&[drawing.green,drawing.purple].includes(e.color));
    assert(boundaries.some(e=>e.color===drawing.purple));
    assert.equal(boundaries.filter(e=>e.color===drawing.green).length,drawing.edges);
    assert(boundaries.slice(-drawing.edges).every(e=>e.color===drawing.green));
    const firstBoundary=drawing.events.findIndex(e=>e.type==='stroke'&&[drawing.green,drawing.purple].includes(e.color));
    assert.equal(drawing.events.slice(0,firstBoundary).filter(e=>e.type==='fill').length,3);
    assert.equal(drawing.events.filter(e=>e.type==='stroke'&&e.color===(white?'#c6d2d7':'#29424a')).length,3);
    await page.locator('.momentum-panel').screenshot({path:path.join(artifacts,white?'arpes-panes-white.png':'arpes-panes-dark.png')});
  }
  // Pixel regressions: put a point on the same sightline as a cube edge, just
  // inside/outside the zone. Front edges must cover points; rear edges must not.
  const occlusion=await page.evaluate(()=>{
    const canvas=document.createElement('canvas'),host=document.createElement('div'),tooltip=document.createElement('div');host.append(canvas);
    canvas.getBoundingClientRect=()=>({width:640,height:480});
    const plot=new ArpesPlot.MomentumPlot(canvas,tooltip),ctx=canvas.getContext('2d'),results=[];
    const config={...Arpes.DEFAULTS,dimension:3,system:'orthogonal',centering:'P',a:Math.PI,b:Math.PI,c:Math.PI,colorScale:'autumn',colorBy:'scan',showBZ:true,allZones:false};
    const cell=Arpes.lattice(config),zone=Arpes.brillouinZone(cell.reciprocal),views=[];
    for(const azimuth of [-3,-1,1,3].map(n=>n*Math.PI/4))for(const elevation of [-1,1].map(n=>n*Math.atan(1/Math.sqrt(2))))views.push({azimuth,elevation});
    const pixel=screen=>{
      const dpr=window.devicePixelRatio||1;
      return [...ctx.getImageData(Math.floor(screen[0]*dpr),Math.floor(screen[1]*dpr),1,1).data].slice(0,3);
    };
    const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
    try{
      for(const whiteBackground of [false,true])for(const view of views)for(const front of [false,true])for(const outside of [false,true]){
        const {eye}=ArpesPlot.cameraFrame(view.azimuth,view.elevation);
        const edge=zone.edges.find(([a,b])=>{
          const direction=Arpes.sub(b,a),length=Arpes.norm(direction),facing=Arpes.dot(Arpes.scale(Arpes.add(a,b),.5),eye);
          return Math.abs(Arpes.dot(direction,eye))<length*.9&&(front?facing>.5:facing<-.5);
        });
        const midpoint=Arpes.scale(Arpes.add(...edge),.5),offset=(front?-1:1)*(outside?-1:1)*.08;
        const displayed=Arpes.add(midpoint,Arpes.scale(eye,offset));
        const makePoint=(p,scan=0)=>({displayed:p,absolute:p,slit:0,scan});
        // Symmetric anchors keep the reference at Γ.
        const points=[makePoint(displayed),makePoint(Arpes.scale(displayed,-1))];
        plot.update({cell,points},zone,{...config,whiteBackground});
        Object.assign(plot,view);plot.draw();
        const screen=plot.projection.project(displayed),actual=pixel(screen);
        // Compare with the real renderer's edge-only and point-only pixels,
        // including canvas antialiasing at exactly the same screen position.
        const fill=ctx.fill;ctx.fill=function(){if(this.fillStyle!=='#ff8000')return fill.apply(this,arguments);};
        try{plot.draw();}finally{ctx.fill=fill;}
        const edgeOnly=pixel(screen);
        ctx.fillStyle='rgb(255,128,0)';ctx.beginPath();ctx.arc(screen[0],screen[1],2.5,0,Math.PI*2);ctx.fill();const pointOnly=pixel(screen);
        const edgeInFront=front!==outside;
        results.push({whiteBackground,...view,front,outside,edgeInFront,actual,edgeOnly,pointOnly,pass:distance(actual,edgeInFront?edgeOnly:pointOnly)<35});
      }
    }finally{plot.observer.disconnect();}
    return results;
  });
  assert(occlusion.every(r=>r.pass),JSON.stringify(occlusion.filter(r=>!r.pass)));
  await page.locator('#backgroundToggle').click();await flush();
  await page.locator('#topView').click();assert.equal(await page.evaluate(()=>ArpesWorkspace.getView().elevation),Math.PI/2);
  const panBox=await page.locator('#momentumCanvas').boundingBox();await page.mouse.move(panBox.x+panBox.width/2,panBox.y+panBox.height/2);await page.mouse.down({button:'right'});await page.mouse.move(panBox.x+panBox.width/2+60,panBox.y+panBox.height/2+40,{steps:5});await page.mouse.up({button:'right'});
  const panned=await page.evaluate(()=>ArpesWorkspace.getView());assert(Math.abs(panned.panX-60)<1);assert(Math.abs(panned.panY-40)<1);assert.equal(panned.elevation,Math.PI/2);assert.equal(panned.azimuth,0);
  await page.locator('#sideView').click();assert.equal(await page.evaluate(()=>ArpesWorkspace.getView().elevation),0);
  await page.locator('#sideYView').click();assert.equal(await page.evaluate(()=>ArpesWorkspace.getView().azimuth),Math.PI/2);
  await page.locator('#plotReset').click();await page.screenshot({path:path.join(artifacts,'arpes-occupied-zones.png'),fullPage:true});
  await select('colorScale','aurora');
  await page.locator('.momentum-panel').screenshot({path:path.join(artifacts,'arpes-aurora-modebar.png')});
  const downloadPromise=page.waitForEvent('download');await page.locator('#plotDownload').click();const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),'arpes-momentum-map.png');
  const exported=path.join(artifacts,'arpes-momentum-map.png');await download.saveAs(exported);assert.equal(fs.realpathSync(exported),exported);
  const png=fs.readFileSync(exported);assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert(png.length>10000);
  await page.locator('#allZones').uncheck();await page.locator('#fold').check();await flush();
  for(const center of ['P','C','I','F']){await select('centering',center);await valid();assert.equal(await page.evaluate(()=>ArpesWorkspace.getResult().cell.centering),center);}
  for(const system of ['hexagonal','rhombohedral','monoclinic','triclinic','orthogonal']){await select('system',system);await valid();const state=await page.evaluate(()=>({config:ArpesWorkspace.getConfig(),allowed:Arpes.CENTERINGS[ArpesWorkspace.getConfig().system]}));assert(state.allowed.includes(state.config.centering));}
  await select('centering','F');await select('units','angstrom');await select('colorScale','viridis');await select('colorBy','slit');await fill('photonEnergy',40);await fill('b',3.8);await fill('c',3.8);
  const before=await page.evaluate(()=>ArpesWorkspace.getView().azimuth),b3=await page.locator('#momentumCanvas').boundingBox();await page.mouse.move(b3.x+b3.width/2,b3.y+b3.height/2);await page.mouse.down();await page.mouse.move(b3.x+b3.width/2+75,b3.y+b3.height/2+25,{steps:10});await page.mouse.up();assert.notEqual(await page.evaluate(()=>ArpesWorkspace.getView().azimuth),before);
  await page.locator('#plotReset').click();await page.screenshot({path:path.join(artifacts,'arpes-3d.png'),fullPage:true});
  await fill('normalZ',0);assert.equal(await page.locator('#plannerError').isVisible(),true);assert.equal(await page.evaluate(()=>ArpesWorkspace.getResult()),null);await fill('normalZ',1);await valid();
  await fill('slitDirectionX','');assert.equal(await page.locator('#plannerError').isVisible(),true);await fill('slitDirectionX',1);await valid();
  await fill('slitDirectionY',-.25);await valid();await fill('normalZ',2);await valid();
  await fill('photonEnergy',2);assert.equal(await page.locator('#plannerError').isVisible(),true);await fill('photonEnergy',40);await valid();
  await fill('slitStart',40);assert.equal(await page.locator('#plannerError').isVisible(),true);await fill('slitStart',-35.5);await valid();
  await select('colorScale','aurora');await page.reload();await flush();await valid();assert.equal(await page.locator('#photonEnergy').inputValue(),'40');assert.equal(await page.locator('#fold').isChecked(),true);assert.equal(await page.locator('#dimension').inputValue(),'3');assert.equal(await page.locator('#colorScale').inputValue(),'aurora');
  assert.equal(await page.locator('#slitDirectionY').inputValue(),'-0.25');assert.equal(await page.locator('#normalZ').inputValue(),'2');
  await page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('xps-toolkit.arpes.v1'));saved.normal='0,0,1';saved.slitDirection='1,0,0';localStorage.setItem('xps-toolkit.arpes.v1',JSON.stringify(saved));});await page.reload();await flush();await valid();
  assert.deepEqual(await page.locator('#normal input').evaluateAll(inputs=>inputs.map(input=>input.value)),['0','0','1']);
  assert.deepEqual(await page.locator('#slitDirection input').evaluateAll(inputs=>inputs.map(input=>input.value)),['1','0','0']);
  await page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('xps-toolkit.arpes.v1'));saved.scanMode='polar';localStorage.setItem('xps-toolkit.arpes.v1',JSON.stringify(saved));});await page.reload();await flush();await valid();assert.equal(await page.evaluate(()=>ArpesWorkspace.getConfig().scanMode),'deflector');assert.equal(await page.locator('#photonEnergy').inputValue(),'40');
  await page.locator('#languageToggle').click();await flush();assert.equal(await page.locator('html').getAttribute('lang'),'ja');assert.equal(await page.locator('#configurationTitle').textContent(),'測定・結晶設定');await valid();
  assert.equal(await page.locator('#sbzAttribution').count(),0);
  assert.equal(await page.locator('#plotDownload').getAttribute('aria-label'),'マップをPNGで保存');
  assert.equal(await page.locator('#colorScale optgroup').first().getAttribute('label'),'明るい色・パステル');
  assert.equal(await page.locator('.footer-title').textContent(),'公開情報');
  await page.locator('.footer-disclosure > summary').click();
  assert.equal(await page.locator('#referencesTitle').textContent(),'参考資料・謝辞');
  assert(await page.locator('.footer-detail p').evaluateAll(elements=>elements.every(element=>getComputedStyle(element).textAlign!=='justify')));
  await page.setViewportSize({width:1800,height:1100});await flush();
  const footerBoxes=await page.locator('.footer-detail').evaluateAll(elements=>elements.map(element=>{const r=element.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top};}));
  assert(footerBoxes.slice(1).every(box=>Math.abs(box.top-footerBoxes[1].top)<1));
  assert(Math.abs(footerBoxes[0].left-footerBoxes[1].left)<1);assert(Math.abs(footerBoxes[0].right-footerBoxes.at(-1).right)<1);
  await page.locator('.site-footer').screenshot({path:path.join(artifacts,'arpes-publication-ja.png')});
  await page.setViewportSize({width:1480,height:1080});await flush();
  await equalPanelHeights();
  await page.screenshot({path:path.join(artifacts,'arpes-ja.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await flush();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  for(const id of ['scanPanel','cellPanel','kzPanel','sbzPanel'])assert.equal(await page.locator('#'+id).evaluate(e=>e.style.minHeight),'');
  await page.screenshot({path:path.join(artifacts,'arpes-mobile.png'),fullPage:true});
  const mobileGraph=await page.locator('.momentum-panel').boundingBox(),mobileConfig=await page.locator('.configuration-panel').boundingBox();assert(mobileConfig.y>=mobileGraph.y+mobileGraph.height);
  await page.locator('#resetArpes').click();await flush();await valid();assert.equal(await page.locator('#photonEnergy').inputValue(),'21.2');assert.equal(await page.locator('html').getAttribute('lang'),'ja');
  assert.equal(await page.locator('#colorScale').inputValue(),'rainbow');assert.equal(await page.locator('#colorBy').inputValue(),'scan');
  await page.evaluate(()=>localStorage.setItem('xps-toolkit.arpes.v1','{broken'));await page.reload();await flush();await valid();assert.equal(await page.locator('#storageStatus').isVisible(),true);
  await page.setViewportSize({width:1480,height:1080});await page.locator('#languageToggle').click();await flush();
  await page.locator('#momentumCanvas').scrollIntoViewIfNeeded();
  const hoverBox=await page.locator('#momentumCanvas').boundingBox(),hoverX=hoverBox.x+hoverBox.width/2+13,hoverY=hoverBox.y+hoverBox.height/2-7.5;
  await page.mouse.move(hoverX,hoverY);assert.equal(await page.locator('#plotTooltip').isVisible(),true);
  assert.equal(await page.locator('#momentumHairlines').isVisible(),true);assert.equal(await page.locator('#momentumHairlines line').count(),2);
  const hairBefore=await page.locator('#momentumHairlines').innerHTML(),pointBefore=await page.locator('#momentumHairlines').getAttribute('data-point-index');
  await page.mouse.move(hoverX+.2,hoverY+.2);assert.equal(await page.locator('#momentumHairlines').innerHTML(),hairBefore);
  let snapped=false;for(const offset of [8,16,24,32,40]){await page.mouse.move(hoverX+offset,hoverY);const point=await page.locator('#momentumHairlines').getAttribute('data-point-index');if(point!==null&&point!==pointBefore){snapped=true;break;}}assert(snapped,'Hairlines must jump between measured points');
  await page.mouse.move(hoverX,hoverY);await page.locator('.momentum-panel').screenshot({path:path.join(artifacts,'arpes-hover-2d.png')});
  await page.mouse.move(hoverBox.x+5,hoverBox.y+5);assert.equal(await page.locator('#momentumHairlines').isVisible(),false);
  await select('dimension',3);await page.locator('#plotReset').click();await page.locator('#momentumCanvas').scrollIntoViewIfNeeded();
  const hover3d=await page.evaluate(()=>{
    const bounds=document.getElementById('momentumCanvas').getBoundingClientRect(),canvas=document.createElement('canvas'),host=document.createElement('div');host.append(canvas);canvas.getBoundingClientRect=()=>bounds;
    const plot=new ArpesPlot.MomentumPlot(canvas,document.createElement('output'));
    try{plot.update(ArpesWorkspace.getResult(),ArpesWorkspace.getZone(),ArpesWorkspace.getConfig());const target=plot.projected.find(p=>p.point.slit===0&&p.point.scan===0);return {x:bounds.x+target.screen[0],y:bounds.y+target.screen[1]};}finally{plot.observer.disconnect();}
  });
  await page.mouse.move(hover3d.x,hover3d.y);assert.equal(await page.locator('#momentumHairlines .hover-spike').count(),3);assert.equal(await page.locator('#momentumHairlines .hover-projection').count(),6);
  const selected=await page.locator('#momentumHairlines').evaluate(svg=>({index:Number(svg.getAttribute('data-point-index')),x:Number(svg.querySelector('circle').getAttribute('cx')),y:Number(svg.querySelector('circle').getAttribute('cy')),starts:[...svg.querySelectorAll('.hover-spike')].map(line=>[Number(line.getAttribute('x1')),Number(line.getAttribute('y1'))])}));
  assert(selected.starts.every(([x,y])=>x===selected.x&&y===selected.y));
  assert(await page.evaluate(index=>{const p=ArpesWorkspace.getResult().points[index];return document.getElementById('plotTooltip').textContent.includes('Slit angle: '+ArpesPlot.format(p.slit));},selected.index));
  await page.locator('.momentum-panel').screenshot({path:path.join(artifacts,'arpes-hover-3d.png')});
  await page.mouse.down();assert.equal(await page.locator('#momentumCanvas').evaluate(canvas=>getComputedStyle(canvas).cursor),'default');assert.equal(await page.locator('#momentumHairlines').isVisible(),false);await page.mouse.up();
  await page.locator('#backgroundToggle').click();await flush();await page.mouse.move(hover3d.x,hover3d.y);assert.equal(await page.locator('#momentumHairlines').isVisible(),true);
  await page.locator('.momentum-panel').screenshot({path:path.join(artifacts,'arpes-hover-white.png')});
  await page.mouse.move(0,0);assert.equal(await page.locator('#momentumHairlines').isVisible(),false);
  await equalPanelHeights();await page.locator('.planner-lower').screenshot({path:path.join(artifacts,'arpes-aligned-panels.png')});
  await page.locator('.configuration-panel').screenshot({path:path.join(artifacts,'arpes-vector-inputs.png')});
  await fill('slitCount',121);await fill('scanCount',121);await valid();assert.equal(await page.evaluate(()=>ArpesWorkspace.getResult().points.length),14641);
  await page.goto(url+'/escape-depth.html');await page.locator('.site-menu-toggle').click();assert.equal(await page.locator('.app-menu a[href="arpes-cut-planner.html"]').isVisible(),true);assert.equal(await page.locator('.depth-view-switch a[aria-current="page"]').textContent(),'IMFP');
  // Native touch input verifies pointer capture and the browser's gesture handling.
  const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),mobile=await mobileContext.newPage();
  mobile.on('pageerror',error=>exceptions.push(error.message));await mobile.goto(url+'/arpes-cut-planner.html');
  const cdp=await mobileContext.newCDPSession(mobile);
  const touch=async(type,points)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,id)=>({id,x:p.x,y:p.y,radiusX:5,radiusY:5}))});};
  const gesture=async(from,to)=>{await touch('touchStart',from);for(let step=1;step<=8;step++)await touch('touchMove',from.map((p,i)=>({x:p.x+(to[i].x-p.x)*step/8,y:p.y+(to[i].y-p.y)*step/8})));await touch('touchEnd',[]);};
  const mapView=()=>mobile.evaluate(()=>ArpesWorkspace.getView()),energyView=()=>mobile.evaluate(()=>ArpesAnalysisUI.getEnergyView());
  await mobile.locator('#momentumCanvas').scrollIntoViewIfNeeded();
  let touchMap=await mobile.locator('#momentumCanvas').boundingBox(),mx=touchMap.x+touchMap.width/2,my=touchMap.y+touchMap.height/2;
  await gesture([{x:mx-35,y:my},{x:mx+35,y:my}],[{x:mx-65,y:my},{x:mx+65,y:my}]);assert((await mapView()).zoom>1.5);
  const enlarged=(await mapView()).zoom;
  await gesture([{x:mx-65,y:my},{x:mx+65,y:my}],[{x:mx-35,y:my},{x:mx+35,y:my}]);assert((await mapView()).zoom<enlarged*.7);
  const beforeTouchPan=await mapView();await gesture([{x:mx-35,y:my},{x:mx+35,y:my}],[{x:mx-15,y:my+15},{x:mx+55,y:my+15}]);assert((await mapView()).panX>beforeTouchPan.panX+15);
  await mobile.locator('#plotReset').click();assert.equal((await mapView()).zoom,1);
  await mobile.locator('#dimension').selectOption('3');await mobile.locator('#momentumCanvas').scrollIntoViewIfNeeded();
  touchMap=await mobile.locator('#momentumCanvas').boundingBox();mx=touchMap.x+touchMap.width/2;my=touchMap.y+touchMap.height/2;
  const beforeTouch3d=await mapView();await gesture([{x:mx-30,y:my},{x:mx+30,y:my}],[{x:mx-60,y:my},{x:mx+60,y:my}]);
  const afterTouch3d=await mapView();assert(afterTouch3d.zoom>1.8);assert.equal(afterTouch3d.azimuth,beforeTouch3d.azimuth);assert.equal(afterTouch3d.elevation,beforeTouch3d.elevation);
  await mobile.locator('.momentum-panel').screenshot({path:path.join(artifacts,'arpes-mobile-touch-map.png')});
  await mobile.locator('#kzPlot').scrollIntoViewIfNeeded();
  const mobileSvg=await mobile.locator('#kzPlot').boundingBox(),tx=x=>mobileSvg.x+x/600*mobileSvg.width,ty=y=>mobileSvg.y+y/330*mobileSvg.height;
  const baseTouchView=await energyView();
  await gesture([{x:tx(250),y:ty(150)},{x:tx(370),y:ty(150)}],[{x:tx(180),y:ty(150)},{x:tx(440),y:ty(150)}]);
  const pinched=await energyView();assert(pinched.end-pinched.start<(baseTouchView.end-baseTouchView.start)*.6);assert(pinched.ymax-pinched.ymin<(baseTouchView.ymax-baseTouchView.ymin)*.6);
  await gesture([{x:tx(320),y:ty(230)}],[{x:tx(370),y:ty(250)}]);
  const touchPanned=await energyView();assert(touchPanned.start<pinched.start);assert(touchPanned.ymin>pinched.ymin);
  await mobile.locator('#kzAutoscale').click();assert.deepEqual(await energyView(),baseTouchView);
  await mobile.locator('#probeEnergy').fill('60');await mobile.locator('#kzPlot').scrollIntoViewIfNeeded();
  const touchProbe=await mobile.locator('#kzProbe .probe-dot').boundingBox(),probeStart={x:touchProbe.x+touchProbe.width/2,y:touchProbe.y+touchProbe.height/2};
  const configuredTouch=await mobile.locator('#kzReadout').textContent();
  await gesture([probeStart],[{x:probeStart.x+35,y:probeStart.y+30}]);assert(Number(await mobile.locator('#probeEnergy').inputValue())>75);assert.equal(await mobile.locator('#kzReadout').textContent(),configuredTouch);assert.deepEqual(await energyView(),baseTouchView);
  const touchReading=await mobile.locator('#kzCursorReadout').textContent(),probeEnd=await mobile.locator('#kzProbe .probe-dot').boundingBox(),probeCenter={x:probeEnd.x+probeEnd.width/2,y:probeEnd.y+probeEnd.height/2};
  await gesture([probeCenter,{x:probeCenter.x+25,y:probeCenter.y+35}],[{x:probeCenter.x-20,y:probeCenter.y-15},{x:probeCenter.x+50,y:probeCenter.y+50}]);assert.equal(await mobile.locator('#kzCursorReadout').textContent(),touchReading);assert((await energyView()).end-(await energyView()).start<baseTouchView.end-baseTouchView.start);
  await mobile.locator('#kzAutoscale').click();assert.deepEqual(await energyView(),baseTouchView);assert.equal(await mobile.locator('#kzCursorReadout').textContent(),touchReading);
  await mobile.locator('#kzPanel').screenshot({path:path.join(artifacts,'arpes-mobile-touch-kz.png')});
  assert.equal(await mobile.locator('.kz-touch-help').isVisible(),true);assert.equal(await mobile.locator('.kz-desktop-help').isVisible(),false);
  assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await mobile.evaluate(()=>visualViewport.scale),1);
  await mobileContext.close();
  assert.deepEqual(exceptions,[]);console.log('ARPES browser tests passed: menu, layout, all lattices, plots, interactions, persistence, validation, language, mobile.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
