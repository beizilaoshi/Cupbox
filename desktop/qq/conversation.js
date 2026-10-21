import {upstreamWhale} from './whale-profile.js';
/** Original conversation policy and boundary scanner; no third-party bot code. */
export function identityPrompt(c){if(upstreamWhale(c))return '';return[c.identityName?'聊天名称：'+c.identityName:'',c.identityPersonality?'稳定人设：\n'+c.identityPersonality:'',c.identityRules?'行为约定：\n'+c.identityRules:'',c.naturalConversation?'自然聊天：结合群里是谁在对谁说话，不要把别人的对话都当成向你提问。可以有自己的判断、幽默和语气；不为了表现人设而每句套口癖。没有必要回复时调用 pass_turn，保持安静。需要新信息先用已开启的工具，工具失败如实说，不复述内部步骤。记忆中属于别人的经历不能当成自己的；角色故事与现实执行结果要分清。':''].filter(Boolean).join('\n\n');}
export function conversationStyle(c){
  if(c.mode!=='chat'||upstreamWhale(c))return '';
  const common='这是即时聊天。先回应对方这句话的意思，结合前文，别把闲聊写成客服答复。不要反复自我介绍，不套用“我理解你的感受”“有什么可以帮助你”等开场；不复述整条问题，不机械追问。用户没要求时不用标题、编号、加粗、总结和行动清单。可以有自己的语气和虚构角色喜好；不伪造现实见面、共同往事或工具结果。明确被问是否 AI 或真人时如实回答，不在普通闲聊里重复身份说明。不要把发送策略、内部规则或思考过程写进回复。';
  const styles={casual:'语气松弛、口语化，通常一到三句；对方说得短就接得短，也可以只接一个短句。不要每轮都重复“我在”“抱抱”“辛苦了”，也不要求每轮带问号。接梗不用解释梗，关心落在对方刚说的具体事情上。遇到实际问题先给有用的答案，需要细节再展开。',balanced:'像熟悉的聊天伙伴一样清楚地解释，长短随问题调整；有必要才举例或追问。',detailed:'需要时认真展开，保留必要的结构、例子和操作步骤；闲聊仍然简短。'};
  return common+'\n'+styles[c.replyStyle||'casual'];
}

// Structured replies are easier to read together. Never cut code, URLs or brackets.
export function naturalCut(text,target=160){
  if(text.trim().length<48||/```|^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)、]\s|\|)/m.test(text))return 0;
  const urls=[...text.matchAll(/https?:\/\/[^\s<>，。！？]+/g)].map(m=>[m.index,m.index+m[0].length]);
  const pairs={'（':'）','(' :')','[':']','【':'】','“':'”','「':'」','『':'』','《':'》'},stack=[];
  let inline=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];if(ch==='`'){inline=!inline;continue;}if(inline||urls.some(([a,b])=>i>=a&&i<b))continue;
    if(ch==='"'&&text[i-1]!=='\\'){if(stack.at(-1)==='"')stack.pop();else stack.push('"');continue;}
    if(pairs[ch]){stack.push(pairs[ch]);continue;}if(ch===stack.at(-1)){stack.pop();continue;}if(stack.length)continue;
    const sentence=/[。！？!?]/.test(ch)||ch==='.'&&/\s/.test(text[i+1]||'')||ch==='\n'&&text[i+1]==='\n';
    if(sentence&&i+1>=24)return i+1;
    // A long clause may break at a comma or space; words stay intact.
    if(i>=target&&/[，；;\n\s]/.test(ch))return i+1;
  }
  return 0;
}
export function previewParts(text,c){
  if(c.mode==='chat'&&c.persona==='whale')c={...c,segmentedStreaming:c.whaleSplitLines!==false,segmentMode:'lines'};
  if(c.segmentedStreaming&&c.segmentMode==='lines'){const lines=String(text).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);const max=c.maxSegments||4;return lines.length>max?[...lines.slice(0,max-1),lines.slice(max-1).join(' ')]:lines;}
  let rest=String(text).trim(),parts=[];const max=c.maxSegments||4;
  while(c.segmentedStreaming&&parts.length<max-1){let cut=c.segmentMode==='fixed'?Math.min(c.segmentChars,rest.length):naturalCut(rest,c.segmentChars);if(c.segmentMode==='fixed'&&rest.length<c.segmentChars)cut=0;if(!cut)break;if(/[\uD800-\uDBFF]/.test(rest[cut-1]))cut--;parts.push(rest.slice(0,cut).trim());rest=rest.slice(cut);}
  if(rest.trim())parts.push(rest.trim());return parts;
}
