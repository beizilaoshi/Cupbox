import {readFile,stat,mkdir,writeFile,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {isBitmap} from './capabilities.js';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=message=>Object.assign(Error(message),{publicMessage:message});
/** Sequential decoding bounds memory; each successful item is committed separately. */
export async function importEmojiBatch(store,files){
  if(!Array.isArray(files)||!files.length||files.length>100||files.some(f=>typeof f!=='string'||!f))throw Error('每次请选择 1～100 张表情图片');
  return store.change(async()=>{
    const list=await store.emojis(),known=new Set(),results=[];
    for(const item of list){if(item.sha256){known.add(item.sha256);continue;}try{known.add(hash(await readFile(await store.emojiFile(item))));}catch{/* An unreadable existing item must not block new imports. */}}
    const sharp=(await import('sharp')).default;
    for(const file of files){const name=path.basename(file).slice(0,80);let target;
      try{
        const info=await stat(file);if(!info.isFile())throw fail('请选择图片文件');if(info.size>8*1024*1024)throw fail('图片超过 8 MB');
        const bytes=await readFile(file);if(bytes.length>8*1024*1024)throw fail('图片超过 8 MB');if(!isBitmap(bytes))throw fail('不是有效的 PNG/JPEG/GIF/WebP 位图');
        const sha256=hash(bytes);if(known.has(sha256)){results.push({name,status:'skipped',reason:'相同图片已在图库中'});continue;}
        if(list.length>=1000){results.push({name,status:'skipped',reason:'图库已满（最多 1000 张）'});continue;}
        let meta;try{meta=await sharp(bytes,{limitInputPixels:20000000}).metadata();await sharp(bytes,{limitInputPixels:20000000}).resize(1,1,{fit:'inside'}).png().toBuffer();}catch{throw fail('图片损坏或尺寸超过 2000 万像素');}
        if(!['png','jpeg','gif','webp'].includes(meta.format))throw fail('仅支持 PNG/JPEG/GIF/WebP');
        const id=randomUUID(),managed=id+'.'+meta.format,item={id,file:managed,name,sha256,meaning:'',triggers:[],mood:'',selectionMode:'semantic',enabled:false};
        await mkdir(path.join(store.root,'emojis'),{recursive:true});const destination=path.join(store.root,'emojis',managed);await writeFile(destination,bytes,{flag:'wx',mode:0o600});target=destination;
        await store.write('emojis.json',[...list,item]);list.push(item);known.add(sha256);target=undefined;
        results.push({name,status:'imported',reason:'已导入，待配置含义并允许使用'});
      }catch(error){if(target)await unlink(target).catch(()=>{});results.push({name,status:'failed',reason:error.publicMessage||(['ENOENT','EACCES','EPERM'].includes(error.code)?'文件不存在或无法读取':'无法保存此图片，请检查文件与磁盘空间')});}
    }
    return{imported:results.filter(r=>r.status==='imported').length,skipped:results.filter(r=>r.status==='skipped').length,failed:results.filter(r=>r.status==='failed').length,results};
  });
}
