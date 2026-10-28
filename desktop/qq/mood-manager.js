import {createHash,randomUUID} from 'node:crypto';
import {safeMemoryText} from './security.js';
import {parseMood} from './mood.js';
export class MoodManager{
 constructor({memory,settings,judge,log=()=>{},clock=Date.now}){Object.assign(this,{memory,settings,judge,log,clock});this.pending=Promise.resolve();this.queued=0;this.epoch=0;this.controllers=new Set();}
 cancel(){this.epoch++;for(const c of this.controllers)c.abort();this.controllers.clear();}
 enqueue({event,key,prompt,reply,source='user',memoryEpoch}){
  const c=this.settings();if(!c.moodAIEnabled||!c.enabled||!c.retainDialogue||c.mode!=='chat'||!['user','speak-up'].includes(source)||!reply?.trim()||!safeMemoryText(prompt+' '+reply)||this.queued>=8)return;
  const generation=this.epoch,root=this.memory.root,rootEpoch=this.memory.epoch,targetEpoch=memoryEpoch??this.memory.epochFor(event),fingerprint=createHash('sha256').update(JSON.stringify([event.message_id||'',key,prompt,reply,source])).digest('hex'),token=randomUUID();this.queued++;
  const valid=()=>generation===this.epoch&&root===this.memory.root&&rootEpoch===this.memory.epoch&&targetEpoch===this.memory.epochFor(event)&&this.settings().enabled&&this.settings().moodAIEnabled&&this.settings().retainDialogue;
  const task=this.pending.catch(()=>{}).then(async()=>{
   if(!valid())return;const now=this.clock(),claim=await this.memory.claimMood(event,key,{token,fingerprint,config:c,now,valid});if(!claim)return;
   const controller=new AbortController();this.controllers.add(controller);const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]);
   try{const result=await this.judge({event,prompt:prompt.slice(0,1600),reply:reply.slice(0,1800),source,config:c,signal});signal.throwIfAborted();const delta=parseMood(result.text);if(valid())await this.memory.recordMood(event,key,{token,delta,config:c,source,now:this.clock(),valid});this.log('info','心情判断完成',{code:'MOOD_JUDGED',accepted:delta.confidence>=c.moodAIConfidence});}
   catch{this.log('warn',signal.aborted?'心情判断已取消或超时':'心情判断未完成，保留原状态',{code:'MOOD_UNCONFIRMED'});}finally{this.controllers.delete(controller);}
  }).finally(()=>{this.queued--;});this.pending=task.catch(()=>{});return task;
 }
}
