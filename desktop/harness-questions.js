import {ipcMain} from 'electron';
import {randomUUID} from 'node:crypto';
export function installWorkQuestions(trusted){
 const pending=new Map();
 ipcMain.handle('chat:question-answer',(event,payload)=>{
  trusted(event);const item=pending.get(payload?.id);if(!item||item.sender.id!==event.sender.id)return false;
  if(payload.cancel){item.finish(Error('用户取消了这次提问'));return true;}
  if(!Array.isArray(payload.answers)||payload.answers.length!==item.questions.length)throw Error('请回答所有问题');
  const answers=item.questions.map(question=>{const answer=payload.answers.find(a=>a.id===question.id);if(!answer||!Array.isArray(answer.selected)||answer.selected.some(v=>typeof v!=='string'||!question.options?.some(o=>o.label===v))||!question.multiSelect&&answer.selected.length>1)throw Error('回答选项无效');const custom=typeof answer.custom==='string'?answer.custom.slice(0,8000):'';if(!custom&&!answer.selected.length)throw Error('请选择选项或填写回答');return{id:question.id,selected:custom&&!question.multiSelect?[]:[...new Set(answer.selected)],...(custom?{custom}:{})};});
  item.finish(null,{answers});return true;
 });
 return{ask(sender,questions,signal){if(!Array.isArray(questions)||!questions.length||questions.length>10)throw Error('问题数量无效');if(signal?.aborted||sender.isDestroyed())return Promise.reject(Error('任务已停止'));return new Promise((resolve,reject)=>{
  const id=randomUUID(),closed=()=>finish(Error('任务已停止'));
  const finish=(error,value)=>{if(!pending.delete(id))return;signal?.removeEventListener('abort',closed);sender.removeListener('destroyed',closed);if(!sender.isDestroyed())sender.send('chat:question-closed',id);error?reject(error):resolve(value);};
  pending.set(id,{sender,questions,finish});signal?.addEventListener('abort',closed,{once:true});sender.once('destroyed',closed);sender.send('chat:question',{id,questions});
 });}};
}
