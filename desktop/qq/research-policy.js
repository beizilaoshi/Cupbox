export function researchAllowed(event){
 if(event?.post_type!=='message'||!Array.isArray(event.message)||event.batchCount>1&&!event.researchEligible)return false;
 if(event.message_type==='private')return true;
 const parts=event.message;
 return parts.some(s=>s?.type==='reply'&&/^-?\d{1,24}$/.test(String(s.data?.id)))&&parts.some(s=>s?.type==='at'&&String(s.data?.qq)===String(event.self_id));
}
export function researchConfig(config,event,proactive=false){const allowed=!proactive&&researchAllowed(event);return{...config,searchEnabled:config.searchEnabled&&allowed,webFetchEnabled:config.webFetchEnabled&&allowed,visionEnabled:config.visionEnabled&&allowed,shortVideoEnabled:config.shortVideoEnabled&&allowed,shortVideoFrames:config.shortVideoFrames&&allowed,shortVideoAudio:config.shortVideoAudio&&allowed};}
export function researchStatus(config,event,proactive=false){const allowed=!proactive&&researchAllowed(event);return allowed?(event.message_type==='private'?'本轮是用户直接发来的私聊，允许按已开启能力读取本条图片和链接，无需引用或@。':'本轮已经满足“引用回复＋实际@机器人”的触发条件，不要再要求用户重复引用或@。')+'本轮开关状态：网页搜索'+(config.searchEnabled?'开启':'关闭')+'，图片识别'+(config.visionEnabled?'开启':'关闭')+'，短视频解析'+(config.shortVideoEnabled?'开启':'关闭')+'。当前状态和本轮工具结果优先于历史回复中的能力自述。没有图片识别结果只能说明未取得内容，不得把图片称为白板或声称图片本身为空。开关关闭、原引用读取失败和平台解析失败是不同原因，必须按实际状态说明，不得编造触发条件未满足。':'本轮未满足群聊“同一条消息引用回复＋实际@机器人”的条件，或属于主动消息，不能执行搜索、识图或短视频解析。';}
