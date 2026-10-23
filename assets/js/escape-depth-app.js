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
  let peakState = [], symbolsKey = '', latest = null, plotMode = 'attenuation', timer = null;
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
      const nameCell = document.createElement('td'), label = document.createElement('label'), checkbox = document.createElement('input');
      checkbox.type = 'checkbox'; checkbox.checked = peak.enabled; checkbox.setAttribute('aria-label', `${peak.symbol} ${peak.label} を計算に含める`);
      checkbox.addEventListener('change', () => { peak.enabled = checkbox.checked; calculate(); });
      label.append(checkbox, textNode('span', `${peak.symbol} ${peak.label}`)); label.style.color = palette[index % palette.length]; nameCell.append(label); row.append(nameCell);
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
      structure, material: { density: value('density'), molarMass: value('molarMass'), valence: value('valence'), gap: value('bandGap') },
      photonEnergy: value('photonEnergy'), workFunction: value('workFunction'), angle: value('emissionAngle'),
      miller: ['millerH','millerK','millerL'].map(value), phase: value('surfacePhase'), thickness: value('sampleThickness'), peaks: peakState,
      instrument: { enabled: $('enableCounts').checked, flux: value('photonFlux'), time: value('acquisitionTime'), solidAngle: value('solidAngle'), efficiency: value('detectionEfficiency'), exponent: value('transmissionExponent') }
    };
  }
  function clearResults(message) {
    latest = null; $('exportResults').disabled = true;
    ['surfaceMetric','imfpMetric','peakMetric'].forEach(id => { $(id).textContent = '—'; });
    document.querySelectorAll('[data-value]').forEach(cell => { cell.textContent = '—'; });
    document.querySelectorAll('[data-field="lambda"], [data-field="sigma"]').forEach(input => { input.placeholder = '—'; });
    $('depthPlot').replaceChildren(svgNode('text', { x: 430, y: 170, 'text-anchor': 'middle', fill: '#8eaaa7', 'font-size': 16 }, message));
    $('structurePlot').replaceChildren(); $('plotKeys').replaceChildren(); $('structureSummary').textContent = '—'; $('plotDescription').textContent = '';
  }
  function calculate() {
    clearTimeout(timer);
    try {
      const structure = readStructure(); syncPeaks(structure);
      const input = settings(structure), prediction = model.predict(input, Photoionization.crossSection);
      latest = { input, prediction };
      $('calculationError').hidden = true; $('exportResults').disabled = false;
      const lambdas = prediction.rows.map(row => row.lambda).filter(v => v != null);
      $('surfaceMetric').textContent = `(${prediction.surface.indices.join(' ')}) · ${fmt(prediction.surface.spacing)} nm`;
      $('imfpMetric').textContent = lambdas.length ? `${fmt(Math.min(...lambdas), 2)}–${fmt(Math.max(...lambdas), 2)} nm` : '—';
      const calculated = prediction.rows.filter(row => row.area != null && row.energy > 0).length;
      $('peakMetric').textContent = `${calculated} / ${prediction.rows.length}`;
      const unavailable = prediction.rows.filter(row => row.area == null).length;
      const warnings = prediction.rows.filter(row => row.status.length && row.energy > 0).length;
      const status = $('calculationStatus'); status.classList.toggle('warning', Boolean(unavailable || warnings || !calculated));
      status.textContent = !prediction.rows.length ? '軌道が選択されていません。表のチェックを入れてください。' : `${calculated}軌道を計算しました。${unavailable ? ` ${unavailable}軌道はデータ不足のため面積比から除外しています。` : ''}${warnings ? ' 適用範囲・外挿などの状態を表で確認してください。' : ''}${!calculated ? ' 計算可能なピークがありません。' : ''}`;
      renderTable(prediction); renderPlots(); renderStructure(prediction.surface);
    } catch (error) {
      clearResults('入力を確認してください'); $('calculationError').textContent = error.message; $('calculationError').hidden = false;
      $('calculationStatus').textContent = '入力を修正すると結果が更新されます。';
    }
  }
  function scheduleCalculation() {
    clearTimeout(timer); latest = null; $('exportResults').disabled = true;
    $('calculationStatus').textContent = '入力を反映しています…';
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
          cell.textContent = [method, row.imfpMethod, ...row.status].filter(Boolean).join(' · ');
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
  function renderPlots() {
    $('showAttenuation').classList.toggle('active', plotMode === 'attenuation'); $('showAttenuation').setAttribute('aria-pressed', String(plotMode === 'attenuation'));
    $('showAreas').classList.toggle('active', plotMode === 'areas'); $('showAreas').setAttribute('aria-pressed', String(plotMode === 'areas'));
    if (!latest) return;
    const { prediction, input } = latest, svg = $('depthPlot'); svg.replaceChildren(); $('plotKeys').replaceChildren();
    const candidates = prediction.rows.filter(row => row.lambda != null && row.area != null && row.energy > 0).sort((a,b) => b.area - a.area);
    const shown = candidates.slice(0, plotMode === 'areas' ? 12 : 8);
    if (!shown.length) { svg.append(svgNode('text', { x: 430, y: 170, fill: '#8eaaa7', 'text-anchor': 'middle', 'font-size': 16 }, '計算できる軌道を選択してください')); return; }
    const left = 72, right = 825, top = 32, bottom = 290, width = right-left, height = bottom-top;
    const label = (x,y,text,anchor='end') => svgNode('text', { x,y, fill: '#8eaaa7', 'font-size': 12, 'text-anchor': anchor }, text);
    for (let i=0; i<=4; i++) {
      const y = bottom-i/4*height;
      svg.append(svgNode('line', { x1:left, y1:y, x2:right, y2:y, stroke:'#254047', 'stroke-dasharray':i ? '3 5' : '' }));
      svg.append(label(left-12, y+4, `${i*25}`));
    }
    svg.append(label(left, 18, plotMode === 'attenuation' ? '無損失脱出確率 / %' : '計算対象内の面積比 / %', 'start'));
    if (plotMode === 'attenuation') {
      const maxDepth = Math.min(prediction.surface.thickness, Math.max(...shown.map(row => row.informationDepth || 0)) * 1.3);
      const maxX = Math.max(maxDepth, 0.001);
      for (let i=0; i<=5; i++) svg.append(label(left+i/5*width, bottom+22, fmt(maxX*i/5, 2), 'middle'));
      svg.append(label((left+right)/2, 337, '表面からの深さ z / nm', 'middle'));
      shown.forEach((row,index) => {
        const color = palette[peakState.findIndex(peak => peak.id === row.id) % palette.length];
        const points = Array.from({ length: 121 }, (_,i) => `${left+i/120*width},${bottom-model.attenuation(i/120*maxX, row.lambda, input.angle)*height}`);
        const line = svgNode('polyline', { points:points.join(' '), fill:'none', stroke:color, 'stroke-width':2.5, 'stroke-dasharray': index >= palette.length ? '6 3' : '' });
        line.append(svgNode('title', {}, `${row.symbol} ${row.label}: λ = ${fmt(row.lambda)} nm`)); svg.append(line);
        const key = document.createElement('span'), swatch = document.createElement('i'); swatch.style.background = color; key.append(swatch, `${row.symbol} ${row.label} · ${fmt(row.lambda,2)} nm`); $('plotKeys').append(key);
      });
      svg.setAttribute('aria-label', '表面からの深さと軌道別の無損失脱出確率');
      $('plotDescription').textContent = `予測面積の大きい${shown.length}軌道を表示。すべての軌道の数値は下の表で確認できます。`;
    } else {
      shown.forEach((row,index) => {
        const barWidth = Math.min(54, width/shown.length*.65), x = left+(index+.5)/shown.length*width, h = (row.fraction || 0)*height;
        const color = palette[peakState.findIndex(peak => peak.id === row.id) % palette.length];
        const bar = svgNode('rect', { x:x-barWidth/2, y:bottom-h, width:barWidth, height:h, rx:3, fill:color });
        bar.append(svgNode('title', {}, `${row.symbol} ${row.label}: Y=${scientific(row.area)}, ${fmt((row.fraction || 0)*100,2)}%`)); svg.append(bar);
        svg.append(label(x, bottom-h-8, `${fmt((row.fraction || 0)*100,1)}%`, 'middle'), label(x,bottom+23,`${row.symbol}`, 'middle'), label(x,bottom+40,row.label,'middle'));
      });
      svg.setAttribute('aria-label', '光イオン化断面積と深さ減衰を反映した軌道別ピーク面積比');
      $('plotDescription').textContent = `予測面積の上位${shown.length}軌道。規格化には表示外の計算可能な軌道も含みます。${prediction.incomplete ? 'データ不足の軌道は除外されています。' : ''}`;
    }
  }
  function renderStructure(surface) {
    const counts = new Map(); surface.crystal.atoms.forEach(atom => counts.set(atom.symbol, (counts.get(atom.symbol)||0)+atom.occupancy));
    $('structureSummary').textContent = `${[...counts].map(([symbol,count])=>`${symbol} × ${fmt(count)}`).join(' / ')}\n体積 ${fmt(surface.volume)} Å³ · d = ${fmt(surface.spacing,4)} nm`;
    const svg = $('structurePlot'); svg.replaceChildren();
    const species = [...counts.keys()], maxDepth = Math.min(surface.thickness, Math.max(2, surface.spacing*8));
    const left = 48, right = 250, top = 36, bottom = 292;
    svg.append(svgNode('rect', { x:left, y:top, width:right-left, height:bottom-top, fill:'#77e4c808' }), svgNode('line', { x1:left,y1:top,x2:right,y2:top,stroke:'#77e4c8','stroke-width':2 }));
    svg.append(svgNode('text', { x:left,y:15,fill:'#8eaaa7','font-size':10 }, '真空 ↑ / 表面 z = 0'));
    for (let i=0; i<=4; i++) {
      const y = top+i/4*(bottom-top);
      svg.append(svgNode('text', { x:left-7,y:y+4,'text-anchor':'end',fill:'#8eaaa7','font-size':10 }, fmt(maxDepth*i/4,2)));
    }
    svg.append(svgNode('text', { x:24,y:318,fill:'#8eaaa7','font-size':10 }, 'nm'));
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
      const index=species.indexOf(layer.symbol), x=left+(index+.5)/species.length*(right-left), y=top+layer.depth/maxDepth*(bottom-top);
      const circle = svgNode('circle', { cx:x,cy:y,r:Math.min(9,Math.max(3,Math.sqrt(layer.weight)*1.8)),fill:palette[index%palette.length],opacity:.85 });
      circle.append(svgNode('title', {}, `${layer.symbol}: ${fmt(layer.depth,4)} nm, ${fmt(layer.weight,4)} atoms/nm²`)); svg.append(circle);
    });
    species.forEach((symbol,index) => svg.append(svgNode('text', { x:left+(index+.5)/species.length*(right-left),y:318,'text-anchor':'middle',fill:palette[index%palette.length],'font-size':12 }, symbol)));
  }
  function applyPreset(name) {
    if (!presets[name]) return;
    const preset = presets[name]; writeStructure(preset);
    ['density','molarMass','valence','bandGap'].forEach((id,i) => { $(id).value = preset.material[i]; });
    ['millerH','millerK','surfacePhase'].forEach(id => { $(id).value = 0; }); $('millerL').value = 1;
    peakState = []; symbolsKey = ''; $('importStatus').textContent = ''; calculate();
  }
  $('samplePreset').addEventListener('change', event => applyPreset(event.target.value));
  $('photonPreset').addEventListener('change', event => { if (event.target.value !== 'custom') { $('photonEnergy').value = event.target.value; calculate(); } });
  $('photonEnergy').addEventListener('input', () => { $('photonPreset').value = [...$('photonPreset').options].some(option => option.value === $('photonEnergy').value) ? $('photonEnergy').value : 'custom'; });
  ['density','molarMass','valence','bandGap','latticeVectors','atomicSites'].forEach(id => $(id).addEventListener('input', () => { $('samplePreset').value = 'custom'; }));
  ['photonEnergy','workFunction','emissionAngle','density','molarMass','valence','bandGap','latticeVectors','atomicSites','millerH','millerK','millerL','surfacePhase','sampleThickness','photonFlux','acquisitionTime','solidAngle','detectionEfficiency','transmissionExponent'].forEach(id => $(id).addEventListener('input', scheduleCalculation));
  $('enableCounts').addEventListener('change', calculate);
  $('recalculate').addEventListener('click', calculate);
  $('showAttenuation').addEventListener('click', () => { plotMode = 'attenuation'; renderPlots(); });
  $('showAreas').addEventListener('click', () => { plotMode = 'areas'; renderPlots(); });
  $('structureFile').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 2e6) throw new Error('構造ファイルは2 MB以下にしてください。');
      const structure = model.parseStructure(await file.text());
      structure.atoms.forEach(atom => { if (!Object.hasOwn(coreLevels, atom.symbol)) throw new Error(`${atom.symbol}は結合エネルギーデータにありません。`); });
      writeStructure(structure); $('samplePreset').value = 'custom'; peakState = []; symbolsKey = '';
      $('importStatus').classList.remove('error'); $('importStatus').textContent = `${file.name}: ${structure.atoms.length}原子を読み込みました。材料のρ・M・Nv・Egと表面方位を試料に合わせて更新してください。`;
      calculate();
    } catch (error) { $('importStatus').classList.add('error'); $('importStatus').textContent = `読み込み失敗：${error.message} 現在の構造は保持されています。`; }
    event.target.value = '';
  });
  $('exportResults').addEventListener('click', () => {
    if (!latest) return;
    const { input, prediction } = latest;
    const metadata = [
      ['model','TPP-2M nonrelativistic, homogeneous periodic slab'], ['energy_convention','Ekin = photon - binding - work function; same E used for IMFP'],
      ['photon_eV',input.photonEnergy], ['work_function_eV',input.workFunction], ['angle_from_normal_deg',input.angle],
      ['density_g_cm3',input.material.density], ['molar_mass_g_mol',input.material.molarMass], ['Nv',input.material.valence], ['gap_eV',input.material.gap],
      ['hkl',prediction.surface.indices.join(' ')], ['surface_phase',input.phase], ['thickness_nm',input.thickness], ['unit_cell_volume_A3',prediction.surface.volume], ['spacing_nm',prediction.surface.spacing],
      ['counts_enabled',input.instrument.enabled], ['photons_per_s',input.instrument.flux], ['time_s',input.instrument.time], ['solid_angle_sr',input.instrument.solidAngle], ['efficiency_1keV',input.instrument.efficiency], ['transmission_exponent',input.instrument.exponent],
      ['incomplete_area_normalization',prediction.incomplete], ['imfp_source','https://www.nist.gov/system/files/documents/srd/SRD71UsersGuideV1-2.pdf'], ['cross_section_source','https://doi.org/10.6084/m9.figshare.12389750.v3']
    ];
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
  applyPreset('si');
}());
