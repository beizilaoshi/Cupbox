import {isExtraChannel} from './channels/catalog.js';
export const OFFICIAL_DEFAULTS={connectionMode:'napcat'};
export const OFFICIAL_UNSUPPORTED=['qqImageEnabled','qzoneAutoImage','allowWorkTools','proactiveEnabled','quoteReply','replyMention','pokeEnabled','faceEnabled','asrEnabled','voiceEnabled','ttsEnabled','reminderEnabled','shareEnabled','relayEnabled','qzoneEnabled','profileLikeEnabled','outreachEnabled','ownerStoryEnabled','qqMusicEnabled'];
export function validateOfficial(c){
 if(!['napcat','official','weixin','wecom','feishu','dingtalk'].includes(c.connectionMode))throw Error('请选择有效的QQ接入方式');
 if(c.connectionMode==='official'||isExtraChannel(c.connectionMode)){
  if(isExtraChannel(c.connectionMode)){for(const key of ['emojiEnabled','visionEnabled','agentChat','segmentedStreaming'])c[key]=false;c.followUpWindow=0;}
  c.mode='chat';for(const key of OFFICIAL_UNSUPPORTED)if(key in c)c[key]=false;
 }
}
