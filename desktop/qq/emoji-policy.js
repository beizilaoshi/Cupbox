import {safeMemoryText} from './security.js';
export const stripEmojiMarkers=text=>String(text).replace(/\[\[\s*emoji\s*[:：][^\]]*\]\]/gi,'');
export const eligibleEmojis=(input,list)=>list.filter(x=>x.enabled&&x.meaning?.trim()&&safeMemoryText(x.meaning+' '+(x.name||''))&&(x.selectionMode==='semantic'||x.triggers?.some(t=>String(input).toLowerCase().includes(t.toLowerCase()))));
export const emojiReasons={disabled:'表情总开关未开启',cooldown:'该会话的表情冷却尚未结束',no_match:'没有符合当前发送方式、已启用且含义完整的表情',model_wait:'仅模型判断模式：本次模型没有选择符合条件的表情',model:'模型选择了允许的表情',trigger:'命中已配置触发词，按自动规则选择表情'};
export function selectEmoji(text,input,list,enabled,last=0,now=Date.now(),cooldown=60){
  const ids=[...String(text).matchAll(/\[\[\s*emoji\s*[:：]\s*([a-zA-Z0-9-]+)\s*\]\]/gi)].map(m=>m[1]),clean=stripEmojiMarkers(text).trim();let reason,selected;
  if(!enabled)reason='disabled';else if(last&&now-last<cooldown*1000)reason='cooldown';else{const eligible=eligibleEmojis(input,list);selected=eligible.find(x=>ids.includes(x.id));if(selected)reason='model';else{selected=eligible.find(x=>(x.selectionMode||'trigger')==='trigger');reason=selected?'trigger':eligible.length?'model_wait':'no_match';}}
  return{clean,selected,reason,explanation:emojiReasons[reason]+(reason==='cooldown'?`（还需约 ${Math.ceil((cooldown*1000-(now-last))/1000)} 秒）`:'')};
}
