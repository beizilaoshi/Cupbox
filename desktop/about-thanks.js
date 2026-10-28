export const THANKS_SOURCE='https://github.com/beizilaoshi/Cupbox/blob/main/thanks.json';
export const THANKS_ENDPOINT='https://raw.githubusercontent.com/beizilaoshi/Cupbox/main/thanks.json';
const MAX=128*1024;
const plain=(value,max)=>typeof value==='string'?value.replace(/<[^>]*>/g,'').replace(/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g,' ').trim().slice(0,max):'';
// Downloaded data is never interpreted as markup or code.
export function parseThanks(content){
 if(typeof content!=='string'||Buffer.byteLength(content)>MAX)throw Error('感谢名单文件过大或格式无效');
 const data=JSON.parse(content);
 if(data?.schemaVersion!==1||!Array.isArray(data.entries)||!data.entries.length||data.entries.length>200)throw Error('感谢名单版本或条目数量无效');
 return data.entries.map(row=>{
  const text=plain(row?.text,1500);if(!text)throw Error('感谢名单存在空白条目');
  if(row.links!==undefined&&!Array.isArray(row.links))throw Error('感谢名单链接格式无效');
  const links=[];
  for(const link of (row.links||[]).slice(0,8)){
   const label=plain(link?.label,120);if(!label||typeof link?.url!=='string'||link.url.length>2000)continue;
   try{const u=new URL(link.url);if(u.protocol==='https:'&&!u.username&&!u.password)links.push({label,url:u.href});}catch{}
  }
  return{text,links};
 });
}
// Keep the home argument for callers; no filesystem or bundled list is consulted.
export function createThanksSync(_home,{fetcher=globalThis.fetch,clock=Date.now}={}){
 let pending=null,verified=null;
 async function run(){
  try{
   const headers={accept:'application/json','user-agent':'Cupbox/1.2.0','cache-control':'no-cache',...(verified?.etag?{'if-none-match':verified.etag}:{})};
   const r=await fetcher(THANKS_ENDPOINT+'?t='+clock(),{signal:AbortSignal.timeout(10000),redirect:'error',headers,cache:'no-store'});
   let entries,etag;
   if(r.status===304&&verified){entries=verified.entries;etag=verified.etag;}
   else{
    if(!r.ok){await r.body?.cancel();throw Error('GitHub 返回 HTTP '+r.status);}
    const chunks=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>MAX)throw Error('GitHub 名单超过读取上限');chunks.push(chunk);}
    entries=parseThanks(Buffer.concat(chunks).toString('utf8'));
    const tag=r.headers.get('etag');etag=tag&&tag.length<=256&&!/[\r\n]/.test(tag)?tag:'';
   }
   verified={entries,etag};
   return{ok:true,entries,updatedAt:clock(),source:'github',url:THANKS_SOURCE,unchanged:r.status===304};
  }catch{
   // Never show a disk copy or an unverified old response as the current GitHub list.
   verified=null;
   return{ok:false,entries:[],updatedAt:0,source:'github',url:THANKS_SOURCE,error:'无法读取 GitHub 在线名单，请检查网络后重试。名单仅以 GitHub 为准。'};
  }
 }
 return{get(){if(pending)return pending;pending=run().finally(()=>{pending=null;});return pending;}};
}
