import {safeMemoryText} from './security.js';
const clean=value=>{const text=typeof value==='string'?value.replace(/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,80):'';return text&&safeMemoryText(text)?text:'';};
export function captureProfileNames(row,event){
 const nickname=clean(event.sender?.nickname),card=event.message_type==='group'?(event.sender&&Object.hasOwn(event.sender,'card')?clean(event.sender.card):clean(row?.qqCard)):'';
 return{qqNickname:nickname||clean(row?.qqNickname),qqCard:card,};
}
export function profileDisplayName(row,data){
 const user=String(row.key||'').split(':')[0];let automatic=clean(row.qqCard)||clean(row.qqNickname);
 if(!automatic){const turn=[...(data.turns||[])].reverse().find(t=>t.role==='user'&&String(t.sender?.qq)===user&&clean(t.sender?.nickname));automatic=clean(turn?.sender?.nickname);}
 return{displayLabel:clean(row.userLabel)||automatic||'QQ '+user,autoUserLabel:automatic,qqNickname:clean(row.qqNickname),qqCard:clean(row.qqCard)};
}
