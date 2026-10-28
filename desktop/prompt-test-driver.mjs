// GUI verification helper: clicks the real themed dialog; never shipped as an approval bypass.
import {app,BrowserWindow} from 'electron';
let handler=()=>0;
export function setPromptResponse(value){handler=typeof value==='function'?value:()=>value;}
const busy=new Set();
const timer=setInterval(()=>{if(!app.isReady())return;for(const win of BrowserWindow.getAllWindows()){
  const wc=win.webContents;if(wc.isDestroyed()||wc.isLoading()||busy.has(wc.id))continue;busy.add(wc.id);
  void (async()=>{try{const p=await wc.executeJavaScript(`(()=>{const d=document.querySelector('#app-risk-dialog');if(!d?.open)return null;return{id:d.dataset.promptId,title:d.querySelector('h2').textContent,message:d.querySelector('#app-risk-message').textContent,detail:d.querySelector('#app-risk-detail').textContent,buttons:[...d.querySelectorAll('#app-risk-buttons button')].map(b=>b.textContent),cancelId:Number(d.dataset.cancelId)}})()`);if(!p)return;const result=await handler(p);const response=typeof result==='number'?result:result.response;await wc.executeJavaScript(`(()=>{const d=document.querySelector('#app-risk-dialog');if(!d?.open||d.dataset.promptId!==${JSON.stringify(p.id)})return;const ack=d.querySelector('#app-risk-ack');if(!ack.checked&&!d.querySelector('#app-risk-ack-row').hidden)ack.click();d.querySelector('[data-response="${Number(response)}"]')?.click();})()`);}catch{/* Window may close while a choice is being clicked. */}finally{busy.delete(wc.id);}})();
}},45);timer.unref();
