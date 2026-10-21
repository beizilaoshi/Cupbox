import {readFileSync} from 'node:fs';
import {eligibleEmojis} from './emoji-policy.js';
export const WHALE_SOURCE={repository:'https://github.com/chennianlaobai/qq-ai-bot',commit:'5f998029bd90bacace68fa2c719722976470f44d',nickname:'鲸鱼娘'};
export const WHALE_PROMPT=readFileSync(new URL('./vendor/qq-ai-bot/persona.md',import.meta.url),'utf8');
export const WHALE_RULES=JSON.parse(readFileSync(new URL('./vendor/qq-ai-bot/persona_rules.json',import.meta.url),'utf8'));
export const WHALE_MOODS=['开心','无语','生气','卖萌','得意','委屈','震惊'];
export const upstreamWhale=c=>c.mode==='chat'&&c.persona==='whale';
export const whaleRuntime=c=>upstreamWhale(c)?{...c,identityName:'鲸鱼娘',identityPersonality:'',identityRules:'',customPrompt:'',rolePresentation:'character',replyStyle:'casual',romanceMode:'off',segmentedStreaming:c.whaleSplitLines!==false,segmentMode:'lines'}:c;
export const stripWhaleMarkers=text=>String(text||'').replace(/\[表情\s*[:：][^\]\r\n]*\]/g,'').trim();
export function whaleEmojiPrompt(list,input,c,last,now){
  const eligible=eligibleEmojis(input,list).filter(e=>WHALE_MOODS.includes(e.mood));
  const moods=[...new Set(eligible.map(e=>e.mood))];
  return '本应用表情适配：沿用人设的 [表情:情绪] 格式，程序会移除标记并发送真实图片。当前总开关'+(c.emojiEnabled?'开启':'关闭')+'；图库真实总数 '+list.length+'；本轮已允许且符合关键词/含义配置的情绪为 '+JSON.stringify(c.emojiEnabled&&(!last||now-last>=c.emojiCooldown*1000)?moods:[])+'。没有获准的对应情绪就用文字，不输出标记、不编造已发图、不从别的情绪随机取图。图片只用本机用户允许的素材。工具能力和发送结果以程序状态为准。';
}
export function pickWhaleEmoji(text,input,list,c,last=0,now=Date.now()){
  const clean=stripWhaleMarkers(text),match=String(text).match(/\[表情\s*[:：]\s*(开心|无语|生气|卖萌|得意|委屈|震惊)\s*\]/);
  let reason,selected;if(!c.emojiEnabled)reason='disabled';else if(last&&now-last<c.emojiCooldown*1000)reason='cooldown';else if(match){selected=eligibleEmojis(input,list).find(e=>e.mood===match[1]);reason=selected?'model':'no_match';}else reason='model_wait';
  return{clean,selected,reason,explanation:selected?'源人设情绪标记已匹配到获准图片':reason==='cooldown'?'源人设表情仍在冷却':reason==='disabled'?'表情总开关关闭':'本轮未选择有获准素材的情绪表情'};
}
