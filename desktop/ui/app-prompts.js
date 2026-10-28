'use strict';
(() => {
  const bridge=window.cupbox||window.qqBot;if(!bridge?.onUiPrompt)return;
  const queue=[];let current;
  const dialog=document.createElement('dialog');dialog.id='app-risk-dialog';dialog.className='app-risk-dialog';
  dialog.setAttribute('aria-labelledby','app-risk-title');dialog.setAttribute('aria-describedby','app-risk-message app-risk-detail');
  dialog.innerHTML='<div class="app-risk-heading"><img src="assets/ui-warning.svg" alt=""><span id="app-risk-badge">操作确认</span></div><h2 id="app-risk-title"></h2><p id="app-risk-message"></p><div id="app-risk-detail"></div><img id="app-risk-preview" alt="本轮授权窗口截图预览" hidden><label class="app-risk-ack" id="app-risk-ack-row"><input type="checkbox" id="app-risk-ack">我已核对目标并了解上述影响，确认继续</label><div id="app-risk-buttons"></div><p class="app-risk-expiry">本次确认仅对当前操作有效，2 分钟未操作将自动取消。</p>';
  document.body.append(dialog);const $=id=>document.getElementById(id);
  function display(){if(current||!queue.length)return;current=queue.shift();dialog.dataset.level=current.level;dialog.dataset.promptId=current.id;dialog.dataset.cancelId=current.cancelId;$('app-risk-title').textContent=current.title;$('app-risk-message').textContent=current.message;$('app-risk-detail').textContent=current.detail;$('app-risk-preview').hidden=!current.preview;if(current.preview)$('app-risk-preview').src=current.preview;else $('app-risk-preview').removeAttribute('src');$('app-risk-badge').textContent=current.ack?'高风险 · 请重点核对':'操作确认';$('app-risk-ack').checked=false;$('app-risk-ack-row').hidden=!current.ack;$('app-risk-buttons').replaceChildren();
    current.buttons.forEach((text,index)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.dataset.response=index;b.className=index===current.cancelId?'btn-ghost2':current.ack?'btn-danger':'btn-run';b.disabled=current.ack&&index!==current.cancelId;b.onclick=()=>bridge.answerUiPrompt({id:current.id,response:index,ack:$('app-risk-ack').checked});$('app-risk-buttons').append(b);});dialog.showModal();$('app-risk-buttons').querySelector(`[data-response="${current.cancelId}"]`)?.focus();
  }
  $('app-risk-ack').onchange=()=>{for(const b of $('app-risk-buttons').children)b.disabled=current.ack&&Number(b.dataset.response)!==current.cancelId&&!$('app-risk-ack').checked;};
  dialog.addEventListener('cancel',e=>{e.preventDefault();if(current)bridge.answerUiPrompt({id:current.id,response:current.cancelId,ack:false});});
  bridge.onUiPrompt(p=>{queue.push(p);display();});bridge.onUiPromptClosed(id=>{const i=queue.findIndex(p=>p.id===id);if(i>=0)queue.splice(i,1);if(current?.id===id){dialog.close();current=null;display();}});
})();
