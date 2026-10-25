(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ReferenceSearch=api;
}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const symbols='H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U'.split(' ');
  const english='Hydrogen Helium Lithium Beryllium Boron Carbon Nitrogen Oxygen Fluorine Neon Sodium Magnesium Aluminium Silicon Phosphorus Sulfur Chlorine Argon Potassium Calcium Scandium Titanium Vanadium Chromium Manganese Iron Cobalt Nickel Copper Zinc Gallium Germanium Arsenic Selenium Bromine Krypton Rubidium Strontium Yttrium Zirconium Niobium Molybdenum Technetium Ruthenium Rhodium Palladium Silver Cadmium Indium Tin Antimony Tellurium Iodine Xenon Caesium Barium Lanthanum Cerium Praseodymium Neodymium Promethium Samarium Europium Gadolinium Terbium Dysprosium Holmium Erbium Thulium Ytterbium Lutetium Hafnium Tantalum Tungsten Rhenium Osmium Iridium Platinum Gold Mercury Thallium Lead Bismuth Polonium Astatine Radon Francium Radium Actinium Thorium Protactinium Uranium'.split(' ');
  const japanese='水素 ヘリウム リチウム ベリリウム ホウ素 炭素 窒素 酸素 フッ素 ネオン ナトリウム マグネシウム アルミニウム ケイ素 リン 硫黄 塩素 アルゴン カリウム カルシウム スカンジウム チタン バナジウム クロム マンガン 鉄 コバルト ニッケル 銅 亜鉛 ガリウム ゲルマニウム ヒ素 セレン 臭素 クリプトン ルビジウム ストロンチウム イットリウム ジルコニウム ニオブ モリブデン テクネチウム ルテニウム ロジウム パラジウム 銀 カドミウム インジウム スズ アンチモン テルル ヨウ素 キセノン セシウム バリウム ランタン セリウム プラセオジム ネオジム プロメチウム サマリウム ユウロピウム ガドリニウム テルビウム ジスプロシウム ホルミウム エルビウム ツリウム イッテルビウム ルテチウム ハフニウム タンタル タングステン レニウム オスミウム イリジウム 白金 金 水銀 タリウム 鉛 ビスマス ポロニウム アスタチン ラドン フランシウム ラジウム アクチニウム トリウム プロトアクチニウム ウラン'.split(' ');
  const elements=symbols.map((symbol,i)=>({symbol,name:english[i],japanese:japanese[i]}));
  const names=new Map(elements.flatMap(element=>[element.symbol,element.name,element.japanese].map(name=>[name.toLowerCase(),element.symbol])));
  Object.entries({aluminum:'Al',sulphur:'S',cesium:'Cs',シリコン:'Si',珪素:'Si',硅素:'Si',硼素:'B',砒素:'As',錫:'Sn',沃素:'I',プラチナ:'Pt'}).forEach(([name,symbol])=>names.set(name,symbol));
  function resolveElement(value){return names.get(String(value).normalize('NFKC').trim().toLowerCase())||null;}
  // Pair only the two j components of the same n,l subshell. Use the absolute
  // separation, including equal tabulated energies, without inventing missing levels.
  function spinOrbitPairs(levels){
    const byLevel=new Map(levels),partners={p:['1/2','3/2'],d:['3/2','5/2'],f:['5/2','7/2']},pairs=[];
    for(const [label,first] of levels){
      const match=label.match(/^(\d+)([pdf])(\d+\/2)$/);
      if(!match||match[3]!==partners[match[2]][0])continue;
      const other=match[1]+match[2]+partners[match[2]][1],second=byLevel.get(other);
      if(!Number.isFinite(first)||!Number.isFinite(second))continue;
      pairs.push({level:label,partner:other,first,second,splitting:Math.abs(first-second)});
    }
    return pairs;
  }
  function searchSplittings(coreLevels,target,width){
    if(!Number.isFinite(target)||target<0||!Number.isFinite(width)||width<0)return [];
    return Object.entries(coreLevels).flatMap(([symbol,levels])=>spinOrbitPairs(levels)
      .filter(pair=>Math.abs(pair.splitting-target)<=width+1e-10)
      .map(pair=>({symbol,...pair,difference:pair.splitting-target})))
      .sort((a,b)=>Math.abs(a.difference)-Math.abs(b.difference)||symbols.indexOf(a.symbol)-symbols.indexOf(b.symbol));
  }
  return {elements,resolveElement,spinOrbitPairs,searchSplittings};
}));
