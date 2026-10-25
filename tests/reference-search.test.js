const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const search=require('../assets/js/reference-search.js');
const core=vm.runInNewContext(fs.readFileSync(require.resolve('../assets/js/binding-energies.js'),'utf8')+';coreLevels');
for(const [name,symbol] of [[' silicon ','Si'],['Ｓｉ','Si'],['ケイ素','Si'],['Iron','Fe'],['鉄','Fe'],['ALUMINUM','Al'],['cesium','Cs'],['Uranium','U']])assert.equal(search.resolveElement(name),symbol);
assert.equal(search.resolveElement('<script>'),null);
assert.equal(search.elements.length,92);
search.elements.forEach(element=>{assert(element.name&&element.japanese);assert.equal(search.resolveElement(element.japanese),element.symbol);});
const pairs=search.spinOrbitPairs([['2p1/2',100],['3p3/2',20],['2s',110],['4f5/2',85],['4f7/2',81],['3d3/2',50]]);
assert.deepEqual(pairs,[{level:'4f5/2',partner:'4f7/2',first:85,second:81,splitting:4}]);
const si=search.searchSplittings(core,.4,0).find(row=>row.symbol==='Si'&&row.level==='2p1/2');
assert(si);assert(Math.abs(si.splitting-.4)<1e-10);
assert(search.searchSplittings(core,.3,.1).some(row=>row.symbol==='Si'&&row.level==='2p1/2'));
assert(search.searchSplittings(core,.16,0).some(row=>row.symbol==='Na')); // Reversed tabulated ordering still yields a positive gap.
assert(search.searchSplittings(core,0,0).some(row=>row.symbol==='Ne'));
assert.deepEqual(search.searchSplittings(core,NaN,1),[]);
assert.deepEqual(search.searchSplittings(core,1,-1),[]);
console.log('Reference search checks passed: element names, true doublet pairing, absolute differences, and inclusive precision boundaries.');
