const assert = require('assert');
const parser = require('../assets/js/xy-parser.js');
const fitting = require('../assets/js/fitting.js');

const spectra = parser.parseXY(`
# Group: Synthetic sample
# Region: C 1s
# Spectrum ID: 1
# Excitation Energy: 1486.6
# Cycle: 1, Curve: 1
# Values/Curve: 3
# ColumnLabels: energy counts/s
285.0 120
284.9 150
284.8 130
# Operation: Constant background
# Range Start: 284.8
# Range End: 285.0
# Parameter: "Background" = 100
# Result Name: Background
# Values/Curve: 2
# Curve: Background
285.0 100
284.9 100
# Result Name: Residuum
# Values/Curve: 2
# Curve: Residuum
285.0 20
284.9 50
# Region: O 1s
# Spectrum ID: 2
# Cycle: 1, Curve: 1
# Values/Curve: 2
# ColumnLabels: energy counts/s
532.0 40
531.9 42
`);
assert.strictEqual(spectra.length, 2, 'all synthetic measurement spectra should be parsed');
assert.deepStrictEqual(spectra.map((spectrum) => spectrum.points.length), [3, 2], 'raw points should be grouped by region');

const imported = spectra.filter((spectrum) => spectrum.results.length);
assert.deepStrictEqual(imported.map((spectrum) => spectrum.points.length), [3], 'result data must not leak into raw points');
assert.deepStrictEqual(
  imported.map((spectrum) => spectrum.results[0].curves.map((curve) => [curve.name, curve.points.length])),
  [
    [['Background', 2], ['Residuum', 2]]
  ],
  'imported operation results should be separate named curves'
);

const peakPoints = [];
const expectedPeaks = {
  background: 7,
  slope: 0.12,
  origin: 6,
  peaks: [
    { center: 3.1, height: 90, width: 0.75, shape: 0.5 },
    { center: 8.2, height: 55, width: 1.15, shape: 0.5 }
  ]
};
for (let index = 0; index <= 240; index += 1) {
  const x = index / 20;
  peakPoints.push([x, fitting.peakModel('gaussian', x, expectedPeaks)]);
}
const peakFit = fitting.fitPeaks(peakPoints, {
  type: 'gaussian',
  background: 5,
  peaks: [
    { center: 2.9, height: 80, width: 1, shape: 0.5 },
    { center: 8, height: 50, width: 1, shape: 0.5 }
  ]
});
assert(peakFit.rSquared > 0.999999, 'multi-peak fitting should converge');

['lorentzian', 'voigt', 'doniach-sunjic'].forEach((type) => {
  const shape = type === 'doniach-sunjic' ? 0.1 : 0.35;
  const parameters = { background: 3, slope: 0.02, origin: 5, peaks: [{ center: 4, height: 40, width: 0.8, shape }] };
  const points = Array.from({ length: 201 }, (_, index) => {
    const x = index * 0.05;
    return [x, fitting.peakModel(type, x, parameters)];
  });
  const result = fitting.fitPeaks(points, { type, background: 2, peaks: [{ center: 3.9, height: 35, width: 1, shape: 0.2 }] });
  assert(result.rSquared > 0.999999, `${type} fitting should converge`);
});

['none', 'constant', 'linear', 'shirley'].forEach((backgroundType) => {
  const points = Array.from({ length: 201 }, (_, index) => [index * 0.05, 0]);
  const parameters = {
    backgroundType,
    background: backgroundType === 'none' ? 0 : 8,
    backgroundRight: 3,
    slope: 0.3,
    origin: 5,
    peaks: [{ center: 4, height: 40, width: 0.8, shape: 0.35 }]
  };
  const generated = fitting.evaluatePeakSeries('voigt', points, parameters);
  const data = points.map((point, index) => [point[0], generated.total[index]]);
  const result = fitting.fitPeaks(data, {
    type: 'voigt',
    backgroundType,
    peaks: [{ center: 3.9, height: 35, width: 1, shape: 0.4 }]
  });
  assert(result.rSquared > 0.999999, `${backgroundType} background fitting should converge`);
  assert.strictEqual(result.backgroundPoints.length, backgroundType === 'none' ? 0 : data.length, `${backgroundType} background plotting data should match the selected model`);
});

const edgePoints = [];
const expectedEdge = { center: 0.15, width: 0.38, height: 120, background: 15, slope: 1.2 };
for (let index = 0; index <= 200; index += 1) {
  const x = -2 + index * 0.02;
  edgePoints.push([x, fitting.fermiModel(x, expectedEdge)]);
}
const edgeFit = fitting.fitFermiEdge(edgePoints, {});
assert(edgeFit.rSquared > 0.999999, 'Fermi-edge fitting should converge');
assert.strictEqual(fitting.fermiBackground(1, expectedEdge), expectedEdge.background, 'Fermi background should be constant above EF');
assert(fitting.fermiBackground(-1, expectedEdge) < expectedEdge.background, 'Fermi background should be linear below EF');
const bindingBackground = { ...expectedEdge, backgroundSide: 'higher', edgeDirection: 'rising' };
assert.strictEqual(fitting.fermiBackground(-1, bindingBackground), expectedEdge.background, 'Binding-energy background should be constant below EF');
assert(fitting.fermiBackground(1, bindingBackground) > expectedEdge.background, 'Binding-energy background should be linear above EF');
const bindingEdgePoints = Array.from({ length: 201 }, (_, index) => {
  const x = -2 + index * 0.02;
  return [x, fitting.fermiModel(x, bindingBackground)];
});
const bindingEdgeFit = fitting.fitFermiEdge(bindingEdgePoints, { backgroundSide: 'higher', edgeDirection: 'rising' });
assert(bindingEdgeFit.rSquared > 0.999999, 'Binding-energy Fermi background should converge on the higher-energy side');
assert.strictEqual(bindingEdgeFit.parameters.backgroundSide, 'higher', 'Binding-energy fit should preserve its background side');
assert.strictEqual(bindingEdgeFit.parameters.edgeDirection, 'rising', 'Binding-energy Fermi edge should rise with binding energy');
bindingEdgeFit.points.forEach((point, index) => assert(point[1] >= bindingEdgeFit.backgroundPoints[index][1] - 1e-9, 'Fermi fit should stay above its background'));

console.log('All parser and fitting tests passed.');
