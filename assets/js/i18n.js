(function setupI18n() {
  'use strict';
  const key='xps-toolkit.language.v1', records=new WeakMap(), attributeRecords=new WeakMap();
  const dictionaries={en:new Map(),ja:new Map()}, templates=[];
  let language='en', observer=null;
  try {if(localStorage.getItem(key)==='ja')language='ja';}catch{/* English is the default when storage is unavailable. */}
  const normalize=text=>text.replace(/\s+/g,' ').trim();
  function register(pairs) {
    pairs.forEach(([en,ja])=>{
      dictionaries.en.set(normalize(ja),en);dictionaries.ja.set(normalize(en),ja);
      dictionaries.en.set(normalize(en),en);dictionaries.ja.set(normalize(ja),ja);
    });
  }
  function pattern(en,ja) {
    const escape=part=>part.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replaceAll('{','\\{').replaceAll('}','\\}');
    const compile=source=>{
      const slots=[];
      const expression=source.split(/(\{\d+\})/).map(part=>{
        if(/^\{\d+\}$/.test(part)){slots.push(Number(part.slice(1,-1)));return '([\\s\\S]*?)';}
        return escape(part);
      }).join('');
      return {regex:new RegExp('^'+expression+'$'),slots};
    };
    templates.push({en,ja,enRegex:compile(en),jaRegex:compile(ja)});
  }
  function translate(value, depth=0) {
    if(typeof value!=='string' || !value.trim())return value;
    const source=normalize(value), direct=dictionaries[language].get(source);
    let result=direct;
    if(result===undefined){
      for(const template of templates){
        const matcher=template[language==='en'?'jaRegex':'enRegex'],match=source.match(matcher.regex);
        if(match){
          const argumentsByIndex={};matcher.slots.forEach((index,position)=>{argumentsByIndex[index]=match[position+1];});
          result=template[language].replace(/\{(\d+)\}/g,(_,index)=>{const part=argumentsByIndex[index]??'';return depth<4?translate(part,depth+1):part;});break;
        }
      }
    }
    if(result===undefined && /(?: · |\n)/.test(value)){
      return value.split(/( · |\n)/).map(part=>part===' · '||part==='\n'?part:translate(part,depth+1)).join('');
    }
    if(result===undefined)return value;
    return value.match(/^\s*/)[0]+result+value.match(/\s*$/)[0];
  }
  function translated(current,record) {
    const source=record && current===record.output?record.source:current;
    return {source,output:translate(source)};
  }
  // Imported names and user-edited legends are data, not interface messages.
  const excluded='script,style,textarea,[data-no-i18n],.file-name-text,.data-group-name,.plot-series-name,.plot-legend-item span,.fit-result-title span,#fitStyleName,#fitSpectrumName,.fit-overlay title';
  const skip=node=>node.parentElement?.closest(excluded);
  function applyNode(node) {
    if(node.nodeType===Node.TEXT_NODE){
      if(skip(node))return;
      const record=translated(node.data,records.get(node));records.set(node,record);
      if(node.data!==record.output)node.data=record.output;
    }else if(node.nodeType===Node.ELEMENT_NODE){
      if(node.matches(excluded))return;
      const values=attributeRecords.get(node)||{};
      ['aria-label','title','placeholder'].forEach(name=>{
        if(!node.hasAttribute(name))return;
        const record=translated(node.getAttribute(name),values[name]);values[name]=record;
        if(node.getAttribute(name)!==record.output)node.setAttribute(name,record.output);
      });
      attributeRecords.set(node,values);
      [...node.childNodes].forEach(applyNode);
    }
  }
  const observe=()=>observer?.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','placeholder']});
  function apply(root=document.body) {
    observer?.disconnect();if(root)applyNode(root);observe();
  }
  function setLanguage(next) {
    if(!['en','ja'].includes(next))return;
    language=next;document.documentElement.lang=language;
    try{localStorage.setItem(key,language);}catch{/* Language still works for this page. */}
    apply();window.dispatchEvent(new Event('languagechange'));
  }
  window.I18n={register,pattern,translate,apply,setLanguage,get language(){return language;}};
  document.documentElement.lang=language;
  document.addEventListener('DOMContentLoaded',()=>{
    apply();
    observer=new MutationObserver(changes=>{
      observer.disconnect();
      const roots=new Set();
      changes.forEach(change=>{
        if(change.type==='childList')change.addedNodes.forEach(node=>roots.add(node));
        else roots.add(change.target);
      });
      roots.forEach(root=>{if(root.isConnected)applyNode(root);});observe();
    });
    observe();
  });
  window.addEventListener('storage',event=>{if(event.key===key && ['en','ja'].includes(event.newValue))setLanguage(event.newValue);});
}());
