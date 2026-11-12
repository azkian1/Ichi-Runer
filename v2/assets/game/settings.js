export const SETTINGS_KEY = 'ichiSettingsV1';
export const ACTION_LABELS = Object.freeze({ left:'Left',right:'Right',jump:'Double jump',slide:'Slide',attack:'Sword Wave',boost:'Boost · hold',upgrade:'Upgrades',pause:'Pause' });
export const DEFAULT_BINDINGS = Object.freeze({left:['KeyA','ArrowLeft'],right:['KeyD','ArrowRight'],jump:['Space','KeyW','ArrowUp'],slide:['KeyS','ArrowDown'],attack:['KeyJ','KeyK','KeyF'],boost:['ShiftLeft','ShiftRight'],upgrade:['KeyE'],pause:['Escape','KeyP']});
const copyBindings = () => Object.fromEntries(Object.entries(DEFAULT_BINDINGS).map(([k,v])=>[k,[...v]]));
const clamp = (n,a,b) => Math.max(a,Math.min(b,Number(n)));
const validCode = code => typeof code==='string' && /^(Key[A-Z]|Digit[0-9]|Arrow(?:Left|Right|Up|Down)|Space|ShiftLeft|ShiftRight|ControlLeft|ControlRight|AltLeft|AltRight|Escape|Enter|Backspace|BracketLeft|BracketRight|Semicolon|Quote|Comma|Period|Slash|Backslash|Minus|Equal|Numpad[0-9])$/.test(code) && code!=='KeyM';

