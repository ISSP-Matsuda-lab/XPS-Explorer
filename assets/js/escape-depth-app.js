(function startEscapeDepthApp() {
  'use strict';
  const model = window.EscapeDepth;
  const $ = id => document.getElementById(id);
  const palette = ['#77e4c8', '#ffb45d', '#90b9ff', '#e7a1df', '#c1dc78', '#91dbef', '#fb929d', '#b4a2ff'];
  const fcc = [[0,0,0], [0,.5,.5], [.5,0,.5], [.5,.5,0]];
  const cube = a => [[a,0,0], [0,a,0], [0,0,a]];
  const presets = {
    si: { lattice: cube(5.431), atoms: [...fcc, ...fcc.map(row => row.map(v => v + .25))].map(frac => ({ symbol: 'Si', frac, occupancy: 1 })), material: [2.329, 28.085, 4, 1.12] },
    cu: { lattice: cube(3.615), atoms: fcc.map(frac => ({ symbol: 'Cu', frac, occupancy: 1 })), material: [8.96, 63.546, 11, 0] },
    nacl: { lattice: cube(5.6402), atoms: [...fcc.map(frac => ({ symbol: 'Na', frac, occupancy: 1 })), ...fcc.map(frac => ({ symbol: 'Cl', frac: [(frac[0]+.5)%1, frac[1], frac[2]], occupancy: 1 }))], material: [2.165, 58.44, 8, 8.5] }
  };
  let peakState = [], symbolsKey = '', latest = null, timer = null, storageReady = false, importVersion = 0;
  const storageKey = 'xps-escape-depth.workspace.v1';
  const fieldIds = ['samplePreset','photonPreset','photonEnergy','workFunction','emissionAngle','density','molarMass','valence','bandGap','latticeVectors','atomicSites','millerH','millerK','millerL','surfacePhase','sampleThickness','photonFlux','acquisitionTime','solidAngle','detectionEfficiency','transmissionExponent','dielectricFormat','dielectricData','valenceBandwidth','dielectricOffset','dielectricRange'];
  let imfpModel = 'tpp', dielectricCacheKey = '', dielectricSpectrum = null, dielectricResults = new Map();
  const detailIds = ['calibrationDetails','modelDetails'];
  function workspaceState() {
    return {
      version: 1,
      imfpModel,
      fields: Object.fromEntries(fieldIds.map(id => [id, $(id).value])),
      peaks: peakState.map(({id, bindingEnergy, sigma, lambda}) => ({id, bindingEnergy, sigma, lambda})),
      enableCounts: $('enableCounts').checked,
      details: Object.fromEntries(detailIds.map(id => [id, $(id).open])),
      importMessage: $('importStatus').textContent, importError: $('importStatus').classList.contains('error')
    };
  }
  function storageMessage(message) {
    $('storageStatus').textContent = message;
    $('storageStatus').hidden = !message;
  }
  function saveWorkspace() {
    if (!storageReady) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(workspaceState()));
      storageMessage('');
    } catch {
      storageMessage('ブラウザーに保存できませんでした。保存容量・設定を確認し、必要な結果はCSVで保存してください。');
    }
  }
  function restoreState(state) {
    // Restore only known fields and reference orbitals; calculated values are recomputed.
    fieldIds.forEach(id => { if (typeof state.fields[id] === 'string') $(id).value = state.fields[id]; });
    setImfpModel(state.imfpModel === 'dielectric' ? 'dielectric' : 'tpp');
    peakState = [];
    const overrides = new Map((Array.isArray(state.peaks) ? state.peaks : []).filter(peak => peak && typeof peak.id === 'string').map(peak => [peak.id, peak]));
    Object.entries(coreLevels).forEach(([symbol, levels]) => levels.forEach(([label, bindingEnergy]) => {
      const id = `${symbol}-${label}`, saved = overrides.get(id);
      if (!saved) return;
      const peak = { id, symbol, label, bindingEnergy, referenceBindingEnergy: bindingEnergy, sigma: '', lambda: '', enabled: true };
      ['bindingEnergy','sigma','lambda'].forEach(key => {
        if (typeof saved[key] === 'string' || (typeof saved[key] === 'number' && Number.isFinite(saved[key]))) peak[key] = saved[key];
      });
      peakState.push(peak);
    }));
    symbolsKey = ''; $('peakRows').replaceChildren();
    $('enableCounts').checked = state.enableCounts === true;
    detailIds.forEach(id => { $(id).open = state.details?.[id] === true; });
    $('importStatus').textContent = typeof state.importMessage === 'string' ? state.importMessage : '';
    $('importStatus').classList.toggle('error', state.importError === true);
    calculate();
  }
  const fmt = (value, places = 3) => value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: places });
  const scientific = value => value == null || !Number.isFinite(value) ? '—' : value === 0 ? '0' : value.toExponential(3);
  const textNode = (tag, text, className) => { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; };
  const svgNode = (tag, attrs, text) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
    if (text != null) node.textContent = text;
    return node;
  };
  function writeStructure(structure) {
    $('latticeVectors').value = structure.lattice.map(row => row.map(v => Number(v.toPrecision(12))).join(' ')).join('\n');
    $('atomicSites').value = structure.atoms.map(atom => `${atom.symbol} ${atom.frac.map(v => Number(v.toPrecision(12))).join(' ')} ${atom.occupancy}`).join('\n');
  }
  function readStructure() {
    const structure = model.validateStructure({ lattice: model.parseLattice($('latticeVectors').value), atoms: model.parseAtoms($('atomicSites').value) });
    structure.atoms.forEach(atom => { if (!Object.hasOwn(coreLevels, atom.symbol)) throw new Error(`${atom.symbol}の結合エネルギーデータはありません。対応元素はH〜Uです。`); });
    return structure;
  }
  function syncPeaks(structure) {
    const symbols = [...new Set(structure.atoms.filter(a => a.occupancy > 0).map(a => a.symbol))];
    const key = symbols.join(',');
    if (key === symbolsKey) return;
    symbolsKey = key;
    const previous = new Map(peakState.map(peak => [peak.id, peak]));
    peakState = symbols.flatMap(symbol => coreLevels[symbol].map(([label, bindingEnergy]) => {
      const id = `${symbol}-${label}`;
      return previous.get(id) || { id, symbol, label, bindingEnergy, referenceBindingEnergy: bindingEnergy, sigma: '', lambda: '', enabled: true };
    }));
    $('peakRows').replaceChildren();
    peakState.forEach((peak, index) => {
      const row = document.createElement('tr'); row.dataset.peak = peak.id;
      const nameCell = textNode('td', `${peak.symbol} ${peak.label}`);
      nameCell.style.color = palette[index % palette.length]; row.append(nameCell);
      function inputCell(key, unit, reference) {
        const cell = document.createElement('td'), input = document.createElement('input');
        input.type = 'number'; input.min = '0'; input.step = 'any'; input.value = peak[key]; input.dataset.field = key;
        input.setAttribute('aria-label', `${peak.symbol} ${peak.label} ${unit}`);
        input.addEventListener('input', () => { peak[key] = input.value; scheduleCalculation(); });
        const note = textNode('span', '', 'auto-value'), auto = textNode('button', key === 'bindingEnergy' ? '参照値' : '自動', 'auto-button');
        auto.type = 'button'; auto.setAttribute('aria-label', `${peak.symbol} ${peak.label} ${unit}を${auto.textContent}に戻す`);
        auto.addEventListener('click', () => { peak[key] = key === 'bindingEnergy' ? reference : ''; input.value = peak[key]; calculate(); });
        note.append(auto); cell.append(input, note); row.append(cell);
      }
      const valueCell = field => { const cell = document.createElement('td'); cell.dataset.value = field; cell.textContent = '—'; row.append(cell); };
      inputCell('bindingEnergy', '結合エネルギー eV', peak.referenceBindingEnergy);
      valueCell('energy'); inputCell('sigma', '断面積 Mb'); inputCell('lambda', 'IMFP nm');
      ['informationDepth', 'effectiveAtoms', 'area', 'fraction', 'counts', 'status'].forEach(valueCell);
      $('peakRows').append(row);
    });
  }
  function settings(structure) {
    const value = id => $(id).value;
    return {
      imfpModel,
      structure, material: { density: value('density'), molarMass: value('molarMass'), valence: value('valence'), gap: value('bandGap') },
      photonEnergy: value('photonEnergy'), workFunction: value('workFunction'), angle: value('emissionAngle'),
      miller: ['millerH','millerK','millerL'].map(value), phase: value('surfacePhase'), thickness: value('sampleThickness'), peaks: peakState,
      instrument: { enabled: $('enableCounts').checked, flux: value('photonFlux'), time: value('acquisitionTime'), solidAngle: value('solidAngle'), efficiency: value('detectionEfficiency'), exponent: value('transmissionExponent') }
    };
  }
  function setImfpModel(method) {
    imfpModel=method;
    document.querySelectorAll('[data-imfp-model]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.imfpModel===method)));
    $('dielectricPanel').hidden=method!=='dielectric';
    $('materialModelBadge').textContent=method==='dielectric'?'Penn SPA':'TPP-2M';
  }
  function dielectricCalculator(energy) {
    const key=JSON.stringify(['dielectricFormat','dielectricData','bandGap','valenceBandwidth','dielectricOffset','dielectricRange'].map(id=>$(id).value));
    if(key!==dielectricCacheKey){
      const spectrum=Dielectric.parseSpectrum($('dielectricData').value,$('dielectricFormat').value);
      dielectricSpectrum=spectrum;dielectricCacheKey=key;dielectricResults=new Map();
    }
    if(!dielectricResults.has(energy))dielectricResults.set(energy,Dielectric.calculate(energy,{spectrum:dielectricSpectrum,gap:$('bandGap').value,bandWidth:$('valenceBandwidth').value,energyOffset:$('dielectricOffset').value,rangePolicy:$('dielectricRange').value}));
    return dielectricResults.get(energy);
  }
  function clearResults() {
    latest = null; $('exportResults').disabled = true;
    ['surfaceMetric','imfpMetric'].forEach(id => { $(id).textContent = '—'; });
    document.querySelectorAll('[data-value]').forEach(cell => { cell.textContent = '—'; });
    document.querySelectorAll('[data-field="lambda"], [data-field="sigma"]').forEach(input => { input.placeholder = '—'; });
    $('structurePlot').replaceChildren(); $('structureSummary').textContent = '—';
  }
  function updateDepthControls() {
    let planarLattice = false;
    try { planarLattice = model.latticeGeometry(model.parseLattice($('latticeVectors').value)).dimension === 2; } catch { /* Keep invalid drafts editable. */ }
    if (planarLattice) $('sampleThickness').value = 0;
    $('sampleThickness').disabled = planarLattice;
    ['millerH','millerK','millerL'].forEach(id => { $(id).disabled = planarLattice; });
    const isSheet = $('sampleThickness').value !== '' && Number($('sampleThickness').value) === 0;
    $('surfacePhase').disabled = isSheet;
  }
  function calculate() {
    clearTimeout(timer);
    updateDepthControls();
    try {
      const structure = readStructure(); syncPeaks(structure);
      const input = settings(structure), prediction = model.predict(input, Photoionization.crossSection, dielectricCalculator);
      latest = { input, prediction };
      $('calculationError').hidden = true; $('exportResults').disabled = false;
      const lambdas = prediction.rows.map(row => row.lambda).filter(v => v != null);
      $('surfaceMetric').textContent = prediction.surface.crystal.dimension === 2
        ? `2D · ${fmt(prediction.surface.area,4)} nm²`
        : `(${prediction.surface.indices.join(' ')}) · ${fmt(prediction.surface.spacing)} nm`;
      $('imfpMetric').textContent = lambdas.length ? `${fmt(Math.min(...lambdas), 2)}–${fmt(Math.max(...lambdas), 2)} nm` : '—';
      const calculated = prediction.rows.filter(row => row.area != null && row.energy > 0).length;
      const unavailable = prediction.rows.filter(row => row.area == null).length;
      const warnings = prediction.rows.filter(row => row.status.length && row.energy > 0).length;
      const status = $('calculationStatus'); status.classList.toggle('warning', Boolean(unavailable || warnings || !calculated));
      status.textContent = !calculated ? 'No accessible peaks can be calculated with these inputs.' : unavailable ? 'Some peaks lack data and are excluded from area normalization.' : warnings ? 'Check approximation and data-range notes in the table.' : 'Calculation updated.';
      renderTable(prediction); renderStructure(prediction.surface);
      document.dispatchEvent(new CustomEvent('xps:prediction', {detail:latest}));
    } catch (error) {
      clearResults(); $('calculationError').textContent = error.message; $('calculationError').hidden = false;
      $('calculationStatus').textContent = '入力を修正すると結果が更新されます。';
    } finally { saveWorkspace(); }
  }
  function scheduleCalculation() {
    clearTimeout(timer); latest = null; $('exportResults').disabled = true;
    updateDepthControls();
    $('calculationStatus').textContent = '入力を反映しています…';
    // Save immediately so reloading before the calculation debounce also keeps edits.
    saveWorkspace();
    timer = setTimeout(calculate, 250);
  }
  function renderTable(prediction) {
    const byId = new Map(prediction.rows.map(row => [row.id, row]));
    [...$('peakRows').children].forEach(tr => {
      const row = byId.get(tr.dataset.peak); tr.classList.toggle('disabled', !row);
      tr.querySelectorAll('[data-value]').forEach(cell => {
        const field = cell.dataset.value;
        if (!row) { cell.textContent = field === 'status' ? '計算対象外' : '—'; return; }
        if (field === 'status') {
          const method = { tabulated: 'σ: 表値', interpolated: 'σ: 補間', extrapolated: 'σ: 外挿', '手入力': 'σ: 手入力' }[row.crossSectionMethod] || '';
          cell.textContent = [method, row.imfpMethod, prediction.surface.mode === 'sheet' && row.energy > 0 ? '2D 減衰なし' : '', ...row.status].filter(Boolean).join(' · ');
          cell.classList.toggle('row-warning', row.status.length > 0);
        } else {
          cell.textContent = ['area','counts'].includes(field) ? scientific(row[field]) : field === 'fraction' ? fmt(row.fraction == null ? null : row.fraction * 100, 2) : fmt(row[field]);
          cell.classList.toggle('area-value', field === 'area');
        }
      });
      ['lambda','sigma'].forEach(field => {
        const input = tr.querySelector(`[data-field="${field}"]`);
        input.placeholder = !row || row[field] == null ? '—' : field === 'lambda' ? fmt(row[field], 4) : Photoionization.formatCrossSection(row[field]);
      });
    });
  }
  function renderStructure(surface) {
    const counts = new Map(); surface.crystal.atoms.forEach(atom => counts.set(atom.symbol, (counts.get(atom.symbol)||0)+atom.occupancy));
    const isSheet = surface.mode === 'sheet';
    const basis = surface.crystal.dimension === 2 ? `\n面内基底：${surface.crystal.plane.indices.map(i=>['a','b','c'][i]).join(', ')}（体積0）` : '';
    const geometrySummary = isSheet ? `2D · 面積 ${fmt(surface.area,4)} nm²\n厚さ 0 nm · 減衰なし${basis}` : `体積 ${fmt(surface.volume)} Å³ · d = ${fmt(surface.spacing,4)} nm`;
    $('structureSummary').textContent = `${[...counts].map(([symbol,count])=>`${symbol} × ${fmt(count)}`).join(' / ')}\n${geometrySummary}`;
    const svg = $('structurePlot'); svg.replaceChildren();
    const species = [...counts.keys()], maxDepth = isSheet ? 0 : Math.min(surface.thickness, Math.max(2, surface.spacing*8));
    const width=Math.max(180,svg.getBoundingClientRect().width);
    const height=window.matchMedia('(min-width: 1251px)').matches ? Math.max(360,$('recalculate').getBoundingClientRect().bottom-svg.getBoundingClientRect().top) : 450;
    svg.style.height=`${height}px`; svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const left = 40, right = width-10, top = 36, bottom = height-38;
    if (maxDepth > 0) svg.append(svgNode('rect', { x:left, y:top, width:right-left, height:bottom-top, fill:'#77e4c808' }));
    svg.append(svgNode('line', { x1:left,y1:top,x2:right,y2:top,stroke:'#77e4c8','stroke-width':2 }));
    svg.append(svgNode('text', { x:left,y:15,fill:'#8eaaa7','font-size':10 }, '真空 ↑ / 表面 z = 0'));
    for (let i=0; i<=(maxDepth > 0 ? 4 : 0); i++) {
      const y = top+i/4*(bottom-top);
      svg.append(svgNode('text', { x:left-7,y:y+4,'text-anchor':'end',fill:'#8eaaa7','font-size':10 }, fmt(maxDepth*i/4,2)));
    }
    if (isSheet) {
      svg.append(svgNode('text', { x:left+8,y:top+38,fill:'#77e4c8','font-size':11 }, '原子は表面の1層のみ'));
      svg.append(svgNode('text', { x:left+8,y:top+58,fill:'#8eaaa7','font-size':10 }, '厚さ 0：減衰なし（P = 1）'));
    }
    svg.append(svgNode('text', { x:12,y:height-12,fill:'#8eaaa7','font-size':10 }, 'nm'));
    const layers = new Map();
    surface.sites.forEach(site => {
      for (let n=0; n<Math.min(site.count,100); n++) {
        const depth = site.firstDepth+n*surface.spacing; if (depth > maxDepth) break;
        const key = `${site.symbol}:${depth.toFixed(7)}`;
        const previous = layers.get(key);
        layers.set(key, { symbol:site.symbol, depth, weight:(previous?.weight||0)+site.arealDensity });
      }
    });
    [...layers.values()].sort((a,b)=>a.depth-b.depth).slice(0,100).forEach(layer => {
      const index=species.indexOf(layer.symbol), x=left+(index+.5)/species.length*(right-left), y=top+(maxDepth > 0 ? layer.depth/maxDepth*(bottom-top) : 0);
      const circle = svgNode('circle', { cx:x,cy:y,r:Math.min(9,Math.max(3,Math.sqrt(layer.weight)*1.8)),fill:palette[index%palette.length],opacity:.85 });
      circle.append(svgNode('title', {}, `${layer.symbol}: ${fmt(layer.depth,4)} nm, ${fmt(layer.weight,4)} atoms/nm²`)); svg.append(circle);
    });
    species.forEach((symbol,index) => svg.append(svgNode('text', { x:left+(index+.5)/species.length*(right-left),y:height-12,'text-anchor':'middle',fill:palette[index%palette.length],'font-size':12 }, symbol)));
  }
  function applyPreset(name) {
    if (!presets[name]) { saveWorkspace(); return; }
    importVersion++;
    const preset = presets[name]; writeStructure(preset);
    ['density','molarMass','valence','bandGap'].forEach((id,i) => { $(id).value = preset.material[i]; });
    ['millerH','millerK','surfacePhase'].forEach(id => { $(id).value = 0; }); $('millerL').value = 1;
    peakState = []; symbolsKey = ''; $('importStatus').textContent = ''; $('importStatus').classList.remove('error'); calculate();
  }
  $('samplePreset').addEventListener('change', event => applyPreset(event.target.value));
  document.querySelectorAll('[data-imfp-model]').forEach(button=>button.addEventListener('click',()=>{setImfpModel(button.dataset.imfpModel);calculate();}));
  $('dielectricFile').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    const version=++importVersion;
    try {
      if(file.size>1e6)throw new Error('誘電データは1 MB以下にしてください。');
      const text=await file.text();if(version!==importVersion)return;
      Dielectric.parseSpectrum(text,$('dielectricFormat').value);
      $('dielectricData').value=text;$('dielectricImportStatus').textContent=`${file.name}を読み込みました。`;calculate();
    }catch(error){if(version===importVersion)$('dielectricImportStatus').textContent=`読み込み失敗：${error.message}`;}
    event.target.value='';
  });
  $('photonPreset').addEventListener('change', event => { if (event.target.value !== 'custom') { $('photonEnergy').value = event.target.value; calculate(); } else saveWorkspace(); });
  $('photonEnergy').addEventListener('input', () => { $('photonPreset').value = [...$('photonPreset').options].some(option => option.value === $('photonEnergy').value) ? $('photonEnergy').value : 'custom'; });
  ['density','molarMass','valence','bandGap','latticeVectors','atomicSites'].forEach(id => $(id).addEventListener('input', () => { $('samplePreset').value = 'custom'; }));
  fieldIds.filter(id => !['samplePreset','photonPreset'].includes(id)).forEach(id => $(id).addEventListener('input', scheduleCalculation));
  $('enableCounts').addEventListener('change', calculate);
  $('recalculate').addEventListener('click', calculate);
  detailIds.forEach(id => $(id).addEventListener('toggle', saveWorkspace));
  window.addEventListener('pagehide', saveWorkspace);
  $('structureFile').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    const version = ++importVersion;
    try {
      if (file.size > 2e6) throw new Error('構造ファイルは2 MB以下にしてください。');
      const text = await file.text();
      if (version !== importVersion) return;
      const structure = model.parseStructure(text);
      structure.atoms.forEach(atom => { if (!Object.hasOwn(coreLevels, atom.symbol)) throw new Error(`${atom.symbol}は結合エネルギーデータにありません。`); });
      writeStructure(structure); $('samplePreset').value = 'custom'; peakState = []; symbolsKey = '';
      $('importStatus').classList.remove('error'); $('importStatus').textContent = `${file.name}: ${structure.atoms.length}原子を読み込みました。材料のρ・M・Nv・Egと表面方位を試料に合わせて更新してください。`;
      calculate();
    } catch (error) {
      if (version !== importVersion) return;
      $('importStatus').classList.add('error'); $('importStatus').textContent = `読み込み失敗：${error.message} 現在の構造は保持されています。`; saveWorkspace();
    }
    event.target.value = '';
  });
  $('exportResults').addEventListener('click', () => {
    if (!latest) return;
    const { input, prediction } = latest;
    const metadata = [
      ['model',prediction.surface.mode === 'sheet' ? '2D sheet without attenuation' : 'homogeneous periodic slab'], ['imfp_model',imfpModel==='dielectric'?'Penn SPA (nonrelativistic approximation; not Full Penn)':'TPP-2M'], ['energy_convention','Ekin = photon - binding - work function'], ['area_yield_unit','dimensionless; unscattered electrons per incident photon, all solid angles'],
      ['photon_eV',input.photonEnergy], ['work_function_eV',input.workFunction], ['angle_from_normal_deg',input.angle],
      ['density_g_cm3',input.material.density], ['molar_mass_g_mol',input.material.molarMass], ['Nv',input.material.valence], ['gap_eV',input.material.gap],
      ['hkl',prediction.surface.indices?.join(' ') ?? ''], ['surface_phase',input.phase], ['thickness_nm',prediction.surface.thickness], ['unit_cell_volume_A3',prediction.surface.volume], ['spacing_nm',prediction.surface.spacing],
      ['geometry_mode',prediction.surface.mode], ['lattice_dimension',prediction.surface.crystal.dimension], ['surface_phase_applied',prediction.surface.mode === 'slab'], ['surface_cell_area_nm2',prediction.surface.area], ['in_plane_basis',prediction.surface.crystal.plane?.indices.map(i=>['a','b','c'][i]).join(' ') ?? ''], ['attenuation',prediction.surface.mode === 'sheet' ? 'none (P=1)' : 'exp(-z/(lambda*cos(theta)))'],
      ['counts_enabled',input.instrument.enabled], ['photons_per_s',input.instrument.flux], ['time_s',input.instrument.time], ['solid_angle_sr',input.instrument.solidAngle], ['efficiency_1keV',input.instrument.efficiency], ['transmission_exponent',input.instrument.exponent],
      ['incomplete_area_normalization',prediction.incomplete], ['imfp_source',imfpModel==='dielectric'?'https://pmc.ncbi.nlm.nih.gov/articles/PMC5524379/':'https://www.nist.gov/system/files/documents/srd/SRD71UsersGuideV1-2.pdf'], ['cross_section_source','https://doi.org/10.6084/m9.figshare.12389750.v3']
    ];
    if(imfpModel==='dielectric')metadata.push(['dielectric_format',$('dielectricFormat').value],['valence_bandwidth_eV',$('valenceBandwidth').value],['vacuum_to_conduction_offset_eV',$('dielectricOffset').value],['ELF_range_policy',$('dielectricRange').value],['dielectric_input_data',$('dielectricData').value]);
    const lines = [['parameter','value'], ...metadata, [], ['lattice_vector','x_A','y_A','z_A'], ...input.structure.lattice.map((row,index)=>[['a','b','c'][index],...row]), [], ['element','fractional_x','fractional_y','fractional_z','occupancy'], ...input.structure.atoms.map(atom=>[atom.symbol,...atom.frac,atom.occupancy]), [], ['element','orbital','enabled','BE_eV','Ekin_eV','sigma_Mb','sigma_method','IMFP_nm','IMFP_method','depth95_nm','effective_atoms_nm-2','area_yield','area_percent','counts','status']];
    const results = new Map(prediction.rows.map(row=>[row.id,row]));
    peakState.forEach(peak => {
      const row=results.get(peak.id);
      lines.push(row ? [row.symbol,row.label,true,row.bindingEnergy,row.energy,row.sigma,row.crossSectionMethod,row.lambda,row.imfpMethod,row.informationDepth,row.effectiveAtoms,row.area,row.fraction == null ? null : row.fraction*100,row.counts,row.status.join('; ')] : [peak.symbol,peak.label,false,peak.bindingEnergy,'','','','','','','','','','','excluded']);
    });
    const csv = '\uFEFF' + lines.map(row=>row.map(value=>{
      let text = value == null ? '' : String(value);
      if (typeof value === 'string' && /^[=+@]/.test(text)) text = "'" + text;
      return `"${text.replace(/"/g,'""')}"`;
    }).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})), link=document.createElement('a');
    link.href=url; link.download='xps-escape-depth.csv'; document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  window.EscapeDepthWorkspace = {getPrediction: () => latest};
  applyPreset('si');
  const defaultState = workspaceState();
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const state = JSON.parse(saved);
      if (state?.version !== 1 || !state.fields || typeof state.fields !== 'object') throw new Error('Unsupported saved state');
      restoreState(state);
    }
  } catch {
    storageMessage('保存内容を復元できませんでした。初期状態で表示しています。');
  }
  storageReady = true;
  let resizePending=false;
  const resizePlot=()=>{if(resizePending)return;resizePending=true;requestAnimationFrame(()=>{resizePending=false;if(latest)renderStructure(latest.prediction.surface);});};
  new ResizeObserver(resizePlot).observe(document.querySelector('.surface-controls'));
  window.addEventListener('resize',resizePlot);
  $('resetWorkspace').addEventListener('click', () => {
    importVersion++;
    clearTimeout(timer);
    $('structureFile').value = '';
    $('dielectricFile').value = ''; $('dielectricImportStatus').textContent='';
    restoreState(defaultState);
    document.dispatchEvent(new Event('xps:escape-reset'));
  });
}());
