// A small local idiom bank; users may extend it with their own four-character entries.
export const BUILTIN_IDIOMS=[...new Set(('一心一意 意气风发 发扬光大 大功告成 成千上万 万事如意 意味深长 长生不老 老当益壮 壮志凌云 云淡风轻 轻而易举 举一反三 三心二意 意想不到 到此为止 止步不前 前程似锦 锦上添花 花好月圆 圆满成功 功成名就 就事论事 事半功倍 倍道而进 进退两难 难能可贵 忘乎所以 以身作则 以理服人 人山人海 海阔天空 空前绝后 后来居上 上下一心 心想事成 成竹在胸 胸有成竹 竹报平安 安居乐业 业精于勤 勤学苦练 练达老成 成家立业 业业兢兢 兢兢业业 一马当先 先见之明 明明白白 白手起家 家喻户晓 晓风残月 月白风清 清风明月 月明星稀 稀世之宝 宝刀未老 老生常谈 谈笑风生 生龙活虎 虎头蛇尾 尾大不掉 掉以轻心 心平气和 和气生财 财大气粗 粗中有细 细水长流 流连忘返 返老还童 童叟无欺 欺人太甚 甚嚣尘上 上善若水 水到渠成 成人之美 美中不足 足智多谋 谋事在人 人定胜天 天长地久 久别重逢 逢凶化吉 吉祥如意 意气相投 投桃报李 李代桃僵 僵李代桃 桃红柳绿 绿水青山 山清水秀 秀外慧中 中流砥柱 柱天踏地 地久天长 长治久安 安步当车 车水马龙 龙飞凤舞 舞文弄墨 墨守成规 规行矩步 步步高升 升官发财 财运亨通 通情达理 理直气壮 壮志未酬 力不从心 心口如一 一帆风顺 顺水推舟 舟车劳顿 顿开茅塞 塞翁失马 马到成功 功德无量 量力而行 行云流水 水落石出 出生入死 死里逃生 生生不息 息事宁人 人才济济 济济一堂 堂堂正正 正大光明 明察秋毫 毫不犹豫').split(' '))];
export const MORE_FEATURES={猜数字:'playGuess',猜:'playGuess',猜数字状态:'playGuess',结束猜数字:'playGuess',成语接龙:'playIdiom',接龙:'playIdiom',接龙提示:'playIdiom',接龙状态:'playIdiom',结束接龙:'playIdiom',添加倒计时:'playCountdown',倒计时:'playCountdown',删除倒计时:'playCountdown',发起报名:'playSignup',报名:'playSignup',退出报名:'playSignup',报名名单:'playSignup',结束报名:'playSignup'};
const first=s=>Array.from(s)[0],last=s=>Array.from(s).at(-1);
const canManage=(record,{event,c,user})=>record.creator===user||c.ownerIds.includes(user)||event.message_type==='group'&&['admin','owner'].includes(event.sender?.role);
const closeAt=(record,now)=>{if(record&&now>=record.endsAt)record.closed=true;return record;};
const dateLabel=now=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
const duration=ms=>{const minutes=Math.floor(Math.abs(ms)/60000);return`${Math.floor(minutes/1440)}天${Math.floor(minutes%1440/60)}小时${minutes%60}分`;};
const signupText=record=>`${record.closed?'报名已结束':'正在报名'}：${record.title}\n人数 ${record.members.length}/${record.limit}\n${record.members.slice(0,20).map((m,i)=>`${i+1}. ${m.name}`).join('\n')||'暂无报名'}${record.members.length>20?'\n其余 '+(record.members.length-20)+' 人已报名':''}\n截止 ${dateLabel(record.endsAt)}（北京时间）`;
export function initMoreState(state){
 for(const key of ['guessGames','idiomGames','countdowns','signups']){if(state[key]===undefined)state[key]=[];if(!Array.isArray(state[key]))throw Error('扩展玩法数据格式异常');}
}
export function trimMoreState(state){for(const key of ['guessGames','idiomGames','countdowns','signups'])state[key]=state[key].slice(-200);}
export function moreHelp(c){const p=c.playPrefix;return[
 c.playGuess&&`${p}猜数字 100 / ${p}猜 50 / ${p}猜数字状态 / ${p}结束猜数字`,
 c.playIdiom&&`${p}成语接龙 一心一意 / ${p}接龙 意气风发 / ${p}接龙提示 / ${p}接龙状态 / ${p}结束接龙`,
 c.playCountdown&&`${p}添加倒计时 周末 | 2026-12-05 18:00\n${p}倒计时 / ${p}倒计时 周末 / ${p}删除倒计时 周末`,
 c.playSignup&&`${p}发起报名 周末开黑 | 5\n${p}报名 / ${p}退出报名 / ${p}报名名单 / ${p}结束报名`
].filter(Boolean);}
export function executeMore({command,args},state,ctx,{roll,textOK}){
 const {event,c,room,user,now}=ctx,p=c.playPrefix;
 const name=String(event.sender?.card||event.sender?.nickname||'用户'+user.slice(-4)).slice(0,40),safeName=textOK(name)?name:'用户'+user.slice(-4);
 if(MORE_FEATURES[command]==='playGuess'){
  let game=closeAt(state.guessGames.find(g=>g.room===room),now);
  if(command==='猜数字'){
   if(game&&!game.closed)return`本会话已有一局猜数字：1～${game.max}，还剩 ${game.limit-game.attempts} 次机会。`;
   if(args&&!/^\d{2,4}$/.test(args)||args&&(Number(args)<10||Number(args)>1000))return`用法：${p}猜数字 100（上限10～1000，不填默认100）`;
   const max=Number(args)||100;game={room,creator:user,max,answer:roll(1,max+1),attempts:0,limit:c.playGuessAttempts,endsAt:now+c.playRoundMinutes*60000,closed:false};state.guessGames=state.guessGames.filter(g=>g.room!==room);state.guessGames.push(game);
   return`想好啦，猜一个 1～${max} 的整数！\n大家共用 ${game.limit} 次机会，${c.playRoundMinutes} 分钟内有效。发送“${p}猜 50”参与。`;
  }
  if(!game)return`还没开始，发送“${p}猜数字”开一局。`;
  if(game.closed)return`这局已结束，答案是 ${game.answer}。发送“${p}猜数字”再来一局。`;
  if(command==='结束猜数字'){
   if(!canManage(game,ctx))return'只有发起人、群管理员或机器人主人可以提前结束。';game.closed=true;return`这局结束啦，答案是 ${game.answer}。`;
  }
  if(command==='猜数字状态')return`猜数字进行中：1～${game.max}，已猜 ${game.attempts} 次，还剩 ${game.limit-game.attempts} 次。`;
  if(!/^\d{1,4}$/.test(args)||Number(args)<1||Number(args)>game.max)return`请输入 1～${game.max} 的整数，例如“${p}猜 50”。`;
  const value=Number(args);game.attempts++;
  if(value===game.answer){game.closed=true;return`${safeName} 猜中了！答案是 ${value}，这局一共猜了 ${game.attempts} 次。`;}
  if(game.attempts>=game.limit){game.closed=true;return`机会用完啦，答案是 ${game.answer}。再开一局试试吧！`;}
  return`${value} ${value<game.answer?'小了，往大猜':'大了，往小猜'}！还剩 ${game.limit-game.attempts} 次。`;
 }
 if(MORE_FEATURES[command]==='playIdiom'){
  const bank=[...new Set([...BUILTIN_IDIOMS,...c.playIdioms.split(/[\s,，、]+/u).filter(Boolean)])],known=new Set(bank);
  let game=closeAt(state.idiomGames.find(g=>g.room===room),now);
  const nextWords=()=>bank.filter(w=>first(w)===last(game.last)&&!game.used.includes(w));
  if(command==='成语接龙'){
   if(game&&!game.closed)return`接龙进行中：${game.last}。请用“${last(game.last)}”字开头，不可重复。`;
   if(args&&!known.has(args))return'这个词还不在本机成语库里，可在互动玩法设置中补充四字成语。';
   const starters=bank.filter(w=>bank.some(next=>next!==w&&first(next)===last(w))),word=args||starters[roll(0,starters.length)];
   game={room,creator:user,last:word,used:[word],endsAt:now+c.playRoundMinutes*60000,closed:false};state.idiomGames=state.idiomGames.filter(g=>g.room!==room);state.idiomGames.push(game);
   return`成语接龙开始：${word}\n发送“${p}接龙 ${last(word)}…”接下去。按汉字首尾相接，不支持同音字；只使用本机词库，${c.playRoundMinutes} 分钟有效。`;
  }
  if(!game)return`发送“${p}成语接龙”开始吧。`;
  if(game.closed)return`这局接龙已结束，共接了 ${game.used.length} 个词，最后是“${game.last}”。`;
  if(command==='结束接龙'){if(!canManage(game,ctx))return'只有发起人、群管理员或机器人主人可以提前结束。';game.closed=true;return`接龙结束，共接了 ${game.used.length} 个词。`;}
  if(command==='接龙状态')return`当前：${game.last}，下一个以“${last(game.last)}”开头。已用 ${game.used.length} 个词，不能重复。`;
  if(command==='接龙提示'){const words=nextWords().slice(0,5);if(!words.length){game.closed=true;return'本机词库暂时没有未用过的后续词，这局结束啦。可以在设置里扩充词库。';}return'可以试试：'+words.join('、');}
  if(!known.has(args))return'本机词库中没有这个四字成语，可在设置里补充后再接。';
  if(game.used.includes(args))return'这个成语已经用过，换一个吧。';
  if(first(args)!==last(game.last))return`要以“${last(game.last)}”字开头，上一词是 ${game.last}。`;
  game.used.push(args);game.last=args;
  if(!nextWords().length||game.used.length>=1000){game.closed=true;return`接上了：${args}！共 ${game.used.length} 个词。本机词库没有后续或本局已达上限，这局结束。`;}
  return`接上了：${args}！下一个以“${last(args)}”开头，已接 ${game.used.length} 个词。`;
 }
 if(MORE_FEATURES[command]==='playCountdown'){
  const rows=state.countdowns.filter(r=>r.room===room),title=args.trim(),display=row=>`${row.title} · ${now<row.at?'还剩':'已过去'} ${duration(row.at-now)}\n${dateLabel(row.at)}（北京时间）`;
  if(command==='添加倒计时'){
   const match=/^([^|｜]+)[|｜]\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s*$/.exec(args);if(!match)return`用法：${p}添加倒计时 周末 | 2026-12-05 18:00（北京时间，只查询、不主动提醒）`;
   const title=match[1].trim(),at=Date.parse(`${match[2]}T${match[3]}:00+08:00`),normalized=Number.isFinite(at)?new Date(at+28800000).toISOString().slice(0,16):'';
   if(!textOK(title)||title.length>40||normalized!==`${match[2]}T${match[3]}`||at<=now||at-now>3660*86400000)return'请填写40字以内的标题及未来十年内有效的北京时间。';
   if(rows.some(r=>r.title===title))return'本会话已有同名倒计时，请换名或先删除。';if(rows.length>=10)return'本会话最多保存10个倒计时，请先删除旧项目。';
   const row={room,creator:user,title,at};state.countdowns.push(row);return'倒计时已保存：\n'+display(row)+'\n到点不会主动发消息，可随时查询。';
  }
  if(command==='删除倒计时'){
   const row=rows.find(r=>r.title===title);if(!row)return'没有找到这个倒计时，请填写完整标题。';if(!canManage(row,ctx))return'只有创建者、群管理员或机器人主人可以删除。';state.countdowns=state.countdowns.filter(r=>r!==row);return'已删除倒计时：'+title;
  }
  if(title){const row=rows.find(r=>r.title===title);return row?display(row):'本会话没有这个倒计时。';}
  return rows.length?'本会话倒计时\n'+rows.map(display).join('\n\n'):'本会话还没有倒计时。';
 }
 if(MORE_FEATURES[command]==='playSignup'){
  if(event.message_type!=='group')return'报名活动在群聊中使用。';
  let record=closeAt(state.signups.find(r=>r.room===room),now);
  if(command==='发起报名'){
   if(record&&!record.closed)return'本群已有报名活动：\n'+signupText(record);
   const parts=args.split(/[|｜]/u).map(x=>x.trim()),title=parts[0],limit=Number(parts[1]||20);
   if(parts.length>2||!textOK(title)||title.length>60||!Number.isInteger(limit)||limit<2||limit>1000)return`用法：${p}发起报名 周末开黑 | 5（人数2～1000，省略默认20）`;
   record={room,creator:user,title,limit,members:[],closed:false,endsAt:now+c.playRoundMinutes*60000};state.signups=state.signups.filter(r=>r.room!==room);state.signups.push(record);return signupText(record)+`\n发送“${p}报名”参加，“${p}退出报名”退出。`;
  }
  if(!record)return'本群暂时没有报名活动。';
  if(command==='报名名单')return signupText(record);
  if(command==='结束报名'){if(!record.closed&&!canManage(record,ctx))return'只有发起人、群管理员或机器人主人可以结束报名。';record.closed=true;return signupText(record);}
  if(record.closed)return signupText(record);
  const index=record.members.findIndex(m=>m.user===user);
  if(command==='退出报名'){if(index<0)return'你还没有报名。';record.members.splice(index,1);return`${safeName} 已退出报名，当前 ${record.members.length}/${record.limit} 人。`;}
  if(index>=0)return'你已经报名啦，无需重复报名。';if(record.members.length>=record.limit)return'名额已经满啦，可以等其他人退出。';record.members.push({user,name:safeName});return`${safeName} 报名成功！当前 ${record.members.length}/${record.limit} 人。`;
 }
 return null;
}
