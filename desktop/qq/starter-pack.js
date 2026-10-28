import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
export const STARTER_MEMES=[
  {key:'cupbox-cat-wave-v1',file:'cat-wave.png',mood:'开心',name:'猫咪 · 打招呼',meaning:'友善地打招呼、欢迎或轻松问候。适合普通日常，不用于嘲讽或严肃坏消息。',triggers:['你好','嗨','欢迎']},
  {key:'cupbox-cat-ok-v1',file:'cat-ok.png',mood:'得意',name:'猫咪 · 收到啦',meaning:'表示收到、理解、认可或为小进展点赞。语气友好，不用于敷衍求助或嘲讽。',triggers:['收到','好的','成功']},
  {key:'cupbox-cat-heart-v1',file:'cat-heart.png',mood:'卖萌',name:'猫咪 · 比个心',meaning:'表达感谢、支持、友善的在意或轻松比心。不是关系确认，不擅自表白，不在对方拒绝时使用。',triggers:['谢谢','比心','喜欢']},
];
export async function installStarterMemes(store){
  return store.change(async()=>{const list=await store.emojis();let added=0;
    const missing=STARTER_MEMES.filter(m=>!list.some(x=>x.starterKey===m.key));if(list.length+missing.length>1000)throw Error('图库已满，请先移出一些图片');
    await mkdir(path.join(store.root,'emojis'),{recursive:true});
    for(const item of missing){const bytes=await readFile(fileURLToPath(new URL('../ui/assets/memes/'+item.file,import.meta.url)));if(bytes.length>8*1024*1024)throw Error('内置图片大小异常');const id=randomUUID(),file=id+'.png';await writeFile(path.join(store.root,'emojis',file),bytes,{flag:'wx',mode:0o600});list.push({id,file,name:item.name,meaning:item.meaning,triggers:item.triggers,starterKey:item.key,mood:item.mood,selectionMode:'semantic',enabled:true});added++;}
    await store.write('emojis.json',list);return{added};});
}
