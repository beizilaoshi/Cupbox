import {randomUUID} from 'node:crypto';
import {BotEngine} from './engine.js';
import {validateSettings} from './store.js';

// A separate engine with a capture-only transport. It never receives the live
// bot, persistent memory, background scheduler or local/remote action tools.
export class ChatLab{
 constructor({settings,respond,filterReply,knowledge,resolveModelName}){Object.assign(this,{settings,respond,filterReply,knowledge,resolveModelName});this.messages=[];this.generation=0;this.sequence=0;}
 state(){return{messages:this.messages.slice(-60),busy:Boolean(this.pending),session:this.session||''};}
 reset(){this.generation++;this.engine?.stop();this.engine=null;this.signature='';this.messages=[];this.session=randomUUID();return this.state();}
 async send(draft={}){
  if(this.pending)throw Error('试聊正在生成，请先等待完成或停止');
  const text=typeof draft.text==='string'?draft.text.trim():'';
  if(!text||text.length>4000)throw Error('试聊内容需为1～4000字');
  const kind=draft.kind||'private',id=String(draft.id||'9999999999999992');
  if(!['private','group'].includes(kind)||!/^\d{5,16}$/.test(id)||id==='9999999999999991')throw Error('请选择会话类型，填写有效的群号或 QQ 号');
  const source=this.settings(),signature=JSON.stringify([source,kind,id]);
  if(this.signature!==signature){this.reset();this.signature=signature;
   const c=validateSettings({...source,enabled:true,mode:'chat',privateEnabled:true,privatePolicy:'all',allowedUsers:[],blockedUsers:[],groupPolicy:'all',blockedGroups:[],groupAt:true,
    cooldown:0,maxPerMinute:60,retainDialogue:false,listenContext:true,globalMemory:false,memoryTools:false,
    romanceMode:'off',companionEnabled:false,agentChat:false,proactiveEnabled:false,sleepReplyEnabled:false,searchEnabled:false,webFetchEnabled:false,visionEnabled:false,allowWorkTools:false,
    emojiEnabled:false,emojiMode:'standard',faceEnabled:false,voiceEnabled:false,ttsEnabled:false,weatherEnabled:false,reminderEnabled:false,slangEnabled:false,typingDelay:false,privateMention:false});
   this.engine=new BotEngine({settings:c,respond:async p=>{const result=await this.respond({...p,contextSession:'lab:'+this.session});this.lastUsage=result.usage;return result;},
    filterReply:this.filterReply,knowledge:this.knowledge,resolveModelName:this.resolveModelName,wait:async()=>{},
    send:async(_event,segments,signal)=>{signal.throwIfAborted();const reply=segments.filter(s=>s.type==='text').map(s=>s.data.text).join('');if(reply)this.messages.push({role:'assistant',text:reply,at:Date.now()});return{message_id:++this.sequence};}});
  }
  const generation=this.generation,started=Date.now();this.lastUsage=null;
  this.messages.push({role:'user',text,at:started});this.messages=this.messages.slice(-60);
  const event={post_type:'message',self_id:'9999999999999991',user_id:kind==='private'?id:'9999999999999992',...(kind==='group'?{group_id:id}:{}),message_type:kind,message_id:++this.sequence,sender:{nickname:'试聊用户'},message:[...(kind==='group'?[{type:'at',data:{qq:'9999999999999991'}}]:[]),{type:'text',data:{text}}]};
  const task=this.pending=this.engine.receive(event);
  try{const outcome=await task;if(generation!==this.generation)return{...this.state(),cancelled:true};const usage=this.lastUsage?{input:Number(this.lastUsage.prompt??this.lastUsage.input_tokens)||0,output:Number(this.lastUsage.completion??this.lastUsage.output_tokens)||0}:null;return{...this.state(),busy:false,outcome,durationMs:Date.now()-started,usage};}
  finally{if(this.pending===task)this.pending=null;}
 }
}
