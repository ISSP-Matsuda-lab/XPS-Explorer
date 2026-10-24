(function setupSiteMenu(){
  'use strict';
  const nav=document.querySelector('.app-menu'), actions=document.querySelector('.header-actions');
  if(!nav || !actions)return;
  const page=location.pathname.split('/').pop() || 'index.html';
  nav.replaceChildren();
  [['index.html','Energy Reference'],['escape-depth.html','Escape depth & film thickness']].forEach(([href,title])=>{
    const link=document.createElement('a');link.href=href;link.textContent=title;
    if(href===page || (page==='effective-depth.html' && href==='escape-depth.html'))link.setAttribute('aria-current','page');nav.append(link);
  });
  nav.id='siteMenu';nav.hidden=true;
  const wrapper=document.createElement('div');wrapper.className='site-navigation';
  const toggle=document.createElement('button');toggle.type='button';toggle.className='site-menu-toggle';toggle.setAttribute('aria-controls','siteMenu');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','ページメニュー');
  toggle.innerHTML='<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span>メニュー</span>';
  const controls=document.createElement('div');controls.className='header-controls';
  [...actions.children].filter(node=>node!==nav).forEach(node=>controls.append(node));
  if(page!=='index.html'){
    const views=document.createElement('div');views.className='depth-view-switch';views.setAttribute('role','group');views.setAttribute('aria-label','Depth calculation view');
    [['escape-depth.html','IMFP'],['effective-depth.html','EAL']].forEach(([href,label])=>{
      const link=document.createElement('a');link.href=href;link.textContent=label;
      if(href===page)link.setAttribute('aria-current','page');views.append(link);
    });
    controls.prepend(views);
  }
  const language=document.createElement('button');language.type='button';language.className='language-toggle';language.id='languageToggle';
  language.setAttribute('data-no-i18n','');language.textContent=window.I18n?.language==='ja'?'English':'日本語';
  language.setAttribute('aria-label',window.I18n?.language==='ja'?'Switch to English':'日本語に切り替え');
  language.addEventListener('click',()=>window.I18n?.setLanguage(window.I18n.language==='ja'?'en':'ja'));
  window.addEventListener('languagechange',()=>{language.textContent=I18n.language==='ja'?'English':'日本語';language.setAttribute('aria-label',I18n.language==='ja'?'Switch to English':'日本語に切り替え');});
  wrapper.append(toggle,language,nav);actions.append(wrapper,controls);actions.classList.add('toolkit-actions');
  const setOpen=open=>{nav.hidden=!open;toggle.setAttribute('aria-expanded',String(open));};
  toggle.addEventListener('click',()=>setOpen(nav.hidden));
  document.addEventListener('click',event=>{if(!wrapper.contains(event.target))setOpen(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape' && !nav.hidden){setOpen(false);toggle.focus();}});
}());
