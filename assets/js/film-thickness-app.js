(function startFilmThickness() {
  'use strict';
  const $=id=>document.getElementById(id), key='xps-film-thickness.workspace.v1';
  const ids=['filmElement','filmOrbital','filmBindingEnergy','filmSigma','filmReference','filmRatio','filmNumberDensity','filmLambda','filmSubstrateLambda','filmTransmission'];
  let latest=null, source=window.EscapeDepthWorkspace.getPrediction();
  const defaults={filmElement:'C',filmOrbital:'1s',filmBindingEnergy:'285',filmSigma:'',filmReference:'Si-2p3/2',filmRatio:'',filmNumberDensity:'',filmLambda:'',filmSubstrateLambda:'',filmTransmission:'1'};
  const read=()=>Object.fromEntries(ids.map(id=>[id,$(id).value]));
  const option=(value,text)=>{const node=document.createElement('option');node.value=value;node.textContent=text;return node;};
  Object.keys(coreLevels).forEach(symbol=>$('filmElement').append(option(symbol,symbol)));
  function orbitals(selected) {
    $('filmOrbital').replaceChildren(...coreLevels[$('filmElement').value].map(([label])=>option(label,label)));
    if([...$('filmOrbital').options].some(o=>o.value===selected))$('filmOrbital').value=selected;
  }
  function references(selected) {
    const rows=source?.prediction.rows || [];
    $('filmReference').replaceChildren(...rows.map(row=>option(row.id,row.symbol+' '+row.label)));
    if(rows.some(row=>row.id===selected))$('filmReference').value=selected;
    else if(rows.length)$('filmReference').value=(rows.find(row=>row.area>0)||rows[0]).id;
  }
  function restore(state) {
    $('filmElement').value=Object.hasOwn(coreLevels,state.filmElement)?state.filmElement:'C';
    orbitals(state.filmOrbital); references(state.filmReference);
    ids.filter(id=>!['filmElement','filmOrbital','filmReference'].includes(id)).forEach(id=>{$(id).value=typeof state[id]==='string'?state[id]:defaults[id];});
  }
  function save() {
    try {localStorage.setItem(key,JSON.stringify({version:1,fields:read()}));}
    catch {$('filmStatus').textContent='Film inputs could not be saved. Export the results before leaving this page.';}
  }
  const fmt=value=>value.toLocaleString('en-US',{maximumSignificantDigits:6});
  function calculate() {
    latest=null;$('exportFilm').disabled=true;$('filmError').hidden=true;
    ['filmThickness','filmArealDensity','filmSurvival'].forEach(id=>{$(id).textContent='—';});
    try {
      if(!source)throw new Error('Correct the crystal and excitation inputs above before estimating film thickness.');
      const row=source.prediction.rows.find(row=>row.id===$('filmReference').value);
      if(!row || !(row.area>0))throw new Error('The substrate reference peak needs a positive calculated yield.');
      const binding=Number($('filmBindingEnergy').value);
      if($('filmBindingEnergy').value==='' || !Number.isFinite(binding) || binding<0)throw new Error('Enter a nonnegative film binding energy.');
      const energy=Number(source.input.photonEnergy)-Number(source.input.workFunction)-binding;
      if(!(energy>0))throw new Error('The film orbital is not accessible at this photon energy.');
      const automatic=Photoionization.crossSection($('filmElement').value,$('filmOrbital').value,Number(source.input.photonEnergy));
      $('filmSigma').placeholder=automatic ? String(Number(automatic.value.toPrecision(6))) : 'No tabulated cross section';
      const sigma=$('filmSigma').value==='' ? automatic?.value : $('filmSigma').value;
      const input={ratio:$('filmRatio').value,numberDensity:$('filmNumberDensity').value,filmLength:$('filmLambda').value,substrateLength:$('filmSubstrateLambda').value,transmission:$('filmTransmission').value,sigma,baseline:row.area,angle:source.input.angle};
      if(['filmRatio','filmNumberDensity','filmLambda','filmSubstrateLambda'].some(id=>$(id).value==='')){
        $('filmStatus').textContent='Enter the measured ratio, film number density, and both attenuation lengths to estimate thickness.';
        return;
      }
      const result=FilmThickness.estimate(input);
      latest={input,result,fields:read(),filmEnergy:energy,substrateEnergy:row.energy,reference:row.id,sigmaMethod:$('filmSigma').value===''?automatic?.method:'manual',source};
      $('filmThickness').textContent=fmt(result.thickness);
      $('filmArealDensity').textContent=fmt(result.arealDensity);
      $('filmSurvival').textContent=fmt(result.substrateSurvival*100);
      $('filmStatus').textContent='Uniform-film estimate. The selected uncoated substrate yield and the current emission angle are used.';
      $('exportFilm').disabled=false;
    }catch(error){$('filmError').textContent=error.message;$('filmError').hidden=false;$('filmStatus').textContent='';}
  }
  restore(defaults);
  try {const saved=JSON.parse(localStorage.getItem(key));if(saved?.version===1 && saved.fields)restore(saved.fields);}catch{/* Retain defaults for unreadable data. */}
  $('filmElement').addEventListener('change',()=>{orbitals();$('filmBindingEnergy').value=coreLevels[$('filmElement').value][0][1];$('filmSigma').value='';calculate();save();});
  $('filmOrbital').addEventListener('change',()=>{$('filmBindingEnergy').value=coreLevels[$('filmElement').value].find(([label])=>label===$('filmOrbital').value)[1];$('filmSigma').value='';calculate();save();});
  ids.filter(id=>!['filmElement','filmOrbital'].includes(id)).forEach(id=>$(id).addEventListener('input',()=>{calculate();save();}));
  document.addEventListener('xps:prediction',event=>{const reference=$('filmReference').value;source=event.detail;if(source){references(reference);save();}calculate();});
  document.addEventListener('xps:escape-reset',()=>{restore(defaults);calculate();save();});
  // Invalidate the estimate immediately during the main app's calculation debounce.
  ['photonEnergy','workFunction','emissionAngle','atomicSites','latticeVectors','sampleThickness','density','molarMass','valence','bandGap','surfacePhase','millerH','millerK','millerL','dielectricData','dielectricFormat','valenceBandwidth','dielectricOffset','dielectricRange','peakRows'].forEach(id=>$(id).addEventListener('input',()=>{source=null;calculate();}));
  $('exportFilm').addEventListener('click',()=>{
    if(!latest)return;
    const {input,result,fields,source:context}=latest;
    const rows=[['parameter','value'],['model','Uniform complete overlayer on the current uncoated substrate'],...Object.entries(fields),['film_Ekin_eV',latest.filmEnergy],['substrate_Ekin_eV',latest.substrateEnergy],['film_sigma_Mb',input.sigma],['sigma_method',latest.sigmaMethod],['uncoated_substrate_yield',input.baseline],['emission_angle_deg',input.angle],['thickness_nm',result.thickness],['film_atoms_nm-2',result.arealDensity],['substrate_survival',result.substrateSurvival],['calculated_area_ratio',result.ratio],['substrate_model',context.input.imfpModel],['substrate_sample_thickness_nm',context.prediction.surface.thickness],['substrate_lattice_A',context.input.structure.lattice.map(row=>row.join(' ')).join('\n')],['substrate_atoms',context.input.structure.atoms.map(atom=>[atom.symbol,...atom.frac,atom.occupancy].join(' ')).join('\n')],['reference','https://srd.nist.gov/jpcrdreprint/5.0008576.pdf']];
    const csv='\uFEFF'+rows.map(row=>row.map(value=>'"'+String(value).replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
    link.href=url;link.download='xps-film-thickness.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  calculate();
}());
