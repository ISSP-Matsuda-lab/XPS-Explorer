// Browser smoke test: requires Playwright and Microsoft Edge (or XPS_BROWSER_EXE).
// Temporary browser data and test artifacts remain inside .browser-qa/.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = fs.realpathSync(path.join(__dirname, '..'));
if (process.platform === 'win32' && !root.toLowerCase().startsWith('c:\\users\\masas\\documents\\')) throw new Error('Workspace must be inside the allowed directory.');
const artifacts = path.join(root, '.browser-qa');
fs.mkdirSync(artifacts, { recursive: true });
assert.equal(fs.realpathSync(artifacts), artifacts);
process.env.TEMP = artifacts; process.env.TMP = artifacts;
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const contentTypes = { '.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer((req,res) => {
  try {
    const requested = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const target = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
    if (!target.startsWith(root + path.sep) || !/^(?:index\.html|escape-depth\.html|assets[\\/])/.test(path.relative(root,target)) || !contentTypes[path.extname(target)] || !fs.existsSync(target)) { res.writeHead(404); return res.end(); }
    const canonical = fs.realpathSync(target);
    if (canonical !== target) { res.writeHead(403); return res.end(); }
    res.setHeader('Content-Type', contentTypes[path.extname(target)]); res.end(fs.readFileSync(canonical));
  } catch { res.writeHead(500); res.end(); }
});
let browser;
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ ...(process.env.XPS_BROWSER_EXE ? {executablePath:process.env.XPS_BROWSER_EXE} : {channel:'msedge'}), headless:true, downloadsPath:artifacts, artifactsDir:artifacts });
  const page=await browser.newPage({viewport:{width:1500,height:1060}}), exceptions=[];
  page.on('pageerror',error=>exceptions.push(error.message));
  await page.goto(url+'/index.html');
  await page.locator('.app-menu a[href="escape-depth.html"]').click();
  await page.waitForFunction(()=>document.getElementById('peakMetric')?.textContent.includes('/'));
  const error=page.locator('#calculationError');
  assert.equal(await error.isVisible(),false);
  assert((await page.locator('#peakRows tr').count())>0);
  const area=page.locator('#peakRows tr:nth-child(2) [data-value="area"]');
  const initial=Number(await area.textContent());
  console.log('Initial Si:',await page.locator('#peakMetric').textContent(),await page.locator('#imfpMetric').textContent());
  await page.screenshot({path:path.join(artifacts,'escape-depth-desktop.png'),fullPage:true});
  const fill = async(id,value)=>{await page.locator('#'+id).fill(String(value));await page.waitForFunction(()=>!document.getElementById('calculationStatus').textContent.includes('入力を反映'));};
  await fill('emissionAngle',60);
  assert(Number(await area.textContent())<initial,'grazing emission should reduce yield');
  await page.locator('#showAreas').click();
  assert.equal(await page.locator('#showAreas').getAttribute('aria-pressed'),'true');
  await fill('millerL',0);
  assert.equal(await error.isVisible(),true);
  assert.equal(await page.locator('#exportResults').isDisabled(),true);
  assert.equal(await area.textContent(),'—');
  await fill('millerL',1);
  await page.locator('#samplePreset').selectOption('nacl');
  assert.match(await page.locator('#structureSummary').textContent(),/Na.*Cl/);
  await page.locator('.calibration-panel summary').click();
  await page.locator('#enableCounts').check();
  assert.notEqual(await page.locator('#peakRows tr:nth-child(2) [data-value="counts"]').textContent(),'—');
  await page.locator('#photonPreset').selectOption('9251.7');
  assert.match(await page.locator('#peakRows').textContent(),/外挿/);
  await fill('photonEnergy',20000);
  assert.match(await page.locator('#calculationStatus').textContent(),/データ不足/);
  await page.locator('#photonPreset').selectOption('1486.6');
  await page.locator('#samplePreset').selectOption('si');
  await fill('emissionAngle',0);
  await page.locator('#showAttenuation').click();
  // Manual physical parameters must affect the rendered, exported calculations.
  const sigma=page.getByRole('spinbutton',{name:'Si 2s 断面積 Mb',exact:true});
  const beforeOverride=Number(await area.textContent());
  await sigma.fill('1');
  await page.waitForFunction(()=>!document.getElementById('calculationStatus').textContent.includes('入力を反映'));
  assert(Number(await area.textContent())>beforeOverride);
  await page.getByRole('button',{name:'Si 2s 断面積 Mbを自動に戻す',exact:true}).click();
  assert.equal(Number(await area.textContent()),beforeOverride);
  const downloaded=page.waitForEvent('download');
  await page.locator('#exportResults').click();
  const download=await downloaded, csvPath=path.join(artifacts,'xps-escape-depth.csv');
  await download.saveAs(csvPath);
  const csv=fs.readFileSync(csvPath,'utf8');
  assert.match(csv,/effective_atoms_nm-2/);assert.match(csv,/surface_phase/);assert.match(csv,/lattice_vector/);
  const poscar='Browser import\n1\n5 0 0\n0 5 0\n0 0 5\nCu\n1\nDirect\n0 0 0';
  await page.locator('#structureFile').setInputFiles({name:'sample.POSCAR',mimeType:'text/plain',buffer:Buffer.from(poscar)});
  await page.waitForFunction(()=>document.getElementById('importStatus').textContent.includes('読み込みました'));
  assert.match(await page.locator('#atomicSites').inputValue(),/^Cu/);
  assert.match(await page.locator('#peakRows').textContent(),/Cu 2p/);
  await page.locator('#structureFile').setInputFiles({name:'bad.cif',mimeType:'text/plain',buffer:Buffer.from('data_bad\n_cell_length_a 0')});
  await page.waitForFunction(()=>document.getElementById('importStatus').textContent.includes('読み込み失敗'));
  assert.match(await page.locator('#atomicSites').inputValue(),/^Cu/);
  const cif='data_test\n_cell_length_a 5\n_cell_length_b 5\n_cell_length_c 5\n_cell_angle_alpha 90\n_cell_angle_beta 90\n_cell_angle_gamma 90\n_space_group_IT_number 1\nloop_\n_atom_site_type_symbol\n_atom_site_fract_x\n_atom_site_fract_y\n_atom_site_fract_z\nO 0 0 0\n';
  await page.locator('#structureFile').setInputFiles({name:'sample.cif',mimeType:'text/plain',buffer:Buffer.from(cif)});
  await page.waitForFunction(()=>document.getElementById('importStatus').textContent.includes('読み込みました'));
  assert.match(await page.locator('#atomicSites').inputValue(),/^O/);
  await page.locator('#samplePreset').selectOption('si');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(artifacts,'escape-depth-mobile.png'),fullPage:true});
  await page.screenshot({path:path.join(artifacts,'escape-depth-mobile-top.png')});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile page should not overflow horizontally');
  assert(await page.evaluate(()=>document.querySelector('.app-menu').getBoundingClientRect().top>=document.querySelector('h1').getBoundingClientRect().bottom),'mobile menu should not overlap the title');
  await page.locator('.app-menu a[href="index.html"]').click();
  assert(await page.evaluate(()=>document.querySelector('.app-menu').getBoundingClientRect().top>=document.querySelector('h1').getBoundingClientRect().bottom),'reference app mobile menu should not overlap the title');
  assert.equal(exceptions.length,0,exceptions.join('\n'));
  console.log('Browser checks passed: navigation, calculations, angle, invalid input clearing, presets, counts, manual overrides, extrapolation, CSV, POSCAR/CIF import, mobile, no JS exceptions.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();server.close();
});
