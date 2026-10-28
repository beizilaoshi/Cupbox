// Adapted from Derpyu520/qq-bridge src/md-to-plain.js (MIT).
// Copyright (c) 2026 Derpyu520 and qq-bridge / QSH contributors
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
// 把 agent 的 Markdown 回复转成适合 QQ 发送的纯文本。
export function mdToPlain(md) {
  let s = String(md ?? '');
  // 代码块：保留内容，去掉围栏（内容尾部换行去掉，围栏后的换行自然保留一个分隔）
  s = s.replace(/```[a-zA-Z0-9_+-]*\n?([\s\S]*?)```/g, (_, body) => body.replace(/\n+$/, ''));
  // 行内代码
  s = s.replace(/`([^`\n]+)`/g, '$1');
  // 图片/链接：保留文字，链接附在括号里（QQ 可点）。
  // 候选长度必须有界：`[^\]]*` 在大量 "!["（模型被诱导输出）时每次都要扫到串尾，
  // 整体是 O(n²)，会把 QQ 收发/定时器所在的事件循环卡住若干秒。排除换行 + 上限 500
  // 既不影响正常 Markdown，又把每次尝试的代价压成常数。
  s = s.replace(/!\[([^\]\n]{0,500})\]\(([^)\s]{1,2000})\)/g, (_, alt, url) => (alt || url));
  s = s.replace(/\[([^\]\n]{1,500})\]\(([^)\s]{1,2000})\)/g, '$1 ($2)');
  // 粗体/斜体/删除线标记
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  // 单个 * 的斜体有两个判定条件，缺一就会被当成普通符号吃掉：
  //   ① 不能跨行（`[^*]+` 会吞换行，把行首 `* ` 列表项和乘法式当成一对标记）；
  //   ② 开标记后、闭标记前都不能是空白（Markdown 的强调分隔符本来就不允许空格贴边），
  //      否则 "2 * 3 * 4" 这种乘法式会被整段删掉。
  s = s.replace(/\*(?!\s)([^*\n]*?[^\s*])\*/g, '$1');
  s = s.replace(/~~([^~]+)~~/g, '$1');
  s = s.replace(/__([^_]+)__/g, '$1');
  // 标题符
  s = s.replace(/^#{1,6}\s+/gm, '');
  // 引用符
  s = s.replace(/^>\s?/gm, '');
  // 列表符
  s = s.replace(/^\s*[-*+]\s+/gm, '• ');
  s = s.replace(/^\s*\d+\.\s+/gm, (m) => m.trim() + ' ');
  // 表格：按行保留文本
  s = s.split('\n').filter((line) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(line) || line.includes('|') === false || /\S/.test(line.replace(/[\s:|-]/g, ''))).join('\n');
  s = s.replace(/^\s*\|/gm, '').replace(/\|\s*$/gm, '');
  // 折叠的连续空行
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}
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
export function naturalCut(text,target=160,compact=false){
  if(text.trim().length<(compact?8:48)||/```|^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)、]\s|\|)/m.test(text))return 0;
  const urls=[...text.matchAll(/https?:\/\/[^\s<>，。！？]+/g)].map(m=>[m.index,m.index+m[0].length]);
  const pairs={'（':'）','(' :')','[':']','【':'】','“':'”','「':'」','『':'』','《':'》'},stack=[];
  let inline=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];if(ch==='`'){inline=!inline;continue;}if(inline||urls.some(([a,b])=>i>=a&&i<b))continue;
    if(ch==='"'&&text[i-1]!=='\\'){if(stack.at(-1)==='"')stack.pop();else stack.push('"');continue;}
    if(pairs[ch]){stack.push(pairs[ch]);continue;}if(ch===stack.at(-1)){stack.pop();continue;}if(stack.length)continue;
    const sentence=/[。！？!?]/.test(ch)||ch==='.'&&/\s/.test(text[i+1]||'')||ch==='\n'&&text[i+1]==='\n';
    if(sentence&&i+1>=(compact?4:24))return i+1;
    // A long clause may break at a comma or space; words stay intact.
    if(i>=target&&/[，；;\n\s]/.test(ch))return i+1;
  }
  return 0;
}
export function previewParts(text,c){
  if(upstreamWhale(c))c={...c,segmentedStreaming:c.whaleSplitLines!==false,segmentMode:'lines'};
  if(c.segmentedStreaming&&c.segmentMode==='lines'){const lines=String(text).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);const max=c.maxSegments||4;return lines.length>max?[...lines.slice(0,max-1),lines.slice(max-1).join(' ')]:lines;}
  let rest=String(text).trim(),parts=[];const max=c.maxSegments||4;
  while(c.segmentedStreaming&&parts.length<max-1){let cut=c.segmentMode==='fixed'?Math.min(c.segmentChars,rest.length):naturalCut(rest,c.segmentChars,c.segmentMode==='bubbles');if(c.segmentMode==='fixed'&&rest.length<c.segmentChars)cut=0;if(!cut)break;if(/[\uD800-\uDBFF]/.test(rest[cut-1]))cut--;parts.push(rest.slice(0,cut).trim());rest=rest.slice(cut);}
  if(rest.trim())parts.push(rest.trim());return parts;
}
