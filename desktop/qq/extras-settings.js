export const EXTRAS_DEFAULTS={loopGuardEnabled:true,loopGuardPeers:[],knowledgeEnabled:false,relayEnabled:false,relayRequesters:[],deliveryTargets:[],relayDailyLimit:10,qqMusicEnabled:false,qqMusicSource:'echo',qqMusicWebSearch:false,qzoneEnabled:false,shareEnabled:false};
export const qqId=v=>/^\d{5,16}$/.test(String(v));
export const MUSIC_WAIT_TEXT='我看看《{歌曲名}》在哪里呢，稍等一下～';
Object.assign(EXTRAS_DEFAULTS,{qqMusicGroupMode:'direct',qqMusicPrefix:'点歌',qqMusicReplyMode:'list',qqMusicWaitText:MUSIC_WAIT_TEXT});
Object.assign(EXTRAS_DEFAULTS,{socialGroups:[],socialInterval:60,socialDailyLimit:3,socialTopics:'',shareMode:'manual',storyRecipients:[],qzoneMode:'manual',qzoneAutoRights:64,pokeReplyMode:'ai',pokePresets:'喵？谁在戳我～\n再戳就抓住你的手啦。',pokeCooldown:30,profileLikeEnabled:false,profileLikeUsers:[],profileLikeTimes:10});
export function validateExtras(c){
 if(!['echo','local'].includes(c.qqMusicSource))throw Error('请选择有效的点歌曲库');
 if(!['mention','direct'].includes(c.qqMusicGroupMode))throw Error('请选择群聊点歌触发模式');
 if(!['list','first'].includes(c.qqMusicReplyMode))throw Error('请选择点歌回复模式');
 if(typeof c.qqMusicWaitText!=='string'||c.qqMusicWaitText.length>300||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(c.qqMusicWaitText))throw Error('点歌等待提示最多300字，不能包含隐藏控制字符');
 c.qqMusicWaitText=c.qqMusicWaitText.trim()||MUSIC_WAIT_TEXT;
 if(typeof c.qqMusicPrefix!=='string'||!c.qqMusicPrefix.trim()||c.qqMusicPrefix.trim().length>20||/[\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(c.qqMusicPrefix))throw Error('点歌前缀需为1～20字，不能包含换行或隐藏控制字符');c.qqMusicPrefix=c.qqMusicPrefix.trim();
 for(const key of ['socialGroups','storyRecipients','profileLikeUsers','loopGuardPeers']){if(!Array.isArray(c[key]))throw Error('社交名单格式无效');c[key]=[...new Set(c[key].map(String))];if(c[key].length>(key==='storyRecipients'?20:100)||c[key].some(v=>!qqId(v)))throw Error('请填写有效 QQ 号或群号（告状接收者最多20人，其他名单最多100项）');}
 for(const key of ['shareMode','qzoneMode'])if(!['manual','ai'].includes(c[key]))throw Error('社交模式无效');
 if(!['preset','ai'].includes(c.pokeReplyMode))throw Error('戳戳模式无效');
 for(const [key,min,max]of [['socialInterval',15,1440],['socialDailyLimit',1,20],['pokeCooldown',5,3600],['profileLikeTimes',1,10]]){c[key]=Number(c[key]);if(!Number.isInteger(c[key])||c[key]<min||c[key]>max)throw Error('社交频率或点赞数量超出范围');}
 if(![1,4,64].includes(Number(c.qzoneAutoRights)))throw Error('自动空间可见范围无效');c.qzoneAutoRights=Number(c.qzoneAutoRights);
 if(typeof c.socialTopics!=='string'||c.socialTopics.length>800||typeof c.pokePresets!=='string'||c.pokePresets.length>2000||!c.pokePresets.trim())throw Error('话题或戳戳预设无效');
 if(c.shareEnabled&&c.shareMode==='ai'&&!c.storyRecipients.length)throw Error('请填写允许告状／分享的接收用户');
 if(!Array.isArray(c.relayRequesters))throw Error('传话请求者名单格式无效');c.relayRequesters=[...new Set(c.relayRequesters.map(String))];if(c.relayRequesters.length>100||c.relayRequesters.some(v=>!qqId(v)))throw Error('传话请求者需填写有效 QQ 号');
 if(!Array.isArray(c.deliveryTargets)||c.deliveryTargets.length>50)throw Error('最多设置50个分享/传话目标');const names=new Set();c.deliveryTargets=c.deliveryTargets.map(t=>{if(!t||!['private','group'].includes(t.kind)||!qqId(t.id)||typeof t.name!=='string'||!t.name.trim()||t.name.length>40||names.has(t.name.trim()))throw Error('接收目标需为不重名的别名、有效 QQ 号或群号');names.add(t.name.trim());return{name:t.name.trim(),kind:t.kind,id:String(t.id)};});
 const n=Number(c.relayDailyLimit);if(!Number.isInteger(n)||n<1||n>50)throw Error('传话每日上限为1～50次');c.relayDailyLimit=n;
 if(c.relayEnabled&&(!c.relayRequesters.length||!c.deliveryTargets.length))throw Error('启用传话前请填写请求者和接收目标');
}
