const common={mode:'chat',naturalConversation:true,listenContext:true,agentChat:true,mergeMessages:true,segmentedStreaming:true,segmentMode:'bubbles',typingDelay:true,replyStyle:'casual'};
const entry=(name,description,patch)=>({name,description,patch:{...common,...patch}});
export const CHAT_RHYTHMS={
 quiet:entry('克制群友','接得简短，不开免重复 @ 窗口；连续消息等你说完再回。',{followUpWindow:0,maxToolTurns:6,maxToolMessages:3,toolMessageChars:600,cooldown:3,mergeDelay:1400}),
 familiar:entry('熟人闲聊','保留90秒接话窗口，口语化分段，自然聊下去。',{followUpWindow:90,maxToolTurns:10,maxToolMessages:6,toolMessageChars:900,cooldown:1,mergeDelay:1000}),
 lively:entry('活泼搭子','接话窗口更长，连续短消息更快合并，回应轻快。',{followUpWindow:180,maxToolTurns:12,maxToolMessages:8,toolMessageChars:1000,cooldown:0,mergeDelay:800}),
 single:entry('一问一答','只按原触发规则回答，不旁听、不主动插话，完整发一条。',{listenContext:false,agentChat:false,proactiveEnabled:false,followUpWindow:0,maxToolTurns:6,maxToolMessages:1,toolMessageChars:1200,cooldown:3,mergeDelay:1000,segmentedStreaming:false,replyStyle:'balanced'}),
 concise:entry('简短直达','尽量短句，控制分段和单轮消息量，适合随手问一句。',{followUpWindow:45,maxToolTurns:6,maxToolMessages:2,toolMessageChars:400,cooldown:2,mergeDelay:800,segmentChars:100,segmentDelay:700,maxSegments:2}),
 patient:entry('等你说完','等2.5秒再合并连续消息，适合分好几条慢慢讲。',{followUpWindow:150,maxToolTurns:8,maxToolMessages:4,toolMessageChars:900,cooldown:2,mergeDelay:2500,segmentChars:180,segmentDelay:1500,maxSegments:4}),
 quick:entry('轻快短句','短停顿、短分段，适合轻松来回；发送仍受全局限速。',{followUpWindow:120,maxToolTurns:8,maxToolMessages:5,toolMessageChars:600,cooldown:1,mergeDelay:500,segmentChars:90,segmentDelay:600,maxSegments:4}),
 gentle:entry('慢慢陪聊','较长接话窗口和柔和的发送间隔，留一点回应空间。',{followUpWindow:240,maxToolTurns:8,maxToolMessages:4,toolMessageChars:800,cooldown:2,mergeDelay:1800,segmentChars:160,segmentDelay:1800,maxSegments:3}),
 night:entry('夜间轻聊','减少消息量、延长停顿，关闭主动插话，适合安静时段。',{followUpWindow:30,maxToolTurns:6,maxToolMessages:2,toolMessageChars:600,cooldown:5,mergeDelay:2200,segmentChars:180,segmentDelay:2200,maxSegments:2,proactiveEnabled:false}),
 focused:entry('认真讨论','随问题展开，保留必要细节，减少碎片消息和追着接话。',{followUpWindow:60,maxToolTurns:10,maxToolMessages:3,toolMessageChars:1600,cooldown:2,mergeDelay:1400,replyStyle:'detailed',segmentMode:'natural',segmentChars:300,segmentDelay:1200,maxSegments:3}),
 longform:entry('完整长回复','保留步骤与例子，一次发送完整正文，适合说明和排查。',{followUpWindow:0,maxToolTurns:10,maxToolMessages:1,toolMessageChars:2000,cooldown:3,mergeDelay:1500,replyStyle:'detailed',segmentedStreaming:false}),
 balanced:entry('自然均衡','长短随问题变化，分段适中，兼顾闲聊与实际帮助。',{followUpWindow:90,maxToolTurns:8,maxToolMessages:4,toolMessageChars:1200,cooldown:2,mergeDelay:1200,replyStyle:'balanced',segmentMode:'natural',segmentChars:200,segmentDelay:1000,maxSegments:4}),
};
export function chatRhythmPatch(id,current={}){if(!Object.hasOwn(CHAT_RHYTHMS,id))throw Error('请选择有效的聊天节奏');const patch={...CHAT_RHYTHMS[id].patch};if(patch.listenContext&&!Number(current.contextCount))patch.contextCount=12;return patch;}

