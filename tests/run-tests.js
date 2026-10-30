const assert = require('assert');
const fs = require('fs');
const path = require('path');
const parser = require('../assets/js/xy-parser.js');
const fitting = require('../assets/js/fitting.js');
const photoionization = require('../assets/js/photoionization.js');

const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'app.js'), 'utf8');
assert.match(
  indexHtml,
  /<link rel="icon" type="image\/png" sizes="64x64" href="assets\/favicon-64\.png" \/>/,
  'the page should declare the PNG favicon'
);
assert.match(
  indexHtml,
  /<link rel="apple-touch-icon" sizes="180x180" href="assets\/apple-touch-icon\.png" \/>/,
  'the page should declare an Apple touch icon'
);
assert.match(indexHtml, /Relative photoionization cross section \(max = 1\)/, 'the reference-only plot should declare its cross-section axis');
assert.match(indexHtml, /assets\/js\/photoionization-cross-sections\.js/, 'the photoionization data should load before the application');
assert.match(indexHtml, /assets\/js\/photoionization\.js/, 'the photoionization calculator should load before the application');
assert.match(indexHtml, /<input id="showPICross" type="checkbox" checked \/> Cross Sec\./, 'Cross Sec. should be an enabled-by-default display toggle');
assert.match(appSource, /showPICross:showPICrossInput\.checked/, 'the Cross Sec. setting should be saved in the workspace');
assert.match(appSource, /showPICrossInput\.checked=ui\.showPICross!==false/, 'older workspaces should restore with Cross Sec. enabled');
assert.match(appSource, /crossSectionEnabled=showPICrossInput\.checked/, 'plot rendering should follow the Cross Sec. toggle');

[
  ['Cr', '5414.8'],
  ['Cu', '8047.8'],
  ['Ga', '9251.7']
].forEach(([source, energy]) => {
  assert(
    indexHtml.includes(`<option value="${energy}">${source} Kα (${energy} eV)</option>`),
    `${source} K-alpha should be available as an excitation source preset`
  );
});

function assertPngSize(assetName, expectedSize) {
  const assetPath = path.join(__dirname, '..', 'assets', assetName);
  assert(fs.existsSync(assetPath), `${assetName} should exist`);
  const asset = fs.readFileSync(assetPath);
  assert.deepStrictEqual(
    [...asset.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    `${assetName} should be a valid PNG`
  );
  assert.deepStrictEqual(
    [asset.readUInt32BE(16), asset.readUInt32BE(20)],
    [expectedSize, expectedSize],
    `${assetName} should be ${expectedSize}x${expectedSize} pixels`
  );
}

assertPngSize('favicon-64.png', 64);
assertPngSize('apple-touch-icon.png', 180);

const carbonAtAlKa = photoionization.crossSection('C', '1s', 1486.6);
assert.strictEqual(carbonAtAlKa.method, 'tabulated', 'an exact photon-energy node should use the tabulated cross section');
assert(Math.abs(carbonAtAlKa.value - 0.013) < 1e-12, 'C 1s at Al K-alpha should match the Yeh-Lindau table');
const copper2pHalf = photoionization.crossSection('Cu', '2p1/2', 1253.6);
const copper2pThreeHalves = photoionization.crossSection('Cu', '2p3/2', 1253.6);
assert(Math.abs(copper2pHalf.value + copper2pThreeHalves.value - 0.5345) < 1e-12, 'spin-orbit components should sum to the tabulated subshell cross section');
assert(Math.abs(copper2pThreeHalves.value / copper2pHalf.value - 2) < 1e-12, 'p3/2 and p1/2 should follow their 2:1 statistical weights');
const copperInterpolated = photoionization.crossSection('Cu', '2p3/2', 1200);
assert.strictEqual(copperInterpolated.method, 'interpolated', 'a photon energy between nodes should be interpolated');
assert(copperInterpolated.value > 0, 'an interpolated cross section should remain positive');
const carbonAtGaKa = photoionization.crossSection('C', '1s', 9251.7);
assert.strictEqual(carbonAtGaKa.method, 'extrapolated', 'the Ga K-alpha preset should use the documented short extrapolation');
assert.strictEqual(photoionization.crossSection('C', '1s', 11000), null, 'extrapolation should stop beyond the conservative limit');
assert.deepStrictEqual(photoionization.normalizedValues([carbonAtAlKa, copper2pThreeHalves]), [carbonAtAlKa.value / copper2pThreeHalves.value, 1], 'cross sections should normalize to the strongest peak');

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

console.log('All tests passed.');
