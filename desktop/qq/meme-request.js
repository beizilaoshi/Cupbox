// A narrow delivery action, not a rewrite of model output. Quoted text,
// setup questions and requests for specific emotions retain the model path.
export function generalMemeRequest(input){
  const text=String(input||'').trim().replace(/[，。！？!?、~～吧呗呀啦哦]+$/u,'').replace(/\s+/g,'');
  if(/别发|不要发|不用发|不许发|先别|他说|她说|翻译|例如|字符串|代码|[“”「」"`]/.test(text))return false;
  return /^(?:(?:请|麻烦|能否|可以|能不能|你能不能|你可以|帮我|给我|我想要|来|再|随便|随机)){0,4}(?:发|给|来|送|分享|要)(?:给我|我|点|个|一张|几张|一些|几个|一点|张){0,3}(?:表情包|表情图|梗图|贴纸|meme|sticker)(?:给我|用用|看看|用|来|点|吗|么|一下|一张|几个|给点){0,3}$/i.test(text)||/^我(?:都)?(?:没|没有|缺)(?:有)?表情包(?:用|用了|可用|了)?(?:了)?(?:给|发|来)(?:我|点|一些|几个|一张|点用用){0,3}$/.test(text);
}
export function memeAvailability(list,input,{enabled,last=0,now=Date.now(),cooldown=60},eligible){
  const total=list.length,allowed=list.filter(x=>x.enabled).length,configured=list.filter(x=>x.enabled&&x.meaning?.trim()).length,candidates=eligible(input,list);
  const reason=!enabled?'disabled':!total?'empty':!allowed?'not_allowed':!configured?'unconfigured':last&&now-last<cooldown*1000?'cooldown':!candidates.length?'restricted':'ready';
  return{reason,total,allowed,configured,eligible:candidates.length};
}
export const memeRequestReplies={disabled:'表情功能还没打开，得先请管理员开启一下。',empty:'我这边还没添加表情图，先请管理员加一组就能用了。',not_allowed:'图库里有图，不过还没允许我用，得先请管理员启用一下。',unconfigured:'图库里有图，还差一点使用设定，得先请管理员补一下。',cooldown:'刚发过一张，等会儿再给你。',restricted:'图库里有图，不过这次没有符合使用条件的。',failed:'这张图没发成功，先不重复发了。',unknown:'这张图有没有发出来还没确认，先不重复发了。',cancelled:'这张图刚被停用了，先不发啦。'};
