// Independent adaptation of Amadeus's debounce/batch participation architecture.
import { ruleFor,parseMessage } from './engine.js';
export function canParticipate(event,c){return c.enabled&&c.mode==='chat'&&c.naturalConversation&&c.proactiveEnabled&&c.listenContext&&c.contextCount>0&&event.message_type==='group'&&c.proactiveGroups.includes(String(event.group_id))&&ruleFor(event,c).collect;}
const conversation=e=>`${e.self_id}:${e.message_type}:${e.message_type==='group'?e.group_id:e.user_id}`;
export class ChatScheduler{
  constructor({engine,settings,log=()=>{},clock=Date.now}){Object.assign(this,{engine,settings,log,clock});this.pending=new Map();this.seen=new Set();this.last=new Map();this.running=new Set();this.epoch=0;}
  stop(){this.epoch++;for(const slot of this.pending.values())clearTimeout(slot.timer);this.pending.clear();this.seen.clear();this.last.clear();}
  receive(event){
    const c=this.settings(),rule=ruleFor(event,c);if(!rule.collect)return this.engine.receive(event);
    const key=conversation(event),id=event.message_id===undefined?null:key+':'+event.message_id;
    if(id&&this.seen.has(id))return Promise.resolve({skipped:'重复事件'});if(id)this.seen.add(id);if(this.seen.size>3000)this.seen.delete(this.seen.values().next().value);
    const directKey=key+':user:'+event.user_id,existing=this.pending.get(directKey);
    if(rule.reply||existing){
      if(rule.reply&&event.message_type==='group')this.engine.proactiveControllers?.get('group:'+event.group_id)?.abort();
      const ambient=this.pending.get(key);if(ambient){clearTimeout(ambient.timer);this.pending.delete(key);}
      if(c.mergeMessages&&c.mode==='chat')return this.buffer(directKey,event,false,c);
      return this.engine.receive(event);
    }
    const result=this.engine.receive(event);if(canParticipate(event,c))this.buffer(key,event,true,c);return result;
  }
  buffer(key,event,proactive,c){
    if(!this.pending.has(key)&&this.pending.size>=100){this.log('warn','待合并会话已达上限，跳过本次调度');return Promise.resolve({skipped:'调度繁忙'});}
    const slot=this.pending.get(key)||{events:[],started:this.clock(),generation:this.engine.generation,epoch:this.epoch};clearTimeout(slot.timer);slot.events.push(event);slot.events=slot.events.slice(-50);slot.proactive=proactive;this.pending.set(key,slot);
    const delay=proactive?c.proactiveDelay*1000:c.mergeDelay;
    if(slot.events.length>=(proactive?c.proactiveBatch:8)||this.clock()-slot.started>=(proactive?60000:12000))return this.fire(key,slot);
    slot.timer=setTimeout(()=>{void this.fire(key,slot).catch(()=>this.log('error','聊天调度失败，请查看记忆文件或模型连接'));},delay);slot.timer.unref?.();
    this.log('debug',proactive?'收到群聊消息，等待空闲或批量阈值后判断是否接话':'正在等待同一人的连续消息',{conversation:key,count:slot.events.length});return Promise.resolve({buffered:true});
  }
  async fire(key,slot){
    if(this.pending.get(key)!==slot)return;clearTimeout(slot.timer);this.pending.delete(key);
    const c=this.settings(),last=slot.events.at(-1);
    if(slot.epoch!==this.epoch||slot.generation!==this.engine.generation)return{skipped:'设置或上下文已变化'};
    if(slot.proactive){
      if(!canParticipate(last,c)||this.running.has(key)||this.last.has(key)&&this.clock()-this.last.get(key)<c.proactiveCooldown*1000)return{skipped:'主动插话冷却或正在处理'};
      this.last.set(key,this.clock());while(this.last.size>1000)this.last.delete(this.last.keys().next().value);
    }
    // Never merge different speakers into one user turn. Ambient messages already
    // live in the engine's separate named turns; only the last message triggers.
    const event=slot.proactive?last:{...last,message:[...(slot.events.some(e=>parseMessage(e).mentioned)?[{type:'at',data:{qq:String(last.self_id)}}]:[]),{type:'text',data:{text:slot.events.map(e=>parseMessage(e).text||'[图片]').join('\n').slice(0,12000)}},...slot.events.flatMap(e=>Array.isArray(e.message)?e.message.filter(s=>s.type==='image'):[]).slice(0,2)]};
    this.log('info',slot.proactive?'开始判断是否适合加入群聊':'连续消息已合并，开始回复',{conversation:key,count:slot.events.length});this.running.add(key);
    try{return await this.engine.receive(event,{proactive:slot.proactive});}finally{this.running.delete(key);}
  }
}
