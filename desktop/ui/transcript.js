/* Tool-row presentation inspired by DeepSeek Harness (MIT); native Cupbox UI. */
'use strict';
window.CupboxTranscript=(()=>{
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 function safe(value){return String(typeof value==='string'?value:JSON.stringify(value,null,2)??'').replace(/data:[^;,]+;base64,[A-Za-z0-9+/=]+/g,'[图片数据]').replace(/Bearer\s+[^\s"',}]+/gi,'Bearer [已隐藏]').replace(/\b(?:sk|sess)-[A-Za-z0-9_-]{8,}/g,'[密钥已隐藏]').replace(/((?:api[_-]?key|token|password|secret)["']?\s*[:=]\s*["']?)[^\s,"';}]+/gi,'$1[已隐藏]').slice(0,24000);}
 function summary(call){const a=call.args||{};return safe(a.file_path||a.path||a.command||a.pattern||a.query||a.url||a.objective||a.description||a.sessionId||'').replace(/[\r\n]+/g,' ').slice(0,180);}
 function row(call){
  const el=node('details',undefined,'harness-tool-row running');el.dataset.callId=call.id||'';
  const head=node('summary'),icon=node('span','', 'harness-tool-state'),title=node('span',window.CupboxResponse?.toolName(call.name)||call.name,'harness-tool-name'),detail=node('span',summary(call),'harness-tool-summary'),status=node('span','执行中','harness-tool-status');
  head.append(icon,title,detail,status);el.append(head);
  const body=node('div',undefined,'harness-tool-body'),input=node('pre',safe(call.args||{}),'harness-tool-input'),output=node('pre','','harness-tool-output');body.append(node('small','输入参数'),input,node('small','执行结果'),output);el.append(body);
  return{el,finish(item){el.classList.remove('running');el.classList.add(item.ok?'ok':'bad');status.textContent=(item.ok?'完成':'失败')+' · '+((item.durationMs||0)/1000).toFixed(2)+'s';output.textContent=safe(item.output||item.result||item.error||'工具未返回正文');if(!item.ok)el.open=true;}};
 }
 function history(trace){const group=node('details',undefined,'harness-tool-history'),head=node('summary','执行记录 · '+trace.length+' 次工具调用');group.append(head);for(const item of trace){const r=row(item);r.finish(item);group.append(r.el);}return group;}
 class TextFlow{
  constructor({parent,onPaint=()=>{},speed=55}={}){this.el=node('div',undefined,'msg assistant streaming-response');this.content=node('div',undefined,'response-flow-content');this.skip=node('button','立即显示','response-flow-skip');this.skip.type='button';this.el.append(this.content,this.skip);this.skip.addEventListener('click',()=>this.flush());this.text='';this.shown=0;this.speed=speed;this.onPaint=onPaint;this.parent=parent;this.last=performance.now();this.done=false;this.cancelled=false;this.timer=null;this.skip.hidden=true;}
  mount(){if(!this.el.isConnected)this.parent?.append(this.el);}
  append(delta){if(this.cancelled||!delta)return;this.text+=delta;this.mount();this.schedule();}
  finish(text){if(this.cancelled)return;this.done=true;this.text=String(text||'');this.mount();if(this.immediate||matchMedia('(prefers-reduced-motion: reduce)').matches){this.flush();return;}this.schedule();}
  schedule(){if(this.timer!==null)return;this.skip.hidden=!!this.immediate;this.el.classList.add('streaming-response');this.el.setAttribute('aria-busy','true');this.last=performance.now();this.timer=requestAnimationFrame(now=>this.tick(now));}
  tick(now){this.timer=null;if(this.cancelled)return;if(!this.el.isConnected){this.cancel();return;}const elapsed=Math.max(0,now-this.last);this.last=now;const next=this.immediate?this.text.length:Math.min(this.text.length,this.shown+this.speed*Math.min(elapsed,100)/1000);const changed=Math.floor(next)!==Math.floor(this.shown);this.shown=next;if(changed&&(now-(this.lastPaint||0)>65||next===this.text.length)){this.lastPaint=now;this.paint();}if(this.shown<this.text.length)this.timer=requestAnimationFrame(n=>this.tick(n));else if(this.done)this.complete();}
  paint(){const visible=this.text.slice(0,this.shown);this.content.replaceChildren(window.CupboxResponse.render(visible));this.onPaint();}
  complete(){this.skip.hidden=true;this.el.classList.remove('streaming-response');this.el.removeAttribute('aria-busy');}
  flush(){this.immediate=true;if(this.timer!==null)cancelAnimationFrame(this.timer);this.timer=null;this.shown=this.text.length;this.paint();if(this.done)this.complete();else this.skip.hidden=true;}
  cancel(){this.cancelled=true;if(this.timer!==null)cancelAnimationFrame(this.timer);this.timer=null;this.el.remove();}
 }
 return{row,history,TextFlow,safe};
})();
