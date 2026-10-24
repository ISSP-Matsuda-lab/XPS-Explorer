(function attachEscapeDepth(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.EscapeDepth = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createEscapeDepth() {
  'use strict';
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const norm = a => Math.hypot(...a);
  const wrap = value => { const result = ((value % 1) + 1) % 1; return result < 1e-9 || result > 1-1e-9 ? 0 : result; };
  function number(value, name, min = -Infinity, max = Infinity) {
    if (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) {
      throw new Error(`${name}: ${min === -Infinity ? '' : min + ' ≤ '}有限の数値${max === Infinity ? '' : ' ≤ ' + max}を入力してください。`);
    }
    return Number(value);
  }
  function positive(value, name) {
    const result = number(value, name, 0);
    if (result === 0) throw new Error(`${name}は0より大きくしてください。`);
    return result;
  }
  function materialParameters(material) {
    const density = positive(material.density, '密度 ρ');
    const molarMass = positive(material.molarMass, 'モル質量 M');
    const valence = positive(material.valence, '価電子数 Nv');
    const gap = number(material.gap, 'バンドギャップ Eg', 0);
    const u = valence * density / molarMass;
    const ep = 28.816 * Math.sqrt(u);
    return { density, molarMass, valence, gap, ep,
      beta: -1 + 9.44 / Math.hypot(ep, gap) + 0.69 * density ** 0.1,
      gamma: 0.191 / Math.sqrt(density), c: 19.7 - 9.1 * u, d: 534 - 208 * u };
  }
  // nm coefficient convention, equivalent to the NIST angstrom equation / 10.
  function imfp(energy, material) {
    const e = positive(energy, '運動エネルギー');
    const p = materialParameters(material);
    const result = e / (p.ep ** 2 * (p.beta * Math.log(p.gamma * e) - p.c / e + p.d / e ** 2));
    if (!Number.isFinite(result) || result <= 0) throw new Error('この材料・エネルギーではTPP-2Mの正の解が得られません。');
    return result;
  }
  function latticeGeometry(lattice) {
    if (!Array.isArray(lattice) || ![2,3].includes(lattice.length) || lattice.some(row => !Array.isArray(row) || row.length !== 3)) throw new Error('格子ベクトルは2行または3行、各行にx y zを入力してください。');
    const vectors = lattice.map(row => row.map(v => number(v, '格子ベクトル')));
    if (vectors.length === 2) vectors.push([0,0,0]);
    const pair = [[0,1],[0,2],[1,2]].find(([i,j]) => norm(cross(vectors[i],vectors[j])) > 1e-10 * Math.max(1,norm(vectors[i])*norm(vectors[j])));
    if (!pair) throw new Error('面積が0です。面を張る独立な2本以上の格子ベクトルを入力してください。');
    const signedVolume = dot(vectors[0], cross(vectors[1], vectors[2]));
    if (Math.abs(signedVolume) <= 1e-10 * Math.max(1,norm(vectors[0])*norm(vectors[1])*norm(vectors[2]))) {
      const [i,j] = pair, normal = cross(vectors[i],vectors[j]), area = norm(normal);
      const reciprocal = [[0,0,0],[0,0,0],[0,0,0]];
      reciprocal[i] = cross(vectors[j],normal).map(v=>v/(area*area));
      reciprocal[j] = cross(normal,vectors[i]).map(v=>v/(area*area));
      return { vectors, volume:0, dimension:2, reciprocal, plane:{indices:pair,area,normal:normal.map(v=>v/area)} };
    }
    return { vectors, volume: Math.abs(signedVolume), dimension:3, reciprocal: [cross(vectors[1], vectors[2]), cross(vectors[2], vectors[0]), cross(vectors[0], vectors[1])].map(v => v.map(x => x / signedVolume)) };
  }
  function normalizedFractional(frac, geometry) {
    const values = frac.map(v => number(v, '分率座標'));
    if (geometry.dimension === 3) return values.map(wrap);
    const position = [0,1,2].map(axis=>dot(values,geometry.vectors.map(row=>row[axis])));
    // Canonical coordinates on the selected 2D cell also detect duplicate
    // physical sites that differ only along a zero/redundant lattice vector.
    return geometry.reciprocal.map(v=>wrap(dot(v,position)));
  }
  function validateStructure(structure) {
    const geometry = latticeGeometry(structure.lattice);
    if (!Array.isArray(structure.atoms) || !structure.atoms.length || structure.atoms.length > 10000) throw new Error('原子数は1〜10000個にしてください。');
    const sites = new Map();
    const atoms = structure.atoms.map(atom => {
      if (!/^[A-Z][a-z]?$/.test(atom.symbol)) throw new Error(`元素記号が不正です: ${atom.symbol}`);
      if (!Array.isArray(atom.frac) || atom.frac.length !== 3) throw new Error('分率座標はx, y, zの3値が必要です。');
      const frac = normalizedFractional(atom.frac, geometry);
      const occupancy = number(atom.occupancy ?? 1, '占有率', 0, 1);
      const key = frac.map(v => v.toFixed(7)).join(',');
      sites.set(key, (sites.get(key) || 0) + occupancy);
      if (sites.get(key) > 1.000001) throw new Error('同じ位置の占有率の合計が1を超えています。境界原子の重複を除いてください。');
      return { symbol: atom.symbol, frac, occupancy };
    });
    if (!atoms.some(atom => atom.occupancy > 0)) throw new Error('占有率が正の原子を入力してください。');
    return { ...structure, lattice: geometry.vectors, atoms, ...geometry };
  }
  function parseLattice(text) {
    const rows = text.trim().split(/\r?\n/).filter(line => line.trim()).map(line => line.trim().split(/[\s,]+/));
    return latticeGeometry(rows).vectors;
  }
  function parseAtoms(text) {
    return text.split(/\r?\n/).map(line => line.split('#')[0].trim()).filter(Boolean).map((line, index) => {
      const parts = line.split(/[\s,]+/);
      if (parts.length < 4 || parts.length > 5) throw new Error(`原子行${index + 1}: 元素 x y z [占有率] の形式にしてください。`);
      return { symbol: parts[0], frac: parts.slice(1, 4).map(v => number(v, '分率座標')), occupancy: number(parts[4] ?? 1, '占有率', 0, 1) };
    });
  }
  const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
  function surfaceGeometry(structure, miller, phase, thickness) {
    const crystal = validateStructure(structure);
    const depth = crystal.dimension === 2 ? 0 : number(thickness, '試料厚さ', 0, 10000);
    if (crystal.dimension === 2) {
      const area = crystal.plane.area / 100; // Å² -> nm²; no division by volume.
      const sites = crystal.atoms.filter(a=>a.occupancy>0).map(atom=>({...atom,firstDepth:0,count:1,arealDensity:atom.occupancy/area}));
      return { crystal, indices:null, spacing:null, thickness:0, sites, volume:0, mode:'sheet', area };
    }
    if (!Array.isArray(miller) || miller.length !== 3) throw new Error('面指数はh k lの3値が必要です。');
    let indices = miller.map(v => number(v, 'Miller指数', -30, 30));
    if (indices.some(v => !Number.isInteger(v)) || indices.every(v => v === 0)) throw new Error('Miller指数は整数で、(0 0 0)以外を指定してください。');
    const divisor = indices.reduce((value, next) => gcd(value, next), 0);
    indices = indices.map(v => v / divisor);
    const reciprocalNormal = [0, 1, 2].map(axis => indices.reduce((sum, value, i) => sum + value * crystal.reciprocal[i][axis], 0));
    const spacingAngstrom = 1 / norm(reciprocalNormal);
    const spacing = spacingAngstrom / 10;
    const isSheet = depth === 0;
    const termination = isSheet ? 0 : number(phase, '終端位相', 0, 1);
    // A primitive (hkl) repeat has volume V, height d_hkl and area V/d_hkl.
    // Each basis site therefore has areal density d_hkl/V (Å^-2).
    const sites = crystal.atoms.filter(a => a.occupancy > 0).map(atom => {
      // A 2D input cell is one sheet: every basis site contributes once, with
      // no vacuum-cell repeats or dependence on its position along the normal.
      const firstDepth = isSheet ? 0 : wrap(termination - dot(indices, atom.frac)) * spacing;
      const ratio = (depth - firstDepth) / spacing;
      const count = isSheet ? 1 : Math.max(0, Math.ceil(ratio - 1e-10)); // half-open slab: 0 <= z < thickness
      return { ...atom, firstDepth, count, arealDensity: atom.occupancy * spacingAngstrom / crystal.volume * 100 };
    });
    return { crystal, indices, spacing, thickness: depth, sites, volume: crystal.volume,
      mode: isSheet ? 'sheet' : 'slab', area: crystal.volume / spacingAngstrom / 100 };
  }
  function attenuation(depth, lambda, angle) {
    const z = number(depth, '深さ', 0);
    const length = positive(lambda, 'IMFP');
    const theta = number(angle, '検出角度', 0, 89.9) * Math.PI / 180;
    return Math.exp(-z / (length * Math.cos(theta)));
  }
  function siteSignal(site, spacing, lambda, angle) {
    if (!site.count) return 0;
    const length = positive(lambda, 'IMFP') * Math.cos(number(angle, '検出角度', 0, 89.9) * Math.PI / 180);
    const step = spacing / length;
    const geometricSum = -Math.expm1(-site.count * step) / -Math.expm1(-step);
    return site.arealDensity * Math.exp(-site.firstDepth / length) * geometricSum;
  }
  function predict({ structure, material, photonEnergy, workFunction, angle, miller, phase, thickness, peaks, instrument, imfpModel = 'tpp' }, crossSection, dielectricCalculator) {
    const photon = positive(photonEnergy, '励起光エネルギー');
    const phi = number(workFunction, '仕事関数', 0);
    number(angle, '検出角度', 0, 89.9);
    const surface = surfaceGeometry(structure, miller, phase, thickness);
    if (!['tpp','dielectric'].includes(imfpModel)) throw new Error('IMFPの計算方法を選択してください。');
    if (surface.mode === 'slab' && imfpModel === 'tpp') materialParameters(material);
    let calibration = null;
    if (instrument?.enabled) {
      calibration = {
        flux: positive(instrument.flux, '光子数 / s'), time: positive(instrument.time, '積算時間'),
        solidAngle: number(instrument.solidAngle, '検出立体角', 0, 4 * Math.PI),
        efficiency: number(instrument.efficiency, '検出効率', 0, 1),
        exponent: number(instrument.exponent, '透過関数指数', -5, 5)
      };
    }
    const rows = peaks.filter(peak => peak.enabled !== false).map(peak => {
      const bindingEnergy = number(peak.bindingEnergy, '結合エネルギー', 0);
      const energy = photon - bindingEnergy - phi;
      const base = { ...peak, bindingEnergy, energy, lambda: null, sigma: null, area: null, counts: null, effectiveAtoms: null, status: [], crossSectionMethod: '', imfpMethod: '' };
      if (energy <= 0) return { ...base, area: 0, counts: calibration ? 0 : null, status: ['励起不可'] };
      const manualLambda = peak.lambda != null && peak.lambda !== '';
      if (manualLambda) { base.lambda = positive(peak.lambda, `${peak.symbol} ${peak.label} IMFP`); base.imfpMethod = '手入力'; }
      else if (imfpModel === 'dielectric') {
        try {
          if (typeof dielectricCalculator !== 'function') throw new Error('損失関数データを入力してください。');
          const result = dielectricCalculator(energy);
          base.lambda = positive(result.lambda,'誘電関数IMFP'); base.imfpMethod = result.method;
          base.status.push(...(result.warnings || []));
        } catch (error) { base.status.push(error.message); }
      }
      else if (energy < 50 || energy > 10000) base.status.push('IMFP範囲外（手入力可）');
      else {
        try { base.lambda = imfp(energy, material); base.imfpMethod = energy > 2000 ? 'TPP-2M 外挿' : 'TPP-2M'; }
        catch { base.status.push('TPP-2M適用不可'); }
      }
      if (base.imfpMethod.includes('外挿')) base.status.push('IMFP外挿 > 2 keV');
      if (peak.sigma != null && peak.sigma !== '') { base.sigma = number(peak.sigma, '断面積 σ', 0); base.crossSectionMethod = '手入力'; }
      else {
        const sigma = crossSection(peak.symbol, peak.label, photon);
        if (sigma) { base.sigma = sigma.value; base.crossSectionMethod = sigma.method; if (sigma.method === 'extrapolated') base.status.push('断面積外挿'); }
        else base.status.push('断面積データなし（手入力可）');
      }
      if (surface.mode === 'sheet') base.informationDepth = 0;
      else if (base.lambda != null) base.informationDepth = -Math.log(0.05) * base.lambda * Math.cos(angle * Math.PI / 180);
      if ((surface.mode === 'sheet' || base.lambda != null) && base.sigma != null) {
        const sites = surface.sites.filter(site => site.symbol === peak.symbol);
        if (surface.mode === 'sheet') {
          base.effectiveAtoms = sites.reduce((sum, site) => sum + site.arealDensity, 0);
        } else {
          base.effectiveAtoms = sites.reduce((sum, site) => sum + siteSignal(site, surface.spacing, base.lambda, angle), 0);
        }
        base.area = base.sigma * 1e-4 * base.effectiveAtoms; // Mb -> nm²
        if (calibration) {
          const efficiency = calibration.efficiency * (energy / 1000) ** calibration.exponent;
          if (efficiency > 1 + 1e-12) base.status.push('透過関数 > 1：カウント算出不可');
          else base.counts = base.area * calibration.flux * calibration.time * calibration.solidAngle / (4 * Math.PI) * efficiency;
        }
      }
      return base;
    });
    const total = rows.reduce((sum, row) => sum + (row.area ?? 0), 0);
    rows.forEach(row => { row.fraction = row.area == null || total === 0 ? null : row.area / total; });
    return { surface, rows, total, incomplete: rows.some(row => row.area == null), calibration };
  }
  function parsePoscar(text) {
    const lines = text.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length < 9) throw new Error('POSCARの行数が不足しています。');
    const scale = number(lines[1], 'POSCAR scale');
    if (scale === 0) throw new Error('POSCAR scaleは0以外にしてください。');
    const raw = lines.slice(2, 5).map(line => line.split(/\s+/).slice(0, 3).map(Number));
    const geometry = latticeGeometry(raw);
    if (scale < 0 && geometry.dimension === 2) throw new Error('体積0のPOSCARには負の体積スケールを使えません。正の倍率を指定してください。');
    const factor = scale < 0 ? Math.cbrt(-scale / geometry.volume) : scale;
    const lattice = raw.map(row => row.map(v => v * factor));
    const symbols = lines[5].split(/\s+/);
    if (!symbols.every(s => /^[A-Z][a-z]?$/.test(s))) throw new Error('元素記号行のあるVASP 5形式のPOSCARを指定してください。');
    const counts = lines[6].split(/\s+/).map(v => number(v, '原子数', 0, 10000));
    if (counts.length !== symbols.length || counts.some(v => !Number.isInteger(v))) throw new Error('元素と原子数が一致しません。');
    const total = counts.reduce((sum, count) => sum + count, 0);
    if (total > 10000) throw new Error('原子数は10000以下にしてください。');
    let cursor = 7;
    if (/^s/i.test(lines[cursor])) cursor++;
    const direct = /^d/i.test(lines[cursor]);
    if (!direct && !/^[ck]/i.test(lines[cursor])) throw new Error('DirectまたはCartesian座標を指定してください。');
    cursor++;
    const scaledGeometry = latticeGeometry(lattice), reciprocal = scaledGeometry.reciprocal;
    const atoms = [];
    symbols.forEach((symbol, i) => {
      for (let j = 0; j < counts[i]; j++) {
        if (!lines[cursor]) throw new Error('POSCARの原子座標が不足しています。');
        const xyz = lines[cursor++].split(/\s+/).slice(0, 3).map(v => number(v, '原子座標'));
        if (xyz.length !== 3) throw new Error('原子座標は3成分が必要です。');
        if (!direct && scaledGeometry.dimension === 2 && Math.abs(dot(xyz.map(x=>x*factor),scaledGeometry.plane.normal)) > 1e-7) throw new Error('2次元POSCARのCartesian原子座標は格子が張る平面上に指定してください。');
        atoms.push({ symbol, frac: direct ? xyz : reciprocal.map(v => dot(v, xyz.map(x => x * factor))), occupancy: 1 });
      }
    });
    return validateStructure({ name: lines[0], lattice, atoms });
  }
  // CIF tokenizer: quotes, comments and semicolon text fields; never evaluate input as code.
  function cifTokens(text) {
    const tokens = [];
    const lines = text.replace(/\r/g, '').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(';')) {
        let value = lines[i].slice(1);
        while (++i < lines.length && !lines[i].startsWith(';')) value += '\n' + lines[i];
        if (i === lines.length) throw new Error('CIFの複数行文字列が閉じられていません。');
        tokens.push({ value, quoted: true });
        continue;
      }
      const line = lines[i]; let j = 0;
      while (j < line.length) {
        if (/\s/.test(line[j])) { j++; continue; }
        if (line[j] === '#') break;
        const quote = line[j] === '"' || line[j] === "'" ? line[j++] : null;
        let value = '';
        if (quote) {
          while (j < line.length && !(line[j] === quote && (j + 1 === line.length || /\s/.test(line[j + 1])))) value += line[j++];
          if (j === line.length) throw new Error('CIFの引用符が閉じられていません。');
          j++;
        } else { while (j < line.length && !/\s/.test(line[j])) value += line[j++]; }
        tokens.push({ value, quoted: Boolean(quote) });
      }
    }
    return tokens;
  }
  function cifNumber(value, name) { return number(String(value ?? '').replace(/\(\d+\)(?=([eE][+-]?\d+)?$)/, ''), name); }
  function symmetryOperation(operation, frac) {
    const axes = operation.toLowerCase().replace(/\s/g, '').split(',');
    if (axes.length !== 3) throw new Error(`未対応のCIF対称操作: ${operation}`);
    return axes.map(axis => {
      const terms = axis.match(/[+-]?[^+-]+/g) || [];
      if (!terms.length || terms.join('') !== axis) throw new Error(`不正な対称操作: ${operation}`);
      return wrap(terms.reduce((sum, term) => {
        const variable = term.match(/^([+-]?)([xyz])$/);
        if (variable) return sum + (variable[1] === '-' ? -1 : 1) * frac['xyz'.indexOf(variable[2])];
        if (!/^[+-]?\d+(?:\.\d+)?(?:\/\d+)?$/.test(term)) throw new Error(`未対応のCIF対称操作: ${operation}`);
        const [numerator, denominator = '1'] = term.split('/');
        return sum + number(numerator, '対称操作') / positive(denominator, '対称操作の分母');
      }, 0));
    });
  }
  function parseCif(text) {
    const tokens = cifTokens(text), tags = {}, loops = [];
    const isControl = token => token && !token.quoted && /^(?:_|data_|loop_|stop_|save_|global_)/i.test(token.value);
    const blocks = tokens.filter(t => !t.quoted && /^data_/i.test(t.value));
    if (blocks.length !== 1) throw new Error('CIFは1つのdata_ブロックを含むファイルを指定してください。');
    for (let i = 0; i < tokens.length;) {
      const token = tokens[i++];
      if (!token.quoted && token.value.toLowerCase() === 'loop_') {
        const headers = []; while (tokens[i] && !tokens[i].quoted && tokens[i].value.startsWith('_')) headers.push(tokens[i++].value.toLowerCase());
        const values = []; while (tokens[i] && !isControl(tokens[i])) values.push(tokens[i++].value);
        if (!headers.length || values.length % headers.length) throw new Error('CIFのloop_列数と値の数が一致しません。');
        const rows = []; for (let j = 0; j < values.length; j += headers.length) rows.push(Object.fromEntries(headers.map((header, k) => [header, values[j + k]])));
        loops.push(rows);
      } else if (!token.quoted && token.value.startsWith('_')) {
        if (!tokens[i] || isControl(tokens[i])) throw new Error(`CIFの値が不足しています: ${token.value}`);
        tags[token.value.toLowerCase()] = tokens[i++].value;
      }
    }
    const a = positive(cifNumber(tags._cell_length_a, 'a'), 'a'), b = positive(cifNumber(tags._cell_length_b, 'b'), 'b'), c = number(cifNumber(tags._cell_length_c, 'c'), 'c', 0);
    const [alpha, beta, gamma] = ['alpha', 'beta', 'gamma'].map(key => {
      const value = cifNumber(tags['_cell_angle_' + key], key);
      if (value <= 0 || value >= 180) throw new Error('格子角は0〜180°の範囲内にしてください。');
      return value * Math.PI / 180;
    });
    const cy = c * (Math.cos(alpha) - Math.cos(beta) * Math.cos(gamma)) / Math.sin(gamma);
    const cz2 = c*c - (c*Math.cos(beta))**2 - cy*cy;
    if (cz2 < -1e-10 * Math.max(1,c*c)) throw new Error('CIFの格子長と角度が矛盾しています。');
    const lattice = [[a, 0, 0], [b*Math.cos(gamma), b*Math.sin(gamma), 0], [c*Math.cos(beta), cy, Math.sqrt(cz2 <= 1e-10 * Math.max(1,c*c) ? 0 : cz2)]];
    const geometry = latticeGeometry(lattice);
    const allRows = [tags, ...loops.flat()];
    let operations = allRows.map(row => row._space_group_symop_operation_xyz || row._symmetry_equiv_pos_as_xyz).filter(Boolean);
    if (!operations.length) {
      const group = tags._space_group_it_number || tags._symmetry_int_tables_number;
      const symbol = (tags['_space_group_name_h-m_alt'] || tags['_symmetry_space_group_name_h-m'] || '').replace(/\s/g, '').toUpperCase();
      if (group !== '1' && symbol !== 'P1') throw new Error('CIFに対称操作がありません。対称操作を含むCIF、P1に展開済みのCIF、またはPOSCARを指定してください。');
      operations = ['x,y,z'];
    }
    if (operations.length > 384) throw new Error('CIFの対称操作数が多すぎます。');
    const atomRows = loops.flat().filter(row => '_atom_site_fract_x' in row);
    if (!atomRows.length) throw new Error('CIFに原子の分率座標がありません。');
    if (atomRows.length * operations.length > 200000) throw new Error('CIFが大きすぎます。展開済みPOSCARを使用してください。');
    const atoms = [];
    atomRows.forEach(row => {
      const symbol = (row._atom_site_type_symbol || row._atom_site_label || '').match(/^[A-Z][a-z]?/)?.[0];
      if (!symbol) throw new Error('CIFから元素記号を読み取れません。');
      const frac = ['x','y','z'].map(axis => cifNumber(row['_atom_site_fract_' + axis], '分率座標'));
      const occupancy = row._atom_site_occupancy == null ? 1 : cifNumber(row._atom_site_occupancy, '占有率');
      const unique = new Map();
      operations.forEach(operation => {
        const transformed = normalizedFractional(symmetryOperation(operation, frac), geometry);
        unique.set(transformed.map(v => v.toFixed(7)).join(','), transformed);
      });
      unique.forEach(position => atoms.push({ symbol, frac: position, occupancy }));
    });
    return validateStructure({ name: blocks[0].value.slice(5), lattice, atoms });
  }
  function parseStructure(text) {
    if (text.length > 2e6) throw new Error('構造ファイルは2 MB以下にしてください。');
    return /^\s*data_/im.test(text) ? parseCif(text) : parsePoscar(text);
  }
  return { imfp, materialParameters, parseLattice, parseAtoms, validateStructure, latticeGeometry, surfaceGeometry, attenuation, siteSignal, predict, parsePoscar, parseCif, parseStructure };
}));
