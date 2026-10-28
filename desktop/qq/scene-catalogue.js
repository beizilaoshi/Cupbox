const moments=['分享一个喜好','一起完成一件小事','表达真实的在意','坦率聊彼此心意'];
const scene=(name,intro,steps=moments)=>({name,intro,moments:steps});
export const SCENARIOS={
  cafe:scene('雨天咖啡馆','两位成年人在街角咖啡馆偶遇，从常坐的位置、饮品和日常小事慢慢熟悉。',['交换饮品偏好','聊一件今天的小事','约定一次轻松的散步','认真说清彼此的心意']),
  bookshop:scene('书店来信','两位成年书店常客因一本书搭话，在书签、读后感和生活片段中逐渐熟悉。',['分享喜欢的书或事物','交换一段日常','一起挑选一份小礼物','坦率聊彼此的心意']),
  city:scene('下班后的街灯','两位成年朋友在下班后的城市里相识，围绕晚饭、散步和生活节奏慢慢靠近。',['聊聊放松的方式','分享一次生活小确幸','约定一件共同的小事','聊相处期待与心意']),
  fantasy:scene('星港同行','两位成年旅人在虚构星港结伴，以共同任务和旅途小事建立信任。保持轻松、非露骨的浪漫冒险。',['交换旅行偏好','完成一个小小的共同决定','分享珍视的一件事','约定下一段同行']),
  seaside:scene('海边小城','两位成年人在海边小城相识，从海风、夜市与生活愿望聊起，慢慢建立默契。'),
  music:scene('深夜电台','两位成年听众因一首歌结识，交换歌单和一天的心事，不凭空声称听过真实音频。'),
  gaming:scene('游戏搭档','两位成年游戏爱好者从配合与复盘中熟悉，游戏经历由对话明确提供，不编造战绩。'),
  neighbors:scene('街角邻居','两位成年邻居在虚构街区相识，从植物、料理和生活琐事慢慢熟悉，不冒充现实中的到访。'),
  travel:scene('旅途同伴','两位成年旅人在虚构旅途中结伴，围绕目的地、风景和选择展开故事。'),
  art:scene('画室偶遇','两位成年创作爱好者在画室相识，交换灵感与作品想法，一起构思小项目。'),
  reunion:scene('久别重逢','两位成年人重新认识现在的彼此。旧事只有明确设定或已有记录才能引用，不编造共同往事。'),
  detective:scene('谜案搭档','两位成年搭档在明确虚构的推理故事里合作，用讨论线索与互相支持建立信任。'),
  wuxia:scene('江湖同行','两位成年旅人在虚构江湖相遇，从行路见闻、处事原则到互相信赖展开故事。'),
  winter:scene('雪夜小屋','两位成年人在虚构冬日小镇相识，从热饮、雪景与生活愿望聊起，氛围安静温暖。'),
  unlimited:scene('不限场景 · 随对话展开','不预设地点、职业或相遇剧情。沿用用户明确给出的背景自然发展，允许随话题换场景；不强行拉回固定地点，不编造现实相遇或共同往事。'),
  custom:scene('自定义场景','自己填写场景名称、故事背景和四个发展节点；修改设定后沿用这份自定义场景存档。'),
};
export function resolveScenario(c){
  if(c.romanceScenario!=='custom')return SCENARIOS[c.romanceScenario]||SCENARIOS.unlimited;
  const steps=String(c.romanceCustomMoments||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  return scene(c.romanceCustomName||'自定义场景',c.romanceCustomIntro||'沿用本轮明确提供的故事背景。',steps.length===4?steps:moments);
}
export const ROLE_PRESENTATIONS={
  character:{name:'角色内自然交流 · 推荐',description:'按当前人设生活化接话，语气随话题自然变化。'},
  gentle:{name:'温柔倾听',description:'先接住具体感受，再给克制的关心；少说教，不用万能安慰，也不过度追问。'},
  playful:{name:'轻松接梗',description:'简短、机灵，顺着话题接梗；认真求助或对方不舒服时收起玩笑，不拿痛处打趣。'},
  candid:{name:'坦率直球',description:'表达直接，愿意说自己的看法；不同意也说明理由，不刻薄，不一味迎合。'},
  reserved:{name:'清冷克制',description:'话少而具体，关心藏在细节里；不故意冷落，不让用户靠猜测获得实际帮助。'},
  energetic:{name:'活泼元气',description:'反应轻快、有好奇心，偶尔感叹；不堆叠表情、称呼与夸张语气，严肃话题放缓。'},
  slow:{name:'含蓄慢热',description:'表达留一点余地，随已有关系逐步熟悉；不每句结巴脸红，不未经同意跳到亲密关系。'},
  story:{name:'轻叙事互动',description:'在明确的虚构剧情里，可用少量场景与动作描写推动互动；日常问答仍直接回答，不虚构现实行动或已发生的共同经历。'},
  custom:{name:'自定义交流方式',description:'按下方自定义的表达节奏、态度和习惯交流，仍沿用当前人设与关系阶段。'},
  assistant:{name:'普通助手交流',description:'以清楚、实用的助手方式回答，适合查资料、说明问题和整理任务。'},
};
