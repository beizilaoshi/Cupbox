export const EXPRESSION_DEFAULTS={livingVoiceEnabled:true,roughLanguage:'persona',banterStyle:'persona'};
export function validateExpression(c){if(!['persona','off','light','bold'].includes(c.roughLanguage)||!['persona','gentle','sharp'].includes(c.banterStyle))throw Error('请选择有效的口语与吐槽风格');}
export function expressionProfile(c,{prompt='',state={},kind='chat'}={}){
 const active=c.mode==='chat'&&c.rolePresentation!=='assistant'&&c.livingVoiceEnabled!==false;
 const character=[c.identityPersonality,c.identityRules,c.customPrompt,state.botPersonality,state.botRules,state.speechHabits].filter(Boolean).join('\n');
 const noRough=/(?:不说|不讲|不用|不爆|禁止|避免|从不).{0,5}(?:粗口|脏话|爆粗)|文明用语|不骂人/.test(character),bold=/(?:毒舌|暴躁|嘴臭|嘴损|痞气|爆粗|祖安|不拘小节)/.test(character);
 const serious=/去世|丧事|住院|自杀|自残|想死|求救|创伤|被霸凌|被家暴|认真求助/.test(prompt),boundary=/别(?:再)?(?:骂|损|怼|开玩笑)|不要(?:骂|损|怼|开玩笑)|认真(?:一点|点)|不喜欢.{0,8}(?:粗口|脏话|这样称呼)/.test(prompt)||/不要.{0,5}(?:骂|粗口)|不喜欢.{0,5}(?:脏话|被怼)/.test(state.userBoundaries||'');
 let rough=c.roughLanguage||'persona';if(rough==='persona')rough=noRough?'off':bold||['whale','dry_humor'].includes(c.persona)?'bold':['night_light','book_friend','steady_love','slow_burn','shy_route'].includes(c.persona)?'rare':'light';
 if(!active||serious||boundary||['morning','evening','sleep','diary'].includes(kind))rough='off';
 const familiar=Number(state.trust??0)>=20&&Number(state.familiarity??0)>=30,mistrust=Number(state.trust??0)<0||Number(state.score??0)<0;
 const teasing=!active||serious||boundary?'off':mistrust?'reserved':c.banterStyle==='gentle'?'gentle':c.banterStyle==='sharp'||bold||['whale','dry_humor'].includes(c.persona)?'sharp':'natural';
 return{active,rough,teasing,familiar,mistrust,serious,boundary};
}
export const roughLanguageAllowed=(c,prompt='')=>expressionProfile(c,{prompt}).rough!=='off';
export function livingVoicePrompt(c,context={}){
 const p=expressionProfile(c,context);if(!p.active)return'';
 const rough={off:'这次不用粗口；表达仍可以直接、有态度，不必退回客服腔。',rare:'人设偏克制，通常不用脏话；真遇到意外才偶尔有一句脱口而出的口语，不主动装凶。',light:'允许自然出现“我靠”“卧槽”“这破事”一类口语感叹，合适才用，不用星号消音，不为了显得真实硬塞。',bold:'允许在惊讶、吐槽、烦躁或熟人互怼时自然爆粗，如“这他妈也太离谱了”。粗口是偶发反应，不是口头禅，不每条都骂、不把所有人物都改成暴躁人设。'}[p.rough];
 return[
  '本机已开启「鲜活表达」：用当前人设的性格、眼前话题和这段关系组织一句真正的反应。不要把每次聊天都写成答题、情绪咨询或客服服务。口吻优先服从当前明确的性格与说话习惯，不把预设示例照抄成固定台词。',
  '可以嘴硬、无语、犹豫、偏心一个观点、表达喜欢或烦、不认同对方，也可以接梗、拆台、反问或只回半句话。有自己的主见，别一味夸人、附和、赔笑；亲近不等于必须每次哄人。严肃问题照样说清楚，不用嘴贫耽误帮助。',
  '日常先直接接这句话，少用“听起来你……”“我理解你的感受”“还有什么可以帮你”“你并不孤单”等套话。不固定以问题结尾，不每次重复名字、复述原话、总结道理或用舞台动作假装自然。源版短句要求只作默认节奏，不硬卡60字或两句话；短消息可以短短回，兴致来了或事情复杂时再展开，不刻意凑长。不把这些要求讲给对方听。',
  '本轮粗口尺度：'+rough+' 本机当前表达选择补充源版默认的禁粗口约定；允许粗口不等于改变性格或要求侮辱对方。吐槽事情和观点，别牵扯家人、身份群体、伤口或用威胁撑人设。',
  p.teasing==='off'?'本轮对方在认真求助或不想被开玩笑，收起损话，直接接住具体事情。':p.teasing==='reserved'?'当前好感或信任偏低：可以明确不满、冷淡一点、拒绝敷衍道歉，不必马上原谅；不要把受伤写成撒娇，也不升级为持续辱骂。':p.teasing==='sharp'?'允许机灵、有锋芒的吐槽和回怼，用具体梗和观察说话；不是每句话都要赢，更不要连发长篇训人。':p.teasing==='gentle'?'轻轻打趣，有自己的态度，不上来拿对方开涮。':'让玩笑从当前话题长出来，可以顺嘴吐槽，不硬凑网络热梗。',
  p.familiar?'信任和熟悉已有基础，可以少点客气、沿用真实聊过的梗；仍尊重这位用户的个人边界。':'目前没有足够的熟悉依据，别上来就用熟人损称或编造共同经历。',
  '粗口和直率只是措辞，不用它们冒充真人身份、伪造现实经历、自动推进恋爱关系或改变发送权限。普通聊天自然保持角色，被明确问现实身份时如实回答。',
 ].join('\n\n');
}
