const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=fs.realpathSync(path.resolve(__dirname,'..')),artifacts=path.join(root,'.browser-qa');
assert(root.toLowerCase().startsWith('c:\\users\\masas\\documents\\'));
fs.mkdirSync(artifacts,{recursive:true});assert.equal(fs.realpathSync(artifacts),artifacts);
process.env.TEMP=artifacts;process.env.TMP=artifacts;
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!/^\/(index\.html|escape-depth\.html|effective-depth\.html|assets\/[^.][^?]*)$/.test(pathname)){res.writeHead(404);return res.end();}
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep) || !fs.existsSync(file) || fs.realpathSync(file)!==file){res.writeHead(404);return res.end();}
  const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'}[path.extname(file)];
  if(!type){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',type);res.end(fs.readFileSync(file));
});
let browser;
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({channel:'msedge',headless:true,downloadsPath:artifacts,artifactsDir:artifacts});
  const page=await browser.newPage({viewport:{width:1500,height:1060}}),exceptions=[];
  page.on('pageerror',error=>exceptions.push(error.message));
  const untranslated=()=>page.evaluate(()=>{
    const values=[],walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    for(let node=walker.nextNode();node;node=walker.nextNode()){
      if(node.parentElement.closest('script,style,textarea,[data-no-i18n]'))continue;
      if(/[一-龯ぁ-ゖァ-ヺ]/.test(node.data))values.push(node.data.trim());
    }
    for(const element of document.querySelectorAll('[aria-label],[title],[placeholder]')){
      if(element.closest('[data-no-i18n]'))continue;
      for(const attr of ['aria-label','title','placeholder']){const value=element.getAttribute(attr);if(value && /[一-龯ぁ-ゖァ-ヺ]/.test(value))values.push(value);}
    }
    return [...new Set(values)];
  });
  const audit={};
  for(const name of ['index','escape-depth','effective-depth']){
    await page.goto(url+'/'+name+'.html');
    await page.waitForLoadState('load');
    audit[name]=await untranslated();
  }
  fs.writeFileSync(path.join(artifacts,'i18n-audit.json'),JSON.stringify(audit,null,2));
  console.log('Untranslated English UI:',JSON.stringify(audit));
  await page.goto(url+'/escape-depth.html');
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.equal(await page.locator('#peakMetric').count(),0);
  assert.equal(await page.locator('.app-menu a[href="effective-depth.html"]').count(),0);
  assert.equal(await page.locator('.depth-view-switch a[aria-current="page"]').textContent(),'IMFP');
  assert.equal(await page.locator('#structureTitle').textContent(),'Crystal structure & surface');
  const fill=async(id,value)=>{await page.locator('#'+id).fill(String(value));};
  await fill('filmRatio',.5);await fill('filmNumberDensity',50);await fill('filmLambda',2);await fill('filmSubstrateLambda',2);
  await page.waitForFunction(()=>document.getElementById('filmThickness').textContent!=='—');
  const first=Number(await page.locator('#filmThickness').textContent());
  assert(first>0);
  const expected=await page.evaluate(()=>{
    const prediction=EscapeDepthWorkspace.getPrediction(),row=prediction.prediction.rows.find(row=>row.id===document.getElementById('filmReference').value);
    const sigma=Photoionization.crossSection('C','1s',1486.6).value;
    return 2*Math.log1p(.5/(sigma*1e-4*50*2/row.area));
  });
  assert(Math.abs(first-expected)<1e-5);
  await page.locator('#languageToggle').click();
  assert.equal(await page.locator('#filmTitle').textContent(),'吸着層 · ピーク強度比からの膜厚推定');
  assert.equal(Number(await page.locator('#filmThickness').textContent()),first);
  assert.equal(await page.locator('#filmRatio').inputValue(),'0.5');
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('lang'),'ja');
  assert.equal(Number(await page.locator('#filmThickness').textContent()),first);
  await page.locator('#languageToggle').click();
  await fill('filmRatio',1);
  assert(Number(await page.locator('#filmThickness').textContent())>first);
  const downloadEvent=page.waitForEvent('download');await page.locator('#exportFilm').click();
  const csvPath=path.join(artifacts,'film-thickness.csv');await(await downloadEvent).saveAs(csvPath);
  assert.match(fs.readFileSync(csvPath,'utf8'),/thickness_nm/);
  await fill('filmLambda',0);
  assert.equal(await page.locator('#filmError').isVisible(),true);
  assert.equal(await page.locator('#filmThickness').textContent(),'—');
  assert.equal(await page.locator('#exportFilm').isDisabled(),true);
  assert.match(await page.locator('#filmError').textContent(),/allowed range/);
  await page.locator('#languageToggle').click();
  assert.match(await page.locator('#filmError').textContent(),/許容範囲/);
  await page.locator('#languageToggle').click();await fill('filmLambda',2);
  await page.locator('#filmElement').selectOption('O');
  assert.equal(await page.locator('#filmBindingEnergy').inputValue(),'531');
  await page.screenshot({path:path.join(artifacts,'escape-depth-en.png'),fullPage:true});
  const savedFilm=await page.locator('#filmThickness').textContent();
  await page.locator('.depth-view-switch a[href="effective-depth.html"]').click();
  await page.waitForLoadState('load');
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  await fill('ealHalfAngle',5);await page.locator('#calculateEal').click();
  assert(Math.abs(Number(await page.locator('#ealSolidAngle').textContent())-2*Math.PI*(1-Math.cos(5*Math.PI/180)))<1e-6);
  assert.match(await page.locator('#angleDiagram').textContent(),/Surface normal/);
  await page.locator('#languageToggle').click();
  assert.match(await page.locator('#angleDiagram').textContent(),/表面法線/);
  await fill('ealAngle',60);await page.locator('#calculateEal').click();
  assert.match(await page.locator('#ealError').textContent(),/50°/);
  await page.locator('#languageToggle').click();
  assert.match(await page.locator('#ealError').textContent(),/transport approximation/);
  await page.locator('#resetEal').click();
  await page.screenshot({path:path.join(artifacts,'effective-depth-en.png'),fullPage:true});
  await page.locator('.depth-view-switch a[href="escape-depth.html"]').click();await page.waitForLoadState('load');
  assert.equal(await page.locator('#filmThickness').textContent(),savedFilm);
  await page.locator('#resetWorkspace').click();
  assert.equal(await page.locator('#filmRatio').inputValue(),'');
  assert.equal(await page.locator('#filmElement').inputValue(),'C');
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(artifacts,'escape-depth-en-mobile.png'),fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#languageToggle').click();
  await page.screenshot({path:path.join(artifacts,'escape-depth-ja-mobile.png'),fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('.site-menu-toggle').click();await page.locator('.app-menu a[href="index.html"]').click();await page.waitForLoadState('load');
  assert.equal(await page.locator('html').getAttribute('lang'),'ja');
  assert.equal(await page.locator('#plotLayoutButton').textContent(),'グラフの表示設定');
  await page.locator('.element').filter({has:page.locator('.symbol',{hasText:/^Si$/})}).click();
  assert.match(await page.locator('#energyDetailsTitle').textContent(),/結合エネルギー/);
  await page.locator('#searchEnergyMode').click();
  assert.match(await page.locator('#energySearchSummary').textContent(),/一致/);
  await page.locator('#languageToggle').click();
  assert.match(await page.locator('#energyDetailsTitle').textContent(),/Binding energy/);
  assert.equal(await page.locator('#peakEnergy').inputValue(),'285.0');
  // Translation must never rename imported regions or rewrite measurement data.
  await page.setViewportSize({width:1500,height:1060});
  await page.locator('.data-panel summary').click();
  const xy='# Group: Custom group\n# Region: Line\n# Spectrum ID: 1\n# Excitation Energy: 1486.6\n# ColumnLabels: energy counts/s\n'+Array.from({length:21},(_,i)=>(280+i/2)+' '+(1+30*Math.exp(-(((i-10)/4)**2)))).join('\n');
  await page.locator('#xyFiles').setInputFiles({name:'日本語測定.xy',mimeType:'text/plain',buffer:Buffer.from(xy)});
  await page.waitForFunction(()=>document.querySelector('.series-option'));
  await page.locator('#languageToggle').click();
  assert.equal(await page.locator('.series-option span[data-no-i18n]').textContent(),'Line');
  assert.match(await page.locator('.file-name-text').textContent(),/日本語測定.xy/);
  await page.locator('.series-option input').check();
  await page.locator('#plotLayoutButton').click();
  assert.equal(await page.locator('#plotLayoutDialog h2').textContent(),'グラフの表示設定');
  await page.locator('#plotLayoutDialog button[value="cancel"]').click();
  await page.locator('.add-fit').click();
  assert.equal(await page.locator('#fitDialog h2').textContent(),'選択スペクトルのフィッティング');
  assert.equal(await page.locator('#fitPeakRows [data-field="center"]').count(),1);
  await page.locator('#fitDialog button[value="cancel"]').click();
  await page.locator('#languageToggle').click();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(artifacts,'reference-language-mobile.png'),fullPage:true});
  assert.equal(exceptions.length,0,exceptions.join('\n'));
  assert(Object.values(audit).every(list=>list.length===0),'English UI contains untranslated Japanese; see .browser-qa/i18n-audit.json');
  console.log('Toolkit browser checks passed: two-language state-preserving navigation, film inference/export/validation/reset, angle definitions, and mobile layout.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
