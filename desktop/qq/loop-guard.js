import {createHash,randomUUID} from 'node:crypto';
const digest=text=>createHash('sha256').update(text.normalize('NFKC').replace(/\s+/g,' ').trim().slice(0,12000)).digest('hex');
const textOf=segments=>(Array.isArray(segments)?segments:[]).filter(s=>s?.type==='text').map(s=>String(s.data?.text||'')).join('\n');
const keyOf=e=>[e.self_id,e.message_type,e.message_type==='group'?e.group_id:e.user_id,e.user_id].join(':');
export class LoopGuard{
 constructor({clock=Date.now,peers=()=>[]}={}){this.clock=clock;this.peers=peers;this.rooms=new Map();this.blocked=0;this.lastReason='';}
 admit(event,c){
  if(event.post_type!=='message'||!c.loopGuardEnabled)return{allowed:true};
  if(c.connectionMode==='napcat'&&(event.sender?.is_bot||[...this.peers(),...(c.loopGuardPeers||[])].map(String).includes(String(event.user_id))))return this.block('已识别机器人账号，阻止相互自动回复','BOT_PEER');
  const key=keyOf(event),now=this.clock(),row=this.rooms.get(key);
  if(row?.until>now)return this.block('此会话正在互刷冷却中','LOOP_COOLDOWN');
  const input=textOf(event.message);if(!input.trim())return{allowed:true};
  const recent=(row?.turns||[]).filter(t=>now-t.at<90000),signature=digest(input);
  if(recent.length>=3&&recent.slice(-3).every(t=>t.input===signature&&t.output===recent.at(-1).output)){
   row.until=now+120000;return this.block('90秒内连续3轮相同问答，暂停此用户在此会话的自动回复2分钟','REPEATED_EXCHANGE');
  }
  // Bound pending entries too, including requests that never receive a reply.
  this.rooms.set(key,{...row,turns:recent,until:0,pending:{input:signature,id:String(event.message_id||randomUUID())}});
  while(this.rooms.size>500)this.rooms.delete(this.rooms.keys().next().value);
  return{allowed:true};
 }
 block(reason,code){this.blocked++;this.lastReason=reason;return{allowed:false,reason,code};}
 outgoing(event,segments){if(!event.message_id)return;const row=this.rooms.get(keyOf(event));if(!row?.pending||row.until>this.clock())return;const output=textOf(segments);if(!output.trim())return;const id=String(event.message_id);if(id!==row.pending.id)return;const prior=row.turns.find(t=>t.id===id);if(prior){prior.output=digest(prior.text+'\n'+output);prior.text=(prior.text+'\n'+output).slice(0,12000);}else row.turns.push({id,input:row.pending.input,output:digest(output),text:output.slice(0,12000),at:this.clock()});row.turns=row.turns.slice(-3);}
 status(){return{blocked:this.blocked,lastReason:this.lastReason,pauses:[...this.rooms.entries()].filter(([,r])=>r.until>this.clock()).map(([key,r])=>({id:key,until:r.until})).slice(0,100)};}
 resume(id){if(typeof id!=='string'||!this.rooms.has(id))throw Error('互刷冷却记录已不存在');this.rooms.delete(id);}
 reset(){this.rooms.clear();}
}
