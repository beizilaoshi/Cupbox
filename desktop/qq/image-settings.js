export const IMAGE_DEFAULTS={qqImageEnabled:false,qqImageModelId:'',qqImagePrefix:'画图',qqImageDailyLimit:10,qqImageCooldown:60,qzoneAutoImage:false};
export function validateImage(c){
 if(typeof c.qqImageModelId!=='string'||c.qqImageModelId.length>200)throw Error('生图模型无效');
 if(typeof c.qqImagePrefix!=='string'||!c.qqImagePrefix.trim()||c.qqImagePrefix.length>20||/[\s\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(c.qqImagePrefix))throw Error('生图前缀为1～20字，不能包含空格和隐藏字符');
 for(const [k,min,max]of [['qqImageDailyLimit',1,100],['qqImageCooldown',10,3600]])if(!Number.isInteger(c[k])||c[k]<min||c[k]>max)throw Error('生图每日上限或冷却时间无效');
 if(c.qzoneAutoImage&&!c.qqImageEnabled)throw Error('自动空间配图需要先开启AI生图');
}
