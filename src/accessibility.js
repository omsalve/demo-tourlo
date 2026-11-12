export function setupDialogFocus() {
  let current=null;
  const previous=new WeakMap();
  const visible=()=>[...document.querySelectorAll('[role="dialog"][aria-modal="true"],.voice-panel')].filter(el=>!el.hidden&&el.offsetParent!==null).sort((a,b)=>(+getComputedStyle(a).zIndex||0)-(+getComputedStyle(b).zIndex||0)).at(-1);
  const focusables=el=>[...el.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select,textarea,[tabindex="0"]')].filter(x=>x.offsetParent!==null);
  new MutationObserver(()=>{
    const next=visible(); if(next===current)return;
    const old=current; current=next;
    if(next){if(!previous.has(next))previous.set(next,document.activeElement);if(!next.contains(document.activeElement))focusables(next)[0]?.focus();}
    else if(old){const target=previous.get(old);previous.delete(old);if(target?.isConnected)target.focus();}
  }).observe(document.body,{attributes:true,attributeFilter:['hidden'],subtree:true});
  document.addEventListener('keydown',e=>{
    const dialog=visible(); if(!dialog)return;
    if(e.key==='Tab'){const items=focusables(dialog);if(!items.length)return;const first=items[0],last=items.at(-1);if(e.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){e.preventDefault();first.focus();}}
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();dialog.querySelector('[data-later],[data-close-saved],.voice-close,#final-close')?.click();}
  },true);
}
