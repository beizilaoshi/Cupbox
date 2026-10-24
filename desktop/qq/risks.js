export function scopeLabel(c){return c.groupPolicy==='allow'?`仅白名单 ${c.allowedGroups.length} 个群`:(c.groupPolicy==='block'?`除黑名单 ${c.blockedGroups.length} 个群外的所有群`:'所有群');}
function scopeDetail(c){const list=c.groupPolicy==='allow'?c.allowedGroups:c.groupPolicy==='block'?c.blockedGroups:[];return scopeLabel(c)+(list.length?`（群号：${list.slice(0,12).join('、')}${list.length>12?'等；完整名单见回复规则':''}）`:'');}
export function risksFor(previous,next){
  if(!next.enabled)return[];
  const activating=!previous.enabled,risks=[];
  if(next.emojiEnabled&&['innovative','experimental'].includes(next.emojiMode)&&(activating||!previous.emojiEnabled||['emojiMode','emojiJudgeModelId','emojiVisionModelId','emojiRecentCount','emojiExperimentalRecentCount','emojiExperimentalGrid','emojiExperimentalWait'].some(k=>previous[k]!==next[k])))risks.push({code:'emoji-innovation',title:next.emojiMode==='experimental'?'实验性创新会生成拼图并可能反序复测':'创新表情会额外调用判断和视觉模型',detail:next.emojiMode==='experimental'?`近期最多 ${next.emojiExperimentalRecentCount} 条已有会话记录会交给独立简报模型；简报失败最多做一次简化兜底。最多 ${next.emojiExperimentalGrid} 张本机表情会拼为一张编号图上传视觉模型，被 @、私聊或首次发图时可能再传反序图复测；单次看图超时2秒即不发。可能增加费用和延迟，失败不回退其他模式。关闭等待选图时，文字可先发，图片稍后选好再补；仍可停止后续发送。`:`最多 ${next.emojiRecentCount} 条当前会话已有聊天与本条消息会提交给判断模型，最多3张已启用的本机表情和相同聊天片段会提交给所选视觉模型，可能增加费用与延迟。选择不确定、格式错误或模型不可用时不发图；不自动改用其他模型。发图确认结果随现有会话记忆开关保存。图库中触发词限制、冷却和授权范围继续有效。`});
  if(next.emojiMode==='experimental'&&next.emojiExperimentalTrace&&(activating||!previous.emojiExperimentalTrace||previous.emojiMode!=='experimental'))risks.push({code:'emoji-experimental-trace',title:'详细实验记录保存在本机明文文件',detail:'会保存简报目标文字、候选ID和相似度、编号拼图、随机种子、选图结果、会话编号、耗时及已知费用信息，最多保留20轮。拼图及目标文字可能包含私人内容，请确认本机文档目录适合保存；默认普通日志不保存这些内容。上游未返回用量时费用显示未知，不计作零。'});
  if(next.followUpWindow>0&&(activating||next.followUpWindow>previous.followUpWindow))risks.push({code:'follow-up',title:'允许不重复 @ 的连续接话',detail:`刚回复过的同一人在 ${next.followUpWindow} 秒内继续说话也会触发模型；需要自然聊天、旁听和非零上下文。其他人明确 @ 或引用第三方时不触发此规则。`});
  if(!activating&&['maxToolTurns','maxToolMessages','toolMessageChars'].some(k=>next[k]>previous[k]))risks.push({code:'chat-budget',title:'提高自主聊天额度',detail:`最多 ${next.maxToolTurns} 轮工具、${next.maxToolMessages} 条自主消息、每条 ${next.toolMessageChars} 字。可能增加费用与消息数量，仍受每分钟总限速和内容检测；免费通道最多4轮。`});
  if(next.romanceMode!=='off'&&(activating||previous.romanceMode!==next.romanceMode))risks.push({code:'romance',title:next.romanceMode==='route'?'启用有本机存档的慢热攻略':'启用虚构角色恋爱互动',detail:next.romanceMode==='route'?'角色关系进度、相处节点与原话依据将保存在本机文档，按账号、会话、QQ 用户、角色与场景隔离，不随全局记忆共享。只有实际回复发送成功才存档，停止软件不删除，可在玩法设置重置。':'默认仅在私聊中使用。角色定位、称呼和相关对话会随请求交给所选模型；可以随时关闭或改回普通聊天。'});
  if(next.romanceMode!=='off'&&next.romanceInGroups&&(activating||!previous.romanceInGroups))risks.push({code:'romance-groups',title:'群成员会看到恋爱玩法回复',detail:'将在原有允许回复的群范围内启用，仍遵守 @、关键词与主动插话开关。攻略存档按群与 QQ 用户分开；请确认适合在这些群里公开互动。'});
  if(next.retainDialogue&&(activating||!previous.retainDialogue||previous.memoryScope!==next.memoryScope))risks.push({code:'persistent-memory',title:next.memoryScope==='global'?'自动记忆仅在允许的群之间共享':'自动记忆保存在本机文档',detail:next.memoryScope==='global'?'同一账号仅在允许的群之间共享相关聊天资料；私聊始终隔离，不带入其他会话。请勿保存秘密。文件为本机明文，停止、关闭不会删除。':'每个群与私聊独立保存近期对话和聊天片段，重启后恢复。文件为本机明文；关闭自动记忆只暂停使用，不删除文件。后续回复会把相关记忆发给所选模型。'});
  if(activating)risks.push({code:'reply',title:'向 QQ 联系人自动发送消息',detail:`范围：${scopeDetail(next)}；私聊${next.privateEnabled?'开启':'关闭'}。触发消息会发送给所选模型服务，可能产生费用。`});
  if(!activating&&['groupPolicy','allowedGroups','blockedGroups','privateEnabled','privatePolicy','allowedUsers','blockedUsers'].some(k=>JSON.stringify(previous[k])!==JSON.stringify(next[k])))risks.push({code:'scope',title:'正在修改回复对象范围',detail:`保存后将处理：${scopeDetail(next)}；私聊${next.privateEnabled?'开启':'关闭'}，范围 ${next.privatePolicy}。私聊黑名单始终优先。请核对名单，避免向不希望的对象回复。`});
  if(next.proactiveEnabled&&(activating||!previous.proactiveEnabled||JSON.stringify(previous.proactiveGroups)!==JSON.stringify(next.proactiveGroups)))risks.push({code:'proactive',title:'机器人将主动参与指定群聊',detail:`主动插话群：${next.proactiveGroups.join('、')}。只在允许回复的范围内生效，需同时开启旁听。未 @ 的聊天也会发送给所选模型进行判断，可能收费；模型可选择安静跳过。两次主动判断至少间隔 ${next.proactiveCooldown} 秒。请让群成员知情。`});
  if(!activating&&['modelId','visionModelId'].some(k=>previous[k]!==next[k]))risks.push({code:'model',title:'正在更换接收聊天内容的模型',detail:'之后的消息、已启用的全局记忆或图片将提交给新选择的模型服务，请核对服务是否可信。'});
  if(!activating&&next.allowWorkTools&&JSON.stringify(previous.ownerIds)!==JSON.stringify(next.ownerIds))risks.push({code:'owners',title:'正在修改本地工具请求者',detail:'新的主人 QQ 号可以在工作模式申请读取或修改本地文件；每次执行仍需你批准。'});
  for(const [key,title,detail]of [
    ['companionEnabled','启用持续的相处成长','好感、信任、熟悉度、情绪、相处节点和已启用的日记/未完成事件会保存在本机文档，并在本人后续聊天中提交给所选模型。按账号、会话、QQ用户、角色和场景隔离，不随全局记忆共享；实际回复成功才存档。分数是虚构关系状态，不是对人的评分；离线不扣分。'],
    ['memoryDecay','启用记忆自然淡化排序','只调整已允许记忆的召回顺序，不删除原文；本机置顶偏好不受衰减影响。久远的琐事可能较少进入模型，请在记忆页置顶需要长期保留的偏好。'],
    ['faceEnabled','允许发送 QQ 原生表情','模型可在当前授权会话发送原生表情，计入本轮自主消息额度与总发送限速，不需要导入表情图片。'],
    ['reminderEnabled','允许建立并发送聊天提醒','提醒保存在本机，内容明文记录且会在到时发送给原会话请求者。停止软件不清空提醒；发送需要软件与QQ在线、自动回复开启。逾期超过10分钟不补发，失败或状态不明不自动重发，不适合紧急事项。'],
    ['agentChat','启用 QQ 自主聊天工具','模型可在当前允许的会话里查看消息、引用回复、分条发送和短暂等候；仅已授权主动插话的群可安排稍后唤醒。不能指定别的群或 QQ 号，不能改变白黑名单、本机权限或记忆范围。每条仍经过输出检测和发送限速。'],
    ['pokeEnabled','允许戳一戳互动','机器人可响应戳一戳，并在当前授权会话内使用戳一戳工具；仅向本轮发言者发送，受独立冷却限制。'],
    ['voiceEnabled','允许发送用户导入的语音','仅能选择你导入、启用且填写说明的语音素材；不开放任意文件路径。语音内容无法由文字输出检测插件检查，请先试听并确认适合发送。'],
    ['slangEnabled','启用会话词库','模型可提出当前会话出现的用语候选，需你在本机确认后才会用于回复。按账号和会话隔离，不自动联网研究，不允许模型修改已确认解释。'],
    ['webFetchEnabled','允许获取指定公开网页','还需开启联网搜索。模型决定访问的 URL 可能包含聊天线索，并发送给目标网站；只允许公开 HTTP/HTTPS 地址，拒绝环回、私网、凭据和超限正文。'],
    ['memoryTools','允许模型整理偏好档案','模型可将当前发言者明确说过的普通偏好和约定追加到本机记忆，保留 QQ 身份与原话依据；不会覆盖聊天原文。整理结果可能有误，可在自动记忆查看并删除；后续会按已选范围共享给模型。'],
    ['emojiEnabled','按配置自动发送表情图片','命中触发词模式会自动选择已允许、含义完整且命中当前消息的表情，不依赖模型输出 ID；仅模型判断模式还需模型选择。每次最多一张，受冷却限制。'],
    ['freeWorkflow','免费模型兼容工作流（实验性）','任务、相关历史和批准读取的文件将发给第三方免费通道。模型可能不遵守格式、被限流或中断；一次最多4轮工具请求，不自动重试或切换付费模型。本地工具仍限主人、工作模式与逐次批准。'],
    ['listenContext','旁听群聊上下文','未触发的聊天也会进入临时上下文，并在后续回复时提交给模型。请确认聊天参与者知情；不同群不会混用。'],
    ['globalMemory','共享明确公开给 QQ 的资料','只使用本机单独填写的 QQ 公开资料，不再自动读取应用私有全局记忆。公开资料会发给模型并可能出现在群聊，请勿填写敏感信息。'],
    ['visionEnabled','向视觉服务提交图片','触发消息中的图片会下载并发给所选视觉模型。请确认图片适合上传。'],
    ['searchEnabled','允许检索公开网页','模型生成的搜索词会发给公开搜索服务；不要要求搜索密码、私密聊天或全局记忆原文。'],
    ['allowWorkTools','允许主人申请本地文件操作','包括 Word/PPT 模板与修改、Excel 清洗统计、PDF 整理和格式交换。批准读取的正文也可能进入模型与 QQ 回复；文档内图片不会自动识别，不会自动上传或发送原始文件。仅主人、工作模式及逐次本地批准都满足时才执行。'],
    ['segmentedStreaming','分段发送后无法收回已发内容','生成过程中可能提前发送部分答案；停止只能取消后续段落。流式中断不会自动重发，工具流程在完成后分段。'],
  ])if(next[key]&&(activating||!previous[key]))risks.push({code:key,title,detail});
  return risks;
}
