(function attachPhotoionization(root, factory) {
  const source = typeof photoionizationCrossSections !== 'undefined'
    ? photoionizationCrossSections
    : (typeof require === 'function' ? require('./photoionization-cross-sections.js') : {});
  const api = factory(source);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Photoionization = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createPhotoionization(data) {
  const MAX_EXTRAPOLATION_RATIO = 1.25;

  function subshellFromLabel(label) {
    const match = String(label || '').match(/^(\d+)([spdf])/i);
    return match ? `${match[1]}${match[2].toLowerCase()}` : null;
  }

  function spinOrbitFraction(label) {
    const match = String(label || '').match(/^\d+([spdf])(\d+)\/(\d+)$/i);
    if (!match) return 1;
    const angularMomentum = { s: 0, p: 1, d: 2, f: 3 }[match[1].toLowerCase()];
    const j = Number(match[2]) / Number(match[3]);
    return (2 * j + 1) / (2 * (2 * angularMomentum + 1));
  }

  function nearlyEqual(left, right) {
    return Math.abs(left - right) <= Math.max(1, Math.abs(left), Math.abs(right)) * 1e-10;
  }

  function hermiteLogInterpolation(segment, photonEnergy) {
    const exact = segment.find(node => nearlyEqual(node[0], photonEnergy));
    if (exact) return { value: exact[1], method: 'tabulated' };
    for (let index = 0; index < segment.length - 1; index += 1) {
      const left = segment[index], right = segment[index + 1];
      if (photonEnergy <= left[0] || photonEnergy >= right[0]) continue;
      const x = Math.log(photonEnergy), xLeft = Math.log(left[0]), xRight = Math.log(right[0]), width = xRight - xLeft, fraction = (x - xLeft) / width;
      const squared = fraction * fraction, cubed = squared * fraction;
      const logSigma = (2 * cubed - 3 * squared + 1) * Math.log(left[1])
        + (cubed - 2 * squared + fraction) * width * left[2]
        + (-2 * cubed + 3 * squared) * Math.log(right[1])
        + (cubed - squared) * width * right[2];
      return { value: Math.exp(logSigma), method: 'interpolated' };
    }
    return null;
  }

  function highEnergyExtrapolation(segments, photonEnergy) {
    const segment = [...segments].reverse().find(item => item.length > 1);
    if (!segment) return null;
    const right = segment[segment.length - 1], left = segment[segment.length - 2];
    if (photonEnergy <= right[0] || photonEnergy > right[0] * MAX_EXTRAPOLATION_RATIO) return null;
    const exponent = Math.log(right[1] / left[1]) / Math.log(right[0] / left[0]);
    return { value: right[1] * (photonEnergy / right[0]) ** exponent, method: 'extrapolated' };
  }

  function crossSection(symbol, levelLabel, photonEnergy) {
    const energy = Number(photonEnergy), subshell = subshellFromLabel(levelLabel), segments = data[symbol]?.[subshell];
    if (!Number.isFinite(energy) || energy <= 0 || !segments?.length) return null;
    const fraction = spinOrbitFraction(levelLabel);
    for (const segment of segments) {
      const first = segment[0], last = segment[segment.length - 1];
      if (segment.length === 1 && nearlyEqual(first[0], energy)) {
        return { value: first[1] * fraction, method: 'tabulated', unit: 'Mb', subshell, sourceRange: [first[0], first[0]] };
      }
      if (segment.length > 1 && energy >= first[0] && energy <= last[0]) {
        const result = hermiteLogInterpolation(segment, energy);
        if (result) return { ...result, value: result.value * fraction, unit: 'Mb', subshell, sourceRange: [first[0], last[0]] };
      }
    }
    const extrapolated = highEnergyExtrapolation(segments, energy);
    if (!extrapolated) return null;
    const lastSegment = [...segments].reverse().find(item => item.length > 1);
    return { ...extrapolated, value: extrapolated.value * fraction, unit: 'Mb', subshell, sourceRange: [lastSegment[0][0], lastSegment[lastSegment.length - 1][0]] };
  }

  function normalizedValues(results) {
    const maximum = Math.max(0, ...results.map(result => result?.value || 0));
    return results.map(result => maximum > 0 && result ? result.value / maximum : null);
  }

  function formatCrossSection(value) {
    if (!Number.isFinite(value)) return '—';
    if (value >= 0.01) return Number(value.toPrecision(4)).toString();
    return value.toExponential(3).replace('e+', 'e');
  }

  return { crossSection, formatCrossSection, normalizedValues, spinOrbitFraction, subshellFromLabel };
}));
