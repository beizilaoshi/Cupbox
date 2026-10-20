"use strict";
window.CupboxUX = (() => {
  const $=id=>document.getElementById(id), items=[];
  let confirmation=null, noticeFocus=null;
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  const severity=message=>/失败|无法|错误|不可用|拒绝/.test(message)?'error':/请先|先配置|尚未|需|等待|进行中/.test(message)?'warning':/已|成功|完成|复制/.test(message)?'success':'info';
  function icon(kind){const img=node('img');img.src=`assets/ui-${kind==='error'?'warning':kind==='success'?'success':kind==='warning'?'warning':'info'}.svg`;img.alt='';return img;}
  function renderNotices(){
    const box=$('notice-list');box.replaceChildren();$('notice-empty').hidden=Boolean(items.length);
    for(const item of items){const row=node('article',undefined,'notice-item');row.dataset.kind=item.kind;row.append(icon(item.kind));const copy=node('div');copy.append(node('b',item.title),node('p',item.message),node('time',new Date(item.at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})));row.append(copy);box.append(row);}
    $('notice-count').textContent=items.length?String(items.length):'';$('notice-toggle').setAttribute('aria-label',`通知，${items.length} 条记录`);
  }
  function notify(message,options={}){
    if(typeof options==='number')options={duration:options};const kind=options.kind||severity(message),title=options.title||({success:'操作完成',warning:'请留意',error:'操作未完成',info:'提示'}[kind]);
    const item={message:String(message),kind,title,at:Date.now()};items.unshift(item);items.length=Math.min(30,items.length);renderNotices();CupboxVisuals.pulse($('notice-toggle').querySelector('.ui-icon'));
    const host=$('toast'),card=node('div',undefined,'notice-toast');card.dataset.kind=kind;card.append(icon(kind));const copy=node('div');copy.append(node('b',title),node('p',String(message)));card.append(copy);
    const dismiss=node('button','×','notice-dismiss');dismiss.setAttribute('aria-label','关闭这条提示');dismiss.addEventListener('click',()=>card.remove());card.append(dismiss);host.hidden=false;host.prepend(card);
    while(host.children.length>3)host.lastElementChild.remove();
    // Errors stay until dismissed; every message remains available in the notification panel.
    let timer;const delay=options.duration||6500;const schedule=()=>{if(kind!=='error')timer=setTimeout(()=>card.remove(),delay);};schedule();card.addEventListener('mouseenter',()=>clearTimeout(timer));card.addEventListener('mouseleave',schedule);card.addEventListener('focusin',()=>clearTimeout(timer));card.addEventListener('focusout',schedule);
    const live=$(kind==='error'?'ux-alert':'ux-status');live.textContent='';setTimeout(()=>live.textContent=title+'。'+message,20);
    return {update(text,next={}){clearTimeout(timer);Object.assign(item,{message:text,kind:next.kind||item.kind,title:next.title||item.title});renderNotices();card.remove();},dismiss(){clearTimeout(timer);card.remove();}};
  }
  function closeNotices(){if($('notice-panel').hidden)return;$('notice-panel').hidden=true;$('notice-toggle').setAttribute('aria-expanded','false');noticeFocus?.focus();}
  function confirm(message,options={}){
    confirmation?.finish(false);closeNotices();const profile=CupboxRisk.describe(options.tool||'删除记录',options.args||{},options.risk),screen=$('ux-confirm');screen.dataset.level=profile.level;
    $('ux-confirm-title').textContent=options.title||profile.title;$('ux-confirm-message').textContent=message;$('ux-confirm-consequence').textContent=options.consequence||profile.consequence;
    $('ux-confirm-yes').textContent=options.action||profile.action;$('ux-confirm-check').checked=false;$('ux-confirm-ack').hidden=!profile.ack;$('ux-confirm-yes').disabled=profile.ack;screen.hidden=false;
    const focus=document.activeElement,surfaces=[...document.querySelectorAll('#app,.modal,.drawer,#notice-panel')].map(el=>[el,el.inert]);surfaces.forEach(([el])=>el.inert=true);
    return new Promise(resolve=>{confirmation={finish(value){screen.hidden=true;surfaces.forEach(([el,was])=>el.inert=was);confirmation=null;if(focus?.isConnected)focus.focus();resolve(value);}};$('ux-confirm-no').focus();});
  }
  function init(){
    $('notice-toggle').addEventListener('click',()=>{if(!$('notice-panel').hidden){closeNotices();return;}noticeFocus=document.activeElement;$('notice-panel').hidden=false;$('notice-toggle').setAttribute('aria-expanded','true');$('notice-close').focus();});
    $('notice-close').addEventListener('click',closeNotices);$('notice-clear').addEventListener('click',()=>{items.length=0;renderNotices();});
    $('ux-confirm-check').addEventListener('change',()=>$('ux-confirm-yes').disabled=!$('ux-confirm-check').checked);
    $('ux-confirm-yes').addEventListener('click',()=>{if(!$('ux-confirm-yes').disabled)confirmation?.finish(true);});$('ux-confirm-no').addEventListener('click',()=>confirmation?.finish(false));
    window.addEventListener('keydown',e=>{if(!confirmation){if(e.key==='Escape')closeNotices();return;}if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();confirmation.finish(false);}else if(e.key==='Tab'){e.preventDefault();e.stopImmediatePropagation();const focusables=[...$('ux-confirm').querySelectorAll('button:not(:disabled),input')].filter(el=>el.getClientRects().length);const index=focusables.indexOf(document.activeElement);focusables[(index+(e.shiftKey?-1:1)+focusables.length)%focusables.length].focus();}},true);
    document.addEventListener('pointerdown',e=>{if(!$('notice-panel').hidden&&!$('notice-panel').contains(e.target)&&!$('notice-toggle').contains(e.target))closeNotices();});renderNotices();
  }
  return {init,notify,confirm,closeNotices,cancelConfirmation:()=>confirmation?.finish(false)};
})();
