// Run with PLAYWRIGHT_MODULE and XPS_BROWSER_EXE when using a system browser.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!/^\/(index\.html|escape-depth\.html|arpes-cut-planner\.html|assets\/[\w./-]+)$/.test(pathname)){res.writeHead(404);return res.end();}
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'application/octet-stream');
  res.end(fs.readFileSync(file));
});
let browser;
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,...(process.env.XPS_BROWSER_EXE?{executablePath:process.env.XPS_BROWSER_EXE}:{channel:'msedge'})});
  for(const mobile of [true,false]){
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url+'/index.html');await page.waitForFunction(()=>storageReady);
    for(const destination of ['escape-depth.html','arpes-cut-planner.html']){
      await page.locator('.site-menu-toggle').click();
      // Change selection/settings and navigate in the same task, before debounce.
      // Keep write transactions alive to model slow mobile storage. The page
      // must wait for transaction completion, rather than just request success.
      await page.evaluate(destination=>{
        clearTimeout(saveTimer);
        const original=IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction=function(...args){
          const transaction=original.apply(this,args);
          if(args[1]==='readwrite'){
            const until=performance.now()+300,store=transaction.objectStore('workspace');
            const keepAlive=()=>{if(performance.now()<until)store.get('current').onsuccess=keepAlive;};keepAlive();
            transaction.addEventListener('complete',()=>sessionStorage.setItem('navigationSaveCommitted','yes'));
          }
          return transaction;
        };
        sessionStorage.removeItem('navigationSaveCommitted');
        window.addEventListener('pagehide',()=>sessionStorage.setItem('committedBeforePagehide',sessionStorage.getItem('navigationSaveCommitted')||'no'),{once:true});
        document.querySelector('#clear').click();
        elementButton('Si').click();elementButton('Cu').click();
        document.querySelector('#kinetic').click();
        showAugerInput.checked=true;showAugerInput.onchange();
        document.querySelector('.app-menu a[href="'+destination+'"]').click();
      },destination);
      await page.waitForURL(url+'/'+destination);
      assert.equal(await page.evaluate(()=>sessionStorage.getItem('committedBeforePagehide')),'yes','navigation must wait for the IndexedDB transaction to commit');
      await page.locator('.site-menu-toggle').click();
      await page.locator('.app-menu a[href="index.html"]').click();
      await page.waitForFunction(()=>typeof storageReady!=='undefined'&&storageReady);
      assert.deepEqual(await page.evaluate(()=>[...selected.keys()]),['Si','Cu']);
      assert.equal(await page.locator('#kinetic').getAttribute('class'),'active');
      assert.equal(await page.locator('#showAuger').isChecked(),true);
    }
    // Backgrounding flushes pending changes without waiting for pagehide.
    await page.evaluate(()=>{
      clearButton.click();elementButton('Au').click();
      Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(async()=>JSON.stringify((await readStoredWorkspace()).selected.map(([symbol])=>symbol))==='["Au"]');
    await page.reload();await page.waitForFunction(()=>storageReady);
    assert.deepEqual(await page.evaluate(()=>[...selected.keys()]),['Au']);
    // Empty selections must be restored too; defaults are only for a new workspace.
    await page.locator('#clear').click();
    await page.locator('.site-menu-toggle').click();await page.locator('.app-menu a[href="escape-depth.html"]').click();
    await page.locator('.site-menu-toggle').click();await page.locator('.app-menu a[href="index.html"]').click();
    await page.waitForFunction(()=>storageReady);assert.equal(await page.locator('.element.selected').count(),0);
    await page.locator('#resetAll').click();await page.waitForFunction(()=>storageReady&&selected.has('C'));
    assert.deepEqual(await page.evaluate(()=>[...selected.keys()]),['C','O','Fe']);
    assert.deepEqual(errors,[]);await context.close();
    console.log(`${mobile?'Mobile':'Desktop'} navigation: delayed commit, both menu destinations, settings, background save, empty selection, reset passed.`);
  }
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
