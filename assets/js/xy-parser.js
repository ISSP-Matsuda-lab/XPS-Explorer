(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.XYParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function numberPair(line) {
    const values = line.trim().split(/\s+/).slice(0, 2).map(Number);
    return values.length === 2 && values.every(Number.isFinite) ? values : null;
  }

  function parameter(line) {
    const match = line.match(/^#\s*Parameter:\s*"([^"]+)"\s*=\s*(.*?)\s*$/);
    return match ? [match[1], match[2]] : null;
  }

  function parseXY(text) {
    const spectra = [];
    let group = '';
    let current = null;
    let mode = 'header';
    let expectedRawPoints = null;
    let operation = null;
    let resultCurve = null;

    function finishResult() {
      if (!resultCurve || !operation) return;
      if (resultCurve.points.length) operation.curves.push(resultCurve);
      resultCurve = null;
    }

    function finishOperation() {
      finishResult();
      if (!operation || !current) return;
      if (operation.curves.length || Object.keys(operation.parameters).length) current.results.push(operation);
      operation = null;
    }

    function finishSpectrum() {
      finishOperation();
      if (current && current.points.length) spectra.push(current);
      current = null;
      mode = 'header';
      expectedRawPoints = null;
    }

    text.split(/\r?\n/).forEach((line) => {
      let match;
      if ((match = line.match(/^#\s*Group:\s*(.*?)\s*$/))) {
        group = match[1] || group;
        return;
      }
      if ((match = line.match(/^#\s*Region:\s*(.*?)\s*$/))) {
        finishSpectrum();
        current = {
          group,
          region: match[1] || 'Unnamed region',
          spectrumId: '',
          excitation: null,
          cycle: '',
          curve: '',
          points: [],
          results: []
        };
        return;
      }
      if (!current) return;

      if ((match = line.match(/^#\s*Spectrum ID:\s*(.*?)\s*$/))) {
        current.spectrumId = match[1];
        return;
      }
      if ((match = line.match(/^#\s*Excitation Energy:\s*([-+\d.eE]+)/))) {
        current.excitation = Number(match[1]);
        return;
      }
      if ((match = line.match(/^#\s*Cycle:\s*(\d+)(?:,\s*Curve:\s*(\d+))?/))) {
        current.cycle = match[1];
        if (match[2] != null) current.curve = match[2];
        return;
      }
      if ((match = line.match(/^#\s*Operation:\s*(.*?)\s*$/))) {
        finishOperation();
        operation = { name: match[1] || 'Imported fit', range: null, parameters: {}, curves: [] };
        mode = 'operation';
        return;
      }
      if (operation && (match = line.match(/^#\s*Range Start:\s*([-+\d.eE]+)/))) {
        operation.range = operation.range || [null, null];
        operation.range[0] = Number(match[1]);
        return;
      }
      if (operation && (match = line.match(/^#\s*Range End:\s*([-+\d.eE]+)/))) {
        operation.range = operation.range || [null, null];
        operation.range[1] = Number(match[1]);
        return;
      }
      if (operation && (match = line.match(/^#\s*Result Name:\s*(.*?)\s*$/))) {
        finishResult();
        resultCurve = { name: match[1] || 'Result', points: [], visible: false };
        mode = 'result-header';
        return;
      }
      const parsedParameter = operation ? parameter(line) : null;
      if (parsedParameter) {
        operation.parameters[parsedParameter[0]] = parsedParameter[1];
        return;
      }
      if ((match = line.match(/^#\s*Values\/Curve:\s*(\d+)/))) {
        if (resultCurve) resultCurve.expectedPoints = Number(match[1]);
        else if (mode === 'header') expectedRawPoints = Number(match[1]);
        return;
      }
      if (/^#\s*ColumnLabels:\s*energy\s+counts\/s/i.test(line)) {
        mode = 'raw-data';
        return;
      }
      if (resultCurve && /^#\s*Curve:/.test(line)) {
        mode = 'result-data';
        return;
      }
      if (line.startsWith('#')) return;

      const pair = numberPair(line);
      if (!pair) return;
      if (mode === 'raw-data') {
        if (expectedRawPoints == null || current.points.length < expectedRawPoints) current.points.push(pair);
        if (expectedRawPoints != null && current.points.length >= expectedRawPoints) mode = 'header';
      } else if (mode === 'result-data' && resultCurve) {
        if (resultCurve.expectedPoints == null || resultCurve.points.length < resultCurve.expectedPoints) resultCurve.points.push(pair);
      }
    });

    finishSpectrum();
    return spectra;
  }

  return { parseXY };
});
