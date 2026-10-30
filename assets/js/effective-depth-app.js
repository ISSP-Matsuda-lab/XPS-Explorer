(function startEffectiveDepthApp() {
  'use strict';
  const $ = id => document.getElementById(id);
  const fields = { method: 'ealMethod', energy: 'ealEnergy', imfp: 'ealImfp', transportMfp: 'ealTransport', manualEal: 'ealManual', angle: 'ealAngle', halfAngle: 'ealHalfAngle', depth: 'ealProbeDepth' };
  const storageKey = 'xps-eal-depth.workspace.v1';
  const read = () => Object.fromEntries(Object.entries(fields).map(([key, id]) => [key, $(id).value]));
  const defaults = read();
  let latest = null, timer = null;
  const fmt = value => value.toLocaleString('en-US', { maximumFractionDigits: 3 });
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, fields: read() })); $('ealStorageStatus').hidden = true; }
    catch { $('ealStorageStatus').textContent = 'ブラウザーに保存できませんでした。必要な結果はCSVで保存してください。'; $('ealStorageStatus').hidden = false; }
  }
  function restore(state) {
    Object.entries(fields).forEach(([key, id]) => { if (typeof state[key] === 'string') $(id).value = state[key]; });
  }
  const node = (tag, attrs, text) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
    if (text !== undefined) element.textContent = text;
    return element;
  };
  function angles(result) {
    const half=result.halfAngle*Math.PI/180,theta=result.angle*Math.PI/180;
    $('ealSolidAngle').textContent=(2*Math.PI*(1-Math.cos(half))).toPrecision(5);
    const svg=$('angleDiagram');svg.replaceChildren();
    const x=145,y=195,length=160,point=angle=>[x+length*Math.sin(angle),y-length*Math.cos(angle)];
    const lo=point(theta-half),hi=point(theta+half),center=point(theta);
    svg.append(node('rect',{x:20,y,width:400,height:28,fill:'#77e4c811'}));
    svg.append(node('line',{x1:20,y1:y,x2:420,y2:y,stroke:'#77e4c8','stroke-width':2}));
    svg.append(node('path',{d:'M'+x+','+y+' L'+lo.join(',')+' L'+hi.join(',')+' Z',fill:'#90b9ff33'}));
    svg.append(node('line',{x1:x,y1:y,x2:x,y2:20,stroke:'#8eaaa7','stroke-dasharray':'5 4'}));
    svg.append(node('line',{x1:x,y1:y,x2:center[0],y2:center[1],stroke:'#90b9ff','stroke-width':2}));
    svg.append(node('path',{d:'M'+x+','+(y-45)+' A45,45 0 0,1 '+(x+45*Math.sin(theta))+','+(y-45*Math.cos(theta)),fill:'none',stroke:'#ffb45d','stroke-width':2}));
    svg.append(node('text',{x:20,y:239,fill:'#8eaaa7','font-size':12},'Sample surface'));
    svg.append(node('text',{x:30,y:20,fill:'#8eaaa7','font-size':12},'Surface normal'));
    svg.append(node('text',{x:245,y:25,fill:'#90b9ff','font-size':12},'Analyzer axis'));
    svg.append(node('text',{x:245,y:48,fill:'#90b9ff','font-size':12},'α = '+fmt(result.halfAngle)+'°'));
    svg.append(node('text',{x:x+12,y:y-63,fill:'#ffb45d','font-size':12},'θ = '+fmt(result.angle)+'°'));
  }
  function plot(result) {
    const svg = $('ealPlot'); svg.replaceChildren();
    const width = Math.max(340, svg.getBoundingClientRect().width), height = 340;
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    const left = 48, right = width - 20, top = 42, bottom = 280;
    const maximum = Math.max(result.corrected.d99, result.straight.d99) * 1.08;
    const x = depth => left + depth / maximum * (right - left);
    const y = fraction => bottom - fraction * (bottom - top);
    for (let i = 0; i <= 4; i++) {
      svg.append(node('line', { x1: left, x2: right, y1: y(i / 4), y2: y(i / 4), stroke: '#244044' }));
      svg.append(node('text', { x: left - 8, y: y(i / 4) + 4, fill: '#8eaaa7', 'text-anchor': 'end', 'font-size': 11 }, (i * 25) + '%'));
      svg.append(node('text', { x: x(maximum * i / 4), y: bottom + 22, fill: '#8eaaa7', 'text-anchor': 'middle', 'font-size': 11 }, fmt(maximum * i / 4)));
    }
    [['straight', '#90b9ff', 'IMFPのみ', 155], ['corrected', '#77e4c8', 'EAL', 48]].forEach(([key, color, label, offset]) => {
      const points = Array.from({ length: 141 }, (_, i) => {
        const depth = maximum * i / 140;
        return (i ? 'L' : 'M') + x(depth).toFixed(2) + ',' + y(result[key].cumulative(depth)).toFixed(2);
      }).join(' ');
      svg.append(node('path', { d: points, fill: 'none', stroke: color, 'stroke-width': 2.5, ...(key === 'straight' ? { 'stroke-dasharray': '5 4' } : {}) }));
      svg.append(node('text', { x: offset, y: 20, fill: color, 'font-size': 12 }, label));
    });
    svg.append(node('line', { x1: x(result.corrected.d95), x2: x(result.corrected.d95), y1: top, y2: bottom, stroke: '#77e4c866', 'stroke-dasharray': '3 4' }));
    svg.append(node('text', { x: (left + right) / 2, y: 329, fill: '#8eaaa7', 'text-anchor': 'middle', 'font-size': 12 }, '表面法線方向の深さ / nm'));
  }
  function calculate(persist = true) {
    clearTimeout(timer);
    const input = read(), manual = input.method === 'manual';
    $('ealTransport').disabled = manual; $('ealManual').disabled = !manual;
    try {
      const result = EffectiveDepth.calculate(input);
      latest = { input, result }; $('ealError').hidden = true; $('exportEal').disabled = false;
      $('ealValue').textContent = fmt(result.eal);
      $('ealMean').textContent = fmt(result.corrected.mean);
      $('ealFraction').textContent = fmt(result.fraction * 100);
      $('ealStatus').textContent = manual ? '外部EALを使った指数減衰モデル。EALがこの材料・エネルギー・測定配置に対応することを確認してください。' : '輸送近似 · ω = ' + fmt(result.albedo) + ' · 光源−分析器角54°の平均EALを使用。';
      $('ealDepthRows').replaceChildren();
      [50, 90, 95, 99].forEach(percent => {
        const row = document.createElement('tr'); row.dataset.depth = percent;
        [percent + '%', fmt(result.corrected['d' + percent]), fmt(result.straight['d' + percent])].forEach(text => { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); });
        $('ealDepthRows').append(row);
      });
      plot(result); angles(result);
    } catch (error) {
      latest = null; $('exportEal').disabled = true; $('ealError').hidden = false; $('ealError').textContent = error.message;
      ['ealValue', 'ealMean', 'ealFraction'].forEach(id => { $(id).textContent = '—'; });
      $('ealStatus').textContent = '入力条件を修正すると結果が更新されます。';
      $('ealPlot').replaceChildren(); $('ealDepthRows').replaceChildren();
      $('angleDiagram').replaceChildren(); $('ealSolidAngle').textContent='—';
    }
    if (persist) save();
  }
  Object.values(fields).forEach(id => $(id).addEventListener('input', () => {
    latest = null; $('exportEal').disabled = true; clearTimeout(timer); save(); timer = setTimeout(calculate, 150);
  }));
  $('calculateEal').addEventListener('click', () => calculate());
  $('resetEal').addEventListener('click', () => { restore(defaults); calculate(); });
  window.addEventListener('pagehide', save);
  window.addEventListener('resize', () => { if (latest) plot(latest.result); });
  $('exportEal').addEventListener('click', () => {
    if (!latest) return;
    const { input, result } = latest;
    const rows = [
      ['parameter', 'value'], ['model', input.method === 'transport' ? 'L = IMFP * (1 - 0.735 * IMFP / (IMFP + TMFP))' : 'External EAL; exponential depth model'],
      ['source', 'https://www.nist.gov/system/files/documents/srd/SRD82UsersGuideV1-3.pdf'],
      ['energy_eV', input.energy], ['IMFP_nm', input.imfp], ['TMFP_nm', input.method === 'transport' ? input.transportMfp : ''],
      ['EAL_nm', result.eal], ['angle_from_normal_deg', input.angle], ['acceptance_half_angle_deg', input.halfAngle],
      ['angular_weight', 'Uniform per solid angle in detector cone'], ['sample', 'Uniform semi-infinite emitter'],
      ['source_analyzer_angle_deg', input.method === 'transport' ? 54 : 'external EAL must match geometry'],
      ['mean_depth_nm', result.corrected.mean], ['probe_depth_nm', input.depth], ['probe_cumulative_fraction', result.fraction],
      [], ['fraction', 'EAL_depth_nm', 'IMFP_only_depth_nm'],
      ...[50, 90, 95, 99].map(p => [p / 100, result.corrected['d' + p], result.straight['d' + p]]),
      [], ['depth_nm', 'EAL_cumulative_fraction', 'IMFP_only_cumulative_fraction']
    ];
    const max = Math.max(result.corrected.d99, result.straight.d99) * 1.08;
    for (let i = 0; i <= 100; i++) { const z = max * i / 100; rows.push([z, result.corrected.cumulative(z), result.straight.cumulative(z)]); }
    const csv = '\uFEFF' + rows.map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'xps-effective-depth.csv'; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved?.version !== 1 || !saved.fields || typeof saved.fields !== 'object') throw new Error('Unsupported state');
      restore(saved.fields);
    }
  } catch { $('ealStorageStatus').textContent = '保存内容を復元できませんでした。初期状態で表示しています。'; $('ealStorageStatus').hidden = false; }
  calculate(false);
}());