export function settingsDefaults(reducedMotion=false){return {version:1,reducedMotion:Boolean(reducedMotion),lowQuality:false,uiScale:1,touchHand:'right',touchInset:0,musicVolume:.8,effectsVolume:.8,bindings:copyBindings()};}
export function normaliseSettings(raw,systemReducedMotion=false){
  const d=settingsDefaults(systemReducedMotion);if(!raw||typeof raw!=='object'||Array.isArray(raw))return d;
  for(const name of ['reducedMotion','lowQuality'])if(typeof raw[name]==='boolean')d[name]=raw[name];
  if([1,1.25,1.5].includes(Number(raw.uiScale)))d.uiScale=Number(raw.uiScale);
  if(['left','right'].includes(raw.touchHand))d.touchHand=raw.touchHand;
  if([0,16,32].includes(Number(raw.touchInset)))d.touchInset=Number(raw.touchInset);
  for(const name of ['musicVolume','effectsVolume'])if(Number.isFinite(Number(raw[name])))d[name]=clamp(raw[name],0,1);
  if(raw.bindings&&typeof raw.bindings==='object'){
    const candidate=copyBindings();for(const action of Object.keys(candidate)){const codes=raw.bindings[action];if(Array.isArray(codes)&&codes.length&&codes.length<=5&&codes.every(validCode))candidate[action]=[...new Set(codes)];}
    // A corrupt/conflicting map cannot silently remove an essential action.
    const flat=Object.values(candidate).flat();if(new Set(flat).size===flat.length)d.bindings=candidate;
  }return d;
}
export function keyLabel(code){return ({Space:'Space',ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',ShiftLeft:'L Shift',ShiftRight:'R Shift',Escape:'Esc',ControlLeft:'L Ctrl',ControlRight:'R Ctrl',AltLeft:'L Alt',AltRight:'R Alt'})[code]||code.replace(/^Key|^Digit|^Numpad/,'');}
export function createSettingsModel({storage=null,preview=false,systemReducedMotion=false,onChange=()=>{}}={}){
  let raw=null;if(!preview)try{raw=JSON.parse(storage?.getItem(SETTINGS_KEY)||'null');}catch{}
  let value=normaliseSettings(raw,systemReducedMotion);
  const persist=()=>{if(!preview)try{storage?.setItem(SETTINGS_KEY,JSON.stringify(value));}catch{}};
  const changed=()=>{persist();onChange(value);};
  return {get value(){return value;},update(patch){value=normaliseSettings({...value,...patch},systemReducedMotion);changed();return value;},resolveAction(code){return Object.keys(value.bindings).find(action=>value.bindings[action].includes(code))||null;},rebind(action,code){
    if(!Object.hasOwn(ACTION_LABELS,action)||!validCode(code))return {ok:false,message:'This key is reserved or unavailable.'};
    const conflict=Object.keys(value.bindings).find(other=>other!==action&&value.bindings[other].includes(code));
    if(conflict)return {ok:false,conflict,message:`${keyLabel(code)} is already assigned to: ${ACTION_LABELS[conflict]}.`};
    value.bindings={...value.bindings,[action]:[code]};changed();return {ok:true,message:`${ACTION_LABELS[action]}: ${keyLabel(code)}.`};
  },resetBindings(){value.bindings=copyBindings();changed();}};
}

export function createSettingsUI({document=globalThis.document,window=globalThis.window,storage,preview=false,onChange=()=>{},onOpen=()=>{},onClose=()=>{},onTutorialRepeat=()=>{}}={}){
  const $=id=>document.getElementById(id),screen=$('settingsScreen'),container=$('gameContainer');
  let capturing=null,previousFocus=null,modal=null,returnFocus=null,observer=null;
  const inertBefore=new Map(),listeners=[];
  const listen=(el,type,fn,options)=>{el?.addEventListener(type,fn,options);listeners.push(()=>el?.removeEventListener(type,fn,options));};
  let store=storage;if(store===undefined&&!preview)try{store=window.localStorage;}catch{}
  const systemReducedMotion=Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const model=createSettingsModel({storage:store,preview,systemReducedMotion,onChange:value=>{apply(value);renderBindings();onChange(value);}});
  function apply(value){
    document.documentElement.style.setProperty('--ui-scale',String(value.uiScale));document.documentElement.style.setProperty('--touch-inset',value.touchInset+'px');
    document.body.classList.toggle('touch-left',value.touchHand==='left');document.body.classList.toggle('reduced-motion',value.reducedMotion);
    for(const [id,key] of [['reduceMotion','reducedMotion'],['lowQuality','lowQuality']])if($(id))$(id).checked=value[key];
    for(const key of ['uiScale','touchHand','touchInset'])if($(key))$(key).value=String(value[key]);
    for(const key of ['musicVolume','effectsVolume']){if($(key))$(key).value=String(Math.round(value[key]*100));if($(key+'Value'))$(key+'Value').textContent=Math.round(value[key]*100)+'%';}
    for(const el of document.querySelectorAll('[data-key-action]')){const code=value.bindings[el.dataset.keyAction]?.[0];if(code)el.textContent=keyLabel(code);}
  }
  function renderBindings(){const grid=$('bindingGrid');if(!grid)return;const restore=document.activeElement?.dataset?.bindAction;grid.replaceChildren();for(const [action,label] of Object.entries(ACTION_LABELS)){
    const b=document.createElement('button');b.type='button';b.className='binding-button'+(capturing===action?' capturing':'');b.dataset.bindAction=action;
    const text=document.createElement('span');text.textContent=label;const key=document.createElement('kbd');key.textContent=capturing===action?'Press a key…':model.value.bindings[action].map(keyLabel).join(' / ');b.append(text,key);
    b.addEventListener('click',()=>{capturing=action;renderBindings();$('bindingMessage').textContent='Press a new key. Escape cancels.';grid.querySelector(`[data-bind-action="${action}"]`)?.focus();});grid.append(b);
  }if(restore)grid.querySelector(`[data-bind-action="${restore}"]`)?.focus({preventScroll:true});}
  function focusables(root){return [...root.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')].filter(el=>!el.hidden&&el.getClientRects().length&&!el.closest('[inert]'));}
  function syncFocus(){
    const next=screen.classList.contains('active')?screen:[...container.querySelectorAll('.screen.modal.active')].at(-1)||null;
    if(next===modal)return;
    for(const [el,old] of inertBefore)el.inert=old;inertBefore.clear();
    if(next){if(!modal)returnFocus=document.activeElement;for(const child of container.children){if(child===next||child.contains(next)||child.id==='runtimeNotice')continue;inertBefore.set(child,child.inert);child.inert=true;}if(!next.contains(document.activeElement))(focusables(next)[0]||next).focus({preventScroll:true});}
    else if(modal&&returnFocus?.isConnected&&!returnFocus.closest('[inert]'))returnFocus.focus({preventScroll:true});modal=next;
  }
  function open(){if(screen.classList.contains('active'))return;previousFocus=document.activeElement;onOpen();screen.classList.add('active');syncFocus();(focusables(screen)[0]||screen).focus({preventScroll:true});}
  function close(){if(!screen.classList.contains('active'))return;capturing=null;screen.classList.remove('active');renderBindings();onClose();syncFocus();if(previousFocus?.isConnected&&!previousFocus.closest('[inert]'))previousFocus.focus({preventScroll:true});}
  for(const id of ['settingsButton','pauseSettingsButton'])listen($(id),'click',open);listen($('closeSettings'),'click',close);
  for(const [id,key] of [['reduceMotion','reducedMotion'],['lowQuality','lowQuality']])listen($(id),'change',e=>model.update({[key]:e.target.checked}));
  for(const key of ['uiScale','touchHand','touchInset'])listen($(key),'change',e=>model.update({[key]:key==='touchHand'?e.target.value:Number(e.target.value)}));
  for(const key of ['musicVolume','effectsVolume'])listen($(key),'input',e=>model.update({[key]:Number(e.target.value)/100}));
  listen($('resetBindings'),'click',()=>{capturing=null;model.resetBindings();$('bindingMessage').textContent='Default key bindings restored.';});
  listen($('tutorialRepeatButton'),'click',()=>onTutorialRepeat());
  listen(window,'keydown',e=>{
    if(screen.classList.contains('active')){
      e.stopImmediatePropagation();
      if(capturing){e.preventDefault();if(e.repeat)return;if(e.code==='Escape'){capturing=null;renderBindings();$('bindingMessage').textContent='Rebinding cancelled.';return;}const result=model.rebind(capturing,e.code);$('bindingMessage').textContent=result.message;if(result.ok)capturing=null;renderBindings();return;}
      if(e.code==='Escape'){e.preventDefault();close();return;}
    }
    if(e.code==='Tab'&&modal){const notice=$('runtimeNotice'),controls=[...focusables(modal),...(notice&&!notice.hidden?focusables(notice):[])];if(!controls.length){e.preventDefault();modal.focus();return;}const first=controls[0],last=controls.at(-1),inside=modal.contains(document.activeElement)||notice?.contains(document.activeElement);if(e.shiftKey&&(document.activeElement===first||!inside)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!inside)){e.preventDefault();first.focus();}}
  },true);
  if(window.MutationObserver){observer=new window.MutationObserver(syncFocus);for(const el of container.querySelectorAll('.screen'))observer.observe(el,{attributes:true,attributeFilter:['class']});}
  apply(model.value);renderBindings();syncFocus();
  return {get value(){return model.value;},get isOpen(){return screen.classList.contains('active');},get isCapturing(){return capturing!==null;},resolveAction:code=>model.resolveAction(code),label:action=>keyLabel(model.value.bindings[action]?.[0]||''),update:patch=>model.update(patch),open,close,syncFocus,destroy(){observer?.disconnect();for(const dispose of listeners)dispose();for(const [el,old] of inertBefore)el.inert=old;inertBefore.clear();}};
}
