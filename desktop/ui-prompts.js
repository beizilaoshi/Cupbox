import {ipcMain} from 'electron';
import {randomUUID} from 'node:crypto';
// Decisions belong to one requesting window and expire; no renderer may approve another window.
const pending=new Map();
ipcMain.on('ui:prompt:answer',(event,p)=>{const item=pending.get(p?.id);if(!item||item.sender!==event.sender||!Number.isInteger(p.response))return;if(!item.buttons.includes(p.response)||item.ack&&p.response!==item.cancelId&&p.ack!==true)return;item.finish(p.response);});
export function uiMessageBox(window,options){
  const cancelId=options.cancelId??0;if(options.signal?.aborted)return Promise.resolve({response:cancelId});
  if(!window||window.isDestroyed()||window.webContents.isDestroyed())return Promise.resolve({response:cancelId});
  const sender=window.webContents,id=randomUUID(),buttons=options.buttons||['好'],ack=options.type==='warning';
  return new Promise(resolve=>{
    let timer;const cancel=()=>finish(cancelId),finish=response=>{if(!pending.delete(id))return;clearTimeout(timer);options.signal?.removeEventListener('abort',cancel);sender.removeListener('destroyed',cancel);sender.removeListener('did-start-navigation',cancel);if(!sender.isDestroyed())sender.send('ui:prompt:closed',id);resolve({response});};
    pending.set(id,{sender,ack,cancelId,buttons:buttons.map((_,i)=>i),finish});
    options.signal?.addEventListener('abort',cancel,{once:true});timer=setTimeout(cancel,120000);sender.once('destroyed',cancel);sender.once('did-start-navigation',cancel);
    if(window.isMinimized())window.restore();window.show();window.focus();
    sender.send('ui:prompt',{id,title:options.title||'操作确认',message:options.message||'',detail:options.detail||'',buttons,cancelId,ack,level:ack?'danger':'info',preview:typeof options.preview==='string'&&/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(options.preview)&&options.preview.length<12*1024*1024?options.preview:''});
  });
}
