(function attachEffectiveDepth(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.EffectiveDepth = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createEffectiveDepth() {
  'use strict';
  function number(value, label, min, max = Infinity) {
    if (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) throw new Error(label + 'の数値・範囲を確認してください。');
    return Number(value);
  }
  function transportEal(imfp, transportMfp) {
    const lambda = number(imfp, 'IMFP / nm', 1e-9);
    const transport = number(transportMfp, '輸送平均自由行程 / nm', 1e-9);
    const albedo = lambda / (lambda + transport);
    return { eal: lambda * (1 - 0.735 * albedo), albedo };
  }
  // A uniform solid-angle cone around the analyzer axis. Midpoints in cos(delta)
  // and azimuth have equal weights, so no extra sin(delta) factor is needed.
  function angularSamples(angle, halfAngle) {
    const theta = number(angle, '放出角 / °', 0, 89.9);
    const half = number(halfAngle, '受入半角 / °', 0, 30);
    if (theta + half >= 90) throw new Error('受入角の全域が表面より上（放出角 + 受入半角 < 90°）になるようにしてください。');
    const radians = Math.PI / 180, c = Math.cos(theta * radians), s = Math.sin(theta * radians);
    if (half === 0) return [c];
    const lower = Math.cos(half * radians), samples = [];
    for (let i = 0; i < 24; i++) {
      const u = lower + (1 - lower) * (i + .5) / 24, v = Math.sqrt(1 - u * u);
      for (let j = 0; j < 48; j++) samples.push(c * u + s * v * Math.cos(2 * Math.PI * (j + .5) / 48));
    }
    return samples;
  }
  function depthDistribution(length, cosines) {
    const paths = cosines.map(mu => length * mu);
    const total = paths.reduce((sum, path) => sum + path, 0);
    // Uniform semi-infinite emitter: integrate exp(-z/(L cos(theta))) over z.
    // The extra path factor is essential when mixing emission angles.
    const tail = depth => paths.reduce((sum, path) => sum + path * Math.exp(-depth / path), 0) / total;
    const cumulative = depth => 1 - tail(number(depth, '深さ / nm', 0));
    const quantile = probability => {
      number(probability, '累積割合', 1e-9, 1 - 1e-9);
      let lo = 0, hi = Math.max(...paths) * -Math.log1p(-probability);
      for (let i = 0; i < 55; i++) {
        const mid = (lo + hi) / 2;
        if (cumulative(mid) < probability) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    };
    return {
      cumulative, tail, quantile,
      mean: paths.reduce((sum, path) => sum + path * path, 0) / total,
      d50: quantile(.5), d90: quantile(.9), d95: quantile(.95), d99: quantile(.99)
    };
  }
  function calculate(input) {
    if (!['transport', 'manual'].includes(input.method)) throw new Error('EALの計算方法を選択してください。');
    const energy = number(input.energy, '電子の運動エネルギー / eV', .001);
    const imfp = number(input.imfp, 'IMFP / nm', 1e-9);
    const angle = number(input.angle, '放出角 / °', 0, 89.9);
    const halfAngle = number(input.halfAngle, '受入半角 / °', 0, 30);
    const depth = number(input.depth, '評価する深さ / nm', 0);
    const cosines = angularSamples(angle, halfAngle);
    let eal, albedo = null;
    if (input.method === 'transport') {
      if (energy < 50 || energy > 2000 || angle + halfAngle > 50) throw new Error('輸送近似は本ページでは50〜2000 eV・受入角を含め法線から50°以内に限定します。範囲外は条件に対応する外部EALを入力してください。');
      ({ eal, albedo } = transportEal(imfp, input.transportMfp));
    } else {
      eal = number(input.manualEal, '外部EAL / nm', 1e-9);
    }
    const corrected = depthDistribution(eal, cosines), straight = depthDistribution(imfp, cosines);
    return { eal, albedo, corrected, straight, fraction: corrected.cumulative(depth), depth, energy, angle, halfAngle };
  }
  return { transportEal, angularSamples, depthDistribution, calculate };
}));
