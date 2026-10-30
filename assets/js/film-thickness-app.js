(function startFilmThickness() {
  'use strict';
  const $=id=>document.getElementById(id), key='xps-film-thickness.workspace.v1';
  const ids=['filmElement','filmOrbital','filmReference','filmArea','filmSubstrateArea','filmNumberDensity','filmAttenuation','filmMolarMass','filmValence','filmEmitterAtoms','filmGap','filmLambda','filmSubstrateLambda'];
  let latest=null, source=window.EscapeDepthWorkspace.getPrediction(), previousRatio='';
  const defaults={filmElement:'C',filmOrbital:'1s',filmReference:'Si-2p3/2',filmArea:'',filmSubstrateArea:'',filmNumberDensity:'',filmAttenuation:'none',filmMolarMass:'',filmValence:'',filmEmitterAtoms:'1',filmGap:'',filmLambda:'',filmSubstrateLambda:''};
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
    if(!['none','tpp','manual'].includes($('filmAttenuation').value))$('filmAttenuation').value='none';
  }
  function save() {
    try {localStorage.setItem(key,JSON.stringify({version:4,fields:read(),previousRatio,expanded:$('filmEstimator').open}));}
    catch {$('filmStatus').textContent='Film inputs could not be saved. Export the results before leaving this page.';}
  }
  const fmt=value=>value.toLocaleString('en-US',{maximumSignificantDigits:6});
  function calculate() {
    latest=null;$('exportFilm').disabled=true;$('filmError').hidden=true;
    ['filmThickness','filmAtomsPerCell','filmArealDensity','filmCellArea','filmRatio'].forEach(id=>{$(id).textContent='—';});
    $('filmEnergySummary').textContent='';
    $('filmTransportSummary').textContent='';
    const mode=$('filmAttenuation').value;
    for(const [id,selected] of [['filmTppFields',mode==='tpp'],['filmManualFields',mode==='manual']]){
      $(id).hidden=!selected;$(id).querySelectorAll('input').forEach(input=>{input.disabled=!selected;});
    }
    $('filmTppHelp').hidden=mode!=='tpp';$('filmManualHelp').hidden=mode!=='manual';
    $('filmStatus').classList.remove('warning');
    $('filmSavedRatio').hidden=previousRatio==='';
    $('filmSavedRatio').textContent=previousRatio===''?'':'Previously saved ratio: '+previousRatio+'. Enter the two measured areas to recalculate.';
    try {
      let ratio=null;
      if($('filmArea').value!=='' && $('filmSubstrateArea').value!==''){
        ratio=FilmThickness.measuredRatio($('filmArea').value,$('filmSubstrateArea').value);
        $('filmRatio').textContent=fmt(ratio);
        previousRatio='';$('filmSavedRatio').hidden=true;
      }
      if(!source)throw new Error('Correct the crystal and excitation inputs above before estimating film thickness.');
      const row=source.prediction.rows.find(row=>row.id===$('filmReference').value);
      if(!row || !(row.area>0))throw new Error('The substrate reference peak needs a positive calculated yield.');
      const binding=coreLevels[$('filmElement').value].find(([label])=>label===$('filmOrbital').value)?.[1];
      const energy=Number(source.input.photonEnergy)-Number(source.input.workFunction)-binding;
      if(!(energy>0))throw new Error('The film orbital is not accessible at this photon energy.');
      $('filmEnergySummary').textContent='Kinetic energies · film: '+fmt(energy)+' eV · substrate: '+fmt(row.energy)+' eV';
      const automatic=Photoionization.crossSection($('filmElement').value,$('filmOrbital').value,Number(source.input.photonEnergy));
      if(!automatic || !(automatic.value>0))throw new Error('No tabulated cross section');
      const input={ratio,numberDensity:$('filmNumberDensity').value,sigma:automatic.value,baseline:row.area,surfaceArea:source.prediction.surface.area,mode,angle:source.input.angle,filmEnergy:energy,substrateEnergy:row.energy,molarMass:$('filmMolarMass').value,valence:$('filmValence').value,emitterAtoms:$('filmEmitterAtoms').value,gap:$('filmGap').value,filmLength:$('filmLambda').value,substrateLength:$('filmSubstrateLambda').value};
      $('filmCellArea').textContent=fmt(input.surfaceArea);
      if(ratio===null){
        $('filmStatus').textContent='Enter both measured peak areas to estimate thickness.';
        return;
      }
      if($('filmNumberDensity').value===''){
        $('filmStatus').textContent='Enter the adsorbate number density to calculate thickness and atoms per surface cell.';
        return;
      }
      const required=mode==='tpp'?['filmMolarMass','filmValence','filmEmitterAtoms','filmGap']:mode==='manual'?['filmLambda','filmSubstrateLambda']:[];
      if(required.some(id=>$(id).value==='')){
        $('filmStatus').textContent=mode==='tpp'?'Enter the film M, Nv, ν, and Eg to calculate both IMFPs.':'Enter both attenuation lengths inside the film.';
        return;
      }
      const result=FilmThickness.estimate(input);
      latest={input,result,fields:read(),filmBindingEnergy:binding,filmEnergy:energy,substrateEnergy:row.energy,reference:row.id,sigmaMethod:automatic.method,source};
      $('filmThickness').textContent=fmt(result.thickness);
      $('filmArealDensity').textContent=fmt(result.arealDensity);
      $('filmAtomsPerCell').textContent=fmt(result.atomsPerCell);
      const transport=result.transport;
      if(mode!=='none'){
        $('filmTransportSummary').textContent='Film lengths · La: '+fmt(transport.filmLength)+' nm · Ls,f: '+fmt(transport.substrateLength)+' nm';
        if(transport.material)$('filmTransportSummary').textContent+=' · Film density: '+fmt(transport.material.density)+' g/cm³';
      }
      $('filmStatus').textContent=mode==='none'?'No attenuation in the adsorbate. Substrate internal attenuation is retained; equal transmission and angular sensitivity are assumed.':transport.extrapolated?'Film TPP-2M uses extrapolation above 2000 eV. Check the attenuation lengths before interpreting thickness.':'Film attenuation included. Substrate internal attenuation is retained; equal transmission and angular sensitivity are assumed.';
      $('filmStatus').classList.toggle('warning',transport.extrapolated);
      $('exportFilm').disabled=false;
    }catch(error){$('filmError').textContent=error.message;$('filmError').hidden=false;$('filmStatus').textContent='';}
  }
  restore(defaults);
  try {
    const saved=JSON.parse(localStorage.getItem(key));
    if([1,2,3,4].includes(saved?.version) && saved.fields){
      restore(saved.version===4?saved.fields:{...saved.fields,...Object.fromEntries(ids.slice(6).map(id=>[id,defaults[id]]))});
      $('filmEstimator').open=saved.expanded===true;
      const oldRatio=saved.version===1?saved.fields.filmRatio:saved.previousRatio;
      if(typeof oldRatio==='string' && oldRatio!=='' && Number.isFinite(Number(oldRatio)) && Number(oldRatio)>=0)previousRatio=oldRatio;
    }
  }catch{/* Retain defaults for unreadable data. */}
  $('filmElement').addEventListener('change',()=>{orbitals();calculate();save();});
  $('filmOrbital').addEventListener('change',()=>{calculate();save();});
  ids.filter(id=>!['filmElement','filmOrbital'].includes(id)).forEach(id=>$(id).addEventListener('input',()=>{calculate();save();}));
  document.addEventListener('xps:prediction',event=>{const reference=$('filmReference').value;source=event.detail;if(source){references(reference);save();}calculate();});
  document.addEventListener('xps:escape-reset',()=>{previousRatio='';$('filmEstimator').open=false;restore(defaults);calculate();save();});
  $('filmEstimator').addEventListener('toggle',save);
  // Invalidate the estimate immediately during the main app's calculation debounce.
  ['photonEnergy','workFunction','emissionAngle','atomicSites','latticeVectors','sampleThickness','density','molarMass','valence','bandGap','surfacePhase','millerH','millerK','millerL','dielectricData','dielectricFormat','valenceBandwidth','dielectricOffset','dielectricRange','peakRows'].forEach(id=>$(id).addEventListener('input',()=>{source=null;calculate();}));
  $('exportFilm').addEventListener('click',()=>{
    if(!latest)return;
    const {input,result,fields,source:context}=latest,transport=result.transport;
    const rows=[['parameter','value'],['model',transport.mode==='none'?'Adsorbate without attenuation':'Uniform film with attenuation'],['film_attenuation_model',transport.mode],['film_La_nm',transport.filmLength??''],['film_Lsf_nm',transport.substrateLength??''],['film_density_g_cm3',transport.material?.density??''],['film_tpp_extrapolated',transport.extrapolated],['film_average_escape_probability',result.filmAverageSurvival],['substrate_transmission_through_film',result.substrateSurvival],['relative_transmission_angular_sensitivity',1],...Object.entries(fields),['measured_area_ratio',input.ratio],['photon_eV',context.input.photonEnergy],['work_function_eV',context.input.workFunction],['film_binding_energy_eV',latest.filmBindingEnergy],['film_Ekin_eV',latest.filmEnergy],['substrate_Ekin_eV',latest.substrateEnergy],['film_sigma_Mb',input.sigma],['sigma_method',latest.sigmaMethod],['uncoated_substrate_yield',input.baseline],['emission_angle_deg',context.input.angle],['thickness_nm',result.thickness],['film_atoms_nm-2',result.arealDensity],['adsorbate_atoms_per_surface_cell',result.atomsPerCell],['substrate_surface_cell_area_nm2',input.surfaceArea],['substrate_hkl',context.prediction.surface.indices?.join(' ')??'2D in-plane basis'],['substrate_model',context.input.imfpModel],['substrate_sample_thickness_nm',context.prediction.surface.thickness],['substrate_lattice_A',context.input.structure.lattice.map(row=>row.join(' ')).join('\n')],['substrate_atoms',context.input.structure.atoms.map(atom=>[atom.symbol,...atom.frac,atom.occupancy].join(' ')).join('\n')]];
    const csv='\uFEFF'+rows.map(row=>row.map(value=>'"'+String(value).replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
    link.href=url;link.download='xps-film-thickness.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  calculate();
  save();
}());
