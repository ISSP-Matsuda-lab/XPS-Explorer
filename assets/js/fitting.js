(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.XPSFitting = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LN2 = Math.log(2);

  function peakValue(type, x, peak) {
    const width = Math.max(Math.abs(peak.width), 1e-9);
    const z = (x - peak.center) / width;
    if (type === 'gaussian') return peak.height * Math.exp(-4 * LN2 * z * z);
    if (type === 'lorentzian') return peak.height / (1 + 4 * z * z);
    if (type === 'voigt') {
      const eta = Math.max(0, Math.min(1, peak.shape == null ? 0.5 : peak.shape));
      const gaussian = Math.exp(-4 * LN2 * z * z);
      const lorentzian = 1 / (1 + 4 * z * z);
      return peak.height * (eta * lorentzian + (1 - eta) * gaussian);
    }
    const alpha = Math.max(0, Math.min(0.45, peak.shape == null ? 0.08 : peak.shape));
    const u = 2 * z;
    const numerator = Math.cos(Math.PI * alpha / 2 + (1 - alpha) * Math.atan(u));
    const denominator = Math.pow(1 + u * u, (1 - alpha) / 2) * Math.max(Math.cos(Math.PI * alpha / 2), 1e-9);
    return peak.height * Math.max(0, numerator / denominator);
  }

  function peakModel(type, x, parameters) {
    const backgroundType = parameters.backgroundType || 'linear';
    let value = backgroundType === 'none' ? 0 : parameters.background;
    if (backgroundType === 'linear') value += parameters.slope * (x - parameters.origin);
    parameters.peaks.forEach((peak) => { value += peakValue(type, x, peak); });
    return value;
  }

  function evaluatePeakSeries(type, points, parameters) {
    const signal = points.map(([x]) => parameters.peaks.reduce((sum, peak) => sum + peakValue(type, x, peak), 0));
    let background;
    if (parameters.backgroundType === 'none') background = points.map(() => 0);
    else if (parameters.backgroundType === 'constant') background = points.map(() => parameters.background);
    else if (parameters.backgroundType === 'shirley') {
      const cumulative = Array(points.length).fill(0);
      for (let index = points.length - 2; index >= 0; index -= 1) {
        const width = Math.abs(points[index + 1][0] - points[index][0]);
        cumulative[index] = cumulative[index + 1] + width * (signal[index] + signal[index + 1]) / 2;
      }
      const total = Math.max(cumulative[0], 1e-12), left = parameters.background, right = parameters.backgroundRight;
      background = cumulative.map((value) => right + (left - right) * value / total);
    } else background = points.map(([x]) => parameters.background + parameters.slope * (x - parameters.origin));
    return {
      signal,
      background,
      total: signal.map((value, index) => value + background[index]),
      components: parameters.peaks.map((peak) => points.map(([x], index) => background[index] + peakValue(type, x, peak)))
    };
  }

  function fermiModel(x, parameters) {
    const scale = Math.max(parameters.width / (2 * Math.log(3)), 1e-9);
    const direction = parameters.edgeDirection === 'rising' ? -1 : 1;
    const exponent = Math.max(-60, Math.min(60, direction * (x - parameters.center) / scale));
    return fermiBackground(x, parameters) + parameters.height / (1 + Math.exp(exponent));
  }

  function fermiBackground(x, parameters) {
    const delta = x - parameters.center;
    return parameters.background + parameters.slope * (parameters.backgroundSide === 'higher' ? Math.max(delta, 0) : Math.min(delta, 0));
  }

  function solveLinear(matrix, vector) {
    const n = vector.length;
    const a = matrix.map((row, i) => row.slice().concat(vector[i]));
    for (let column = 0; column < n; column += 1) {
      let pivot = column;
      for (let row = column + 1; row < n; row += 1) if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
      if (Math.abs(a[pivot][column]) < 1e-14) return null;
      [a[column], a[pivot]] = [a[pivot], a[column]];
      const divisor = a[column][column];
      for (let j = column; j <= n; j += 1) a[column][j] /= divisor;
      for (let row = 0; row < n; row += 1) {
        if (row === column) continue;
        const factor = a[row][column];
        for (let j = column; j <= n; j += 1) a[row][j] -= factor * a[column][j];
      }
    }
    return a.map((row) => row[n]);
  }

  function optimize(points, initial, decode, clamp, predictSeries, maxIterations) {
    let values = initial.slice();
    let lambda = 1e-2;
    const predictions = (candidate) => predictSeries(decode(candidate));
    const error = (candidate) => {const predicted=predictions(candidate);return points.reduce((sum, point, index) => {const residual=point[1]-predicted[index];return sum+residual*residual},0)};
    let sse = error(values);
    let iterations = 0;
    for (; iterations < (maxIterations || 120); iterations += 1) {
      const n = values.length;
      const jtj = Array.from({ length: n }, () => Array(n).fill(0));
      const jtr = Array(n).fill(0);
      const base=predictions(values),derivativeSeries=values.map((value,index)=>{const delta=Math.max(Math.abs(value)*1e-5,1e-6),candidate=values.slice();candidate[index]+=delta;const changed=predictions(candidate);return changed.map((prediction,pointIndex)=>(prediction-base[pointIndex])/delta)});
      points.forEach(([, observed],pointIndex) => {
        const residual = observed - base[pointIndex];
        const derivatives = derivativeSeries.map(series=>series[pointIndex]);
        for (let i = 0; i < n; i += 1) {
          jtr[i] += derivatives[i] * residual;
          for (let j = 0; j <= i; j += 1) jtj[i][j] += derivatives[i] * derivatives[j];
        }
      });
      for (let i = 0; i < values.length; i += 1) {
        for (let j = 0; j < i; j += 1) jtj[j][i] = jtj[i][j];
        jtj[i][i] += lambda * Math.max(jtj[i][i], 1);
      }
      const step = solveLinear(jtj, jtr);
      if (!step) break;
      const candidate = clamp(values.map((value, index) => value + step[index]));
      const candidateSse = error(candidate);
      if (candidateSse < sse) {
        const improvement = (sse - candidateSse) / Math.max(sse, 1e-12);
        values = candidate;
        sse = candidateSse;
        lambda = Math.max(1e-7, lambda / 3);
        if (improvement < 1e-9) break;
      } else {
        lambda = Math.min(1e9, lambda * 8);
      }
    }
    return { values, parameters: decode(values), sse, iterations: iterations + 1 };
  }

  function fitPeaks(points, options) {
    if (!Array.isArray(points) || points.length < 8) throw new Error('At least 8 data points are required.');
    const type = options.type || 'gaussian';
    const minX = Math.min(...points.map((point) => point[0]));
    const maxX = Math.max(...points.map((point) => point[0]));
    const span = Math.max(maxX - minX, 1e-6);
    const origin = (minX + maxX) / 2;
    const peaks = options.peaks || [], backgroundType=['none','constant','linear','shirley'].includes(options.backgroundType)?options.backgroundType:'linear';
    if (!peaks.length) throw new Error('Add at least one peak.');
    const edge=Math.max(2,Math.floor(points.length*.1)),leftEdge=points.slice(0,edge).reduce((sum,point)=>sum+point[1],0)/edge,rightEdge=points.slice(-edge).reduce((sum,point)=>sum+point[1],0)/edge,initial=[];
    if(backgroundType==='constant')initial.push(Number.isFinite(options.background)?Number(options.background):(leftEdge+rightEdge)/2);
    else if(backgroundType==='linear')initial.push(Number.isFinite(options.background)?Number(options.background):(leftEdge+rightEdge)/2,Number.isFinite(options.slope)?Number(options.slope):(rightEdge-leftEdge)/span);
    else if(backgroundType==='shirley')initial.push(Number.isFinite(options.background)?Number(options.background):leftEdge,Number.isFinite(options.backgroundRight)?Number(options.backgroundRight):rightEdge);
    const peakOffset=initial.length;
    peaks.forEach((peak) => initial.push(peak.center, Math.max(peak.height, 0), Math.max(peak.width, span / 100), peak.shape == null ? (type === 'voigt' ? 0.5 : 0.08) : peak.shape));
    const decode = (values) => {let background=0,slope=0,backgroundRight=0;if(backgroundType==='constant')background=values[0];else if(backgroundType==='linear'){background=values[0];slope=values[1]}else if(backgroundType==='shirley'){background=values[0];backgroundRight=values[1]}return{backgroundType,background,slope,backgroundRight,origin,peaks:peaks.map((peak,index)=>({center:values[peakOffset+index*4],height:values[peakOffset+index*4+1],width:values[peakOffset+index*4+2],shape:values[peakOffset+index*4+3]}))}};
    const clamp = (values) => {
      const next = values.slice();
      peaks.forEach((peak, index) => {
        const offset=peakOffset+index*4;
        next[offset] = Math.max(minX, Math.min(maxX, next[offset]));
        next[offset+1] = Math.max(0, next[offset+1]);
        next[offset+2] = Math.max(span / 10000, Math.min(span * 2, Math.abs(next[offset+2])));
        next[offset+3] = type === 'doniach-sunjic' ? Math.max(0, Math.min(0.45, next[offset+3])) : Math.max(0, Math.min(1, next[offset+3]));
      });
      return next;
    };
    const result = optimize(points, initial, decode, clamp, parameters => evaluatePeakSeries(type,points,parameters).total), evaluated=evaluatePeakSeries(type,points,result.parameters),finished=finish(points,result,evaluated.total,type);
    finished.backgroundPoints=backgroundType==='none'?[]:points.map((point,index)=>[point[0],evaluated.background[index]]);finished.componentPoints=evaluated.components.map(component=>points.map((point,index)=>[point[0],component[index]]));return finished;
  }

  function fitFermiEdge(points, options) {
    if (!Array.isArray(points) || points.length < 8) throw new Error('At least 8 data points are required.');
    const sorted = points.slice().sort((a, b) => a[0] - b[0]);
    const minX = sorted[0][0], maxX = sorted[sorted.length - 1][0], span = Math.max(maxX - minX, 1e-6);
    const edge = Math.max(2, Math.floor(sorted.length * 0.12));
    const left = sorted.slice(0, edge).reduce((sum, point) => sum + point[1], 0) / edge;
    const right = sorted.slice(-edge).reduce((sum, point) => sum + point[1], 0) / edge;
    const edgeDirection=options.edgeDirection==='rising'?'rising':'falling';
    const initialHeight=edgeDirection==='rising'?right-left:left-right,initialBackground=edgeDirection==='rising'?left:right;
    const initial = [options.center == null ? (minX + maxX) / 2 : options.center, Math.max(options.width || span / 10, span / 10000), options.height == null ? Math.max(initialHeight,0) : Math.max(options.height,0), options.background == null ? initialBackground : options.background, Number(options.slope) || 0];
    const backgroundSide=options.backgroundSide==='higher'?'higher':'lower';
    const decode = (values) => ({ center: values[0], width: values[1], height: values[2], background: values[3], slope: values[4], backgroundSide, edgeDirection });
    const clamp = (values) => [Math.max(minX, Math.min(maxX, values[0])), Math.max(span / 10000, Math.min(span * 2, Math.abs(values[1]))), Math.max(0,values[2]), values[3], values[4]];
    const result = optimize(points, initial, decode, clamp, parameters=>points.map(([x])=>fermiModel(x,parameters))),predicted=points.map(([x])=>fermiModel(x,result.parameters)),finished=finish(points,result,predicted,'fermi-edge');
    finished.backgroundPoints=points.map(([x])=>[x,fermiBackground(x,result.parameters)]);return finished;
  }

  function finish(points, result, predicted, type) {
    const mean = points.reduce((sum, point) => sum + point[1], 0) / points.length;
    const total = points.reduce((sum, point) => sum + Math.pow(point[1] - mean, 2), 0);
    const rms = Math.sqrt(result.sse / points.length);
    return {
      type,
      parameters: result.parameters,
      sse: result.sse,
      rms,
      rSquared: total > 0 ? 1 - result.sse / total : 1,
      iterations: result.iterations,
      points: points.map((point,index) => [point[0], predicted[index]]),
      residuals: points.map((point,index) => [point[0], point[1] - predicted[index]])
    };
  }

  return { peakValue, peakModel, fermiModel, fermiBackground, evaluatePeakSeries, fitPeaks, fitFermiEdge };
});
