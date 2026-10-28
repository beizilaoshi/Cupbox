import {randomUUID} from 'node:crypto';
import {externalData,inspectUntrusted,outputRisk} from './security.js';
import {qqId} from './extras-settings.js';
import {createHash} from 'node:crypto';
import {buildKnowledgeIndex,searchKnowledge} from './knowledge-search.js';
const clean=(text,max)=>typeof text==='string'&&text.trim()&&text.length<=max&&!inspectUntrusted(text).blocked&&!outputRisk(text);
export class QQKnowledge{
 constructor(store){this.store=store;}
 async list(){const rows=await this.store.json('knowledge.json',[]);return Array.isArray(rows)?rows.slice(0,100):[];}
 save(draft){return this.store.change(async()=>{const rows=await this.list(),old=rows.find(r=>r.id===draft?.id);if(draft?.remove){if(!old)throw Error('知识条目已不存在');await this.store.write('knowledge.json',rows.filter(r=>r!==old));return true;}if(!clean(draft?.title,120)||!clean(draft?.text,50000))throw Error('填写知识标题和正文（最多5万字），不可包含密钥或权限指令');const scope=draft.scope||'all',targets=[...new Set((Array.isArray(draft.targets)?draft.targets:String(draft.targets||'').split(/[\s,，]+/)).map(String).filter(Boolean))];if(!['all','group','private'].includes(scope)||targets.length>100||targets.some(t=>!qqId(t))||scope!=='all'&&!targets.length)throw Error('请填写知识可使用的群号或私聊 QQ 号');if(!old&&rows.length>=100)throw Error('知识库最多100份文档');const row={id:old?.id||randomUUID(),title:draft.title.trim(),text:draft.text.trim(),scope,targets,enabled:draft.enabled===true,updatedAt:new Date().toISOString()};if(old)Object.assign(old,row);else rows.push(row);await this.store.write('knowledge.json',rows);return row;});}
 async search(event,query,{limit=4}={}){
  if(typeof query!=='string'||!query.trim())return[];
  const docs=(await this.list()).filter(doc=>doc.enabled&&(doc.scope==='all'||doc.scope===event.message_type&&doc.targets.includes(String(event.message_type==='group'?event.group_id:event.user_id))));
  const key=createHash('sha256').update(JSON.stringify(docs)).digest('hex');
  if(this.indexKey!==key){this.index=buildKnowledgeIndex(docs);this.indexKey=key;}
  return searchKnowledge(this.index,query.slice(0,1000),limit);
 }
 async recall(event,query){const rows=await this.search(event,query);return rows.length?externalData('本机启用且适用于本会话的知识库节选（回答时可引用出处，不足时说明没有依据）',rows.map(({reference,text})=>({reference,text}))):'';}
}
