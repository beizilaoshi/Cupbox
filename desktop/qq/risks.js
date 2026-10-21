export function scopeLabel(c){return c.groupPolicy==='allow'?`仅白名单 ${c.allowedGroups.length} 个群`:(c.groupPolicy==='block'?`除黑名单 ${c.blockedGroups.length} 个群外的所有群`:'所有群');}
function scopeDetail(c){const list=c.groupPolicy==='allow'?c.allowedGroups:c.groupPolicy==='block'?c.blockedGroups:[];return scopeLabel(c)+(list.length?`（群号：${list.slice(0,12).join('、')}${list.length>12?'等；完整名单见回复规则':''}）`:'');}
export function risksFor(previous,next){
  if(!next.enabled)return[];
  const activating=!previous.enabled,risks=[];
  if(next.romanceMode!=='off'&&(activating||previous.romanceMode!==next.romanceMode))risks.push({code:'romance',title:next.romanceMode==='route'?'启用有本机存档的慢热攻略':'启用虚构角色恋爱互动',detail:next.romanceMode==='route'?'角色关系进度、相处节点与原话依据将保存在本机文档，按账号、会话、QQ 用户、角色与场景隔离，不随全局记忆共享。只有实际回复发送成功才存档，停止软件不删除，可在玩法设置重置。':'默认仅在私聊中使用。角色定位、称呼和相关对话会随请求交给所选模型；可以随时关闭或改回普通聊天。'});
  if(next.romanceMode!=='off'&&next.romanceInGroups&&(activating||!previous.romanceInGroups))risks.push({code:'romance-groups',title:'群成员会看到恋爱玩法回复',detail:'将在原有允许回复的群范围内启用，仍遵守 @、关键词与主动插话开关。攻略存档按群与 QQ 用户分开；请确认适合在这些群里公开互动。'});
  if(next.retainDialogue&&(activating||!previous.retainDialogue||previous.memoryScope!==next.memoryScope))risks.push({code:'persistent-memory',title:next.memoryScope==='global'?'自动记忆仅在允许的群之间共享':'自动记忆保存在本机文档',detail:next.memoryScope==='global'?'同一账号仅在允许的群之间共享相关聊天资料；私聊始终隔离，不带入其他会话。请勿保存秘密。文件为本机明文，停止、关闭不会删除。':'每个群与私聊独立保存近期对话和聊天片段，重启后恢复。文件为本机明文；关闭自动记忆只暂停使用，不删除文件。后续回复会把相关记忆发给所选模型。'});
  if(activating)risks.push({code:'reply',title:'向 QQ 联系人自动发送消息',detail:`范围：${scopeDetail(next)}；私聊${next.privateEnabled?'开启':'关闭'}。触发消息会发送给所选模型服务，可能产生费用。`});
  if(!activating&&['groupPolicy','allowedGroups','blockedGroups','privateEnabled'].some(k=>JSON.stringify(previous[k])!==JSON.stringify(next[k])))risks.push({code:'scope',title:'正在修改回复对象范围',detail:`保存后将处理：${scopeDetail(next)}；私聊${next.privateEnabled?'开启':'关闭'}。请核对名单，避免在不希望的群里回复。`});
  if(next.proactiveEnabled&&(activating||!previous.proactiveEnabled||JSON.stringify(previous.proactiveGroups)!==JSON.stringify(next.proactiveGroups)))risks.push({code:'proactive',title:'机器人将主动参与指定群聊',detail:`主动插话群：${next.proactiveGroups.join('、')}。只在允许回复的范围内生效，需同时开启旁听。未 @ 的聊天也会发送给所选模型进行判断，可能收费；模型可选择安静跳过。两次主动判断至少间隔 ${next.proactiveCooldown} 秒。请让群成员知情。`});
  if(!activating&&['modelId','visionModelId'].some(k=>previous[k]!==next[k]))risks.push({code:'model',title:'正在更换接收聊天内容的模型',detail:'之后的消息、已启用的全局记忆或图片将提交给新选择的模型服务，请核对服务是否可信。'});
  if(!activating&&next.allowWorkTools&&JSON.stringify(previous.ownerIds)!==JSON.stringify(next.ownerIds))risks.push({code:'owners',title:'正在修改本地工具请求者',detail:'新的主人 QQ 号可以在工作模式申请读取或修改本地文件；每次执行仍需你批准。'});
  for(const [key,title,detail]of [
    ['memoryTools','允许模型整理偏好档案','模型可将当前发言者明确说过的普通偏好和约定追加到本机记忆，保留 QQ 身份与原话依据；不会覆盖聊天原文。整理结果可能有误，可在自动记忆查看并删除；后续会按已选范围共享给模型。'],
    ['emojiEnabled','按配置自动发送表情图片','命中触发词模式会自动选择已允许、含义完整且命中当前消息的表情，不依赖模型输出 ID；仅模型判断模式还需模型选择。每次最多一张，受冷却限制。'],
    ['freeWorkflow','免费模型兼容工作流（实验性）','任务、相关历史和批准读取的文件将发给第三方免费通道。模型可能不遵守格式、被限流或中断；一次最多4轮工具请求，不自动重试或切换付费模型。本地工具仍限主人、工作模式与逐次批准。'],
    ['listenContext','旁听群聊上下文','未触发的聊天也会进入临时上下文，并在后续回复时提交给模型。请确认聊天参与者知情；不同群不会混用。'],
    ['globalMemory','共享明确公开给 QQ 的资料','只使用本机单独填写的 QQ 公开资料，不再自动读取应用私有全局记忆。公开资料会发给模型并可能出现在群聊，请勿填写敏感信息。'],
    ['visionEnabled','向视觉服务提交图片','触发消息中的图片会下载并发给所选视觉模型。请确认图片适合上传。'],
    ['searchEnabled','允许检索公开网页','模型生成的搜索词会发给公开搜索服务；不要要求搜索密码、私密聊天或全局记忆原文。'],
    ['allowWorkTools','允许主人申请本地文件操作','读取内容也可能进入模型与 QQ 回复。仅主人、工作模式及逐次本地批准都满足时才执行。'],
    ['segmentedStreaming','分段发送后无法收回已发内容','生成过程中可能提前发送部分答案；停止只能取消后续段落。流式中断不会自动重发，工具流程在完成后分段。'],
  ])if(next[key]&&(activating||!previous[key]))risks.push({code:key,title,detail});
  return risks;
}
