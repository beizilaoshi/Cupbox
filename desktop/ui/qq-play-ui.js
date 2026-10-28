'use strict';
window.BotPlay=(()=>{
 const toggle=(key,title,description)=>`<label class="switch-row"><span><b>${title}</b><small>${description}</small></span><input type="checkbox" data-setting="${key}"></label>`;
 function mount(){
  const panel=document.createElement('section');panel.dataset.panel='play';panel.hidden=true;
  panel.innerHTML=`<div class="page-heading"><span class="eyebrow">A LITTLE FUN TOGETHER</span><h1>互动玩法</h1><p>签到、抽签、小决定和群投票，不用等待 AI，随时来一局。</p></div>
  <article class="bot-card"><h2>玩法开关与触发</h2>${toggle('playEnabled','开启互动玩法','默认关闭。开启后只响应明确的玩法指令，不主动刷屏，不消耗模型额度。')}${toggle('playRequireMention','群聊需要 @ 机器人','默认开启。关闭后允许在已授权的群里直接发送玩法指令；私聊无需 @。')}<div class="settings-grid"><label class="field">指令前缀<input data-setting="playPrefix" maxlength="10" placeholder="/"><small>1～10个字符，例如 / 或 #。下方示例使用当前草稿的前缀。</small></label><label class="field">每人每会话冷却（秒）<input type="number" data-setting="playCooldown" min="1" max="300"><small>也遵守全局每分钟回复上限。</small></label></div><p class="small-note">自动回复、群白黑名单、私聊范围、睡眠时间与互刷保护仍然生效。聊天模式和工作模式都可使用明确指令。</p></article>
  <article class="bot-card"><h2>签到与每日小惊喜</h2>${toggle('playCheckin','签到、积分与签到榜','北京时间每天一次，连续签到和累计天数自动保存。每次5～15积分，积分仅用于玩法，不影响好感和信任。')}${toggle('playFortune','今日运势','幸运色和轻松小建议，同一账号下同一用户当天结果固定，群聊和私聊不会反复刷新。仅供娱乐。')}<div class="info-note" id="play-daily-help"></div></article>
  <article class="bot-card"><h2>小决定与骰子</h2>${toggle('playDice','真实随机骰子','支持 2d6 等写法，最多10枚、每枚2～1000面，由本机生成点数。')}${toggle('playChoice','帮我选','用 | 分开2～20个候选，随机选出一个。不会使用聊天中的指令执行本地操作。')}<div class="info-note" id="play-random-help"></div></article>
  <article class="bot-card"><h2>群投票</h2>${toggle('playPoll','允许群成员发起与参与投票','每群同时一个投票，2～8个选项。每人一票，可修改；发起人、群主、管理员和机器人主人可以提前结束。')}<label class="field">投票有效期（分钟）<input type="number" data-setting="playPollMinutes" min="5" max="1440"><small>到期后停止接受投票，查询时显示最终结果，不主动发消息。修改时长只影响新建投票。</small></label><div class="info-note" id="play-poll-help"></div></article>
  <article class="bot-card"><h2>本机保存与使用说明</h2><p class="small-note">签到积分和投票保存在当前账号工作区的 qq-bot/play-data.json。签到榜只显示本会话的昵称、积分和累计天数；投票只公开票数，不公开投票人名单。记录按账号和会话隔离，重启保留，最多保存5000份签到档案和200个会话的最近投票。改变群聊记忆共享范围不会共享玩法数据。</p><p class="small-note">玩法总开关关闭时，各子功能的选择会保留。启用总开关后，默认选中这五种玩法，可按需关闭。</p><div class="info-note" id="play-help-command"></div></article>`;
  const more=document.createElement('div');more.className='play-more-cards';more.innerHTML=`
  <article class="bot-card"><h2>猜数字与成语接龙</h2>${toggle('playGuess','猜数字','默认关闭。群里共用一局，给出大小提示，猜中、次数用尽或到期即结束；私聊也可以玩。')}${toggle('playIdiom','成语接龙','默认关闭。按汉字首尾接龙，不允许重复，只使用本机成语词库。支持提示与自定义补充，不支持同音字。')}<div class="settings-grid"><label class="field">小游戏与报名有效期（分钟）<input data-setting="playRoundMinutes" type="number" min="5" max="1440"><small>影响新开猜数字、接龙和报名活动，不改变已经开始的活动。</small></label><label class="field">每局猜数字机会<input data-setting="playGuessAttempts" type="number" min="5" max="100"><small>同一会话所有参与者共用。</small></label></div><label class="field">补充成语词库<textarea data-setting="playIdioms" rows="4" maxlength="6000" placeholder="一心一意&#10;意气风发"></textarea><small>每行一个四字成语，最多6000字；保存后扩展内置词库，按输入内容校验，不联网验证释义。</small></label><div class="info-note" id="play-games-help"></div></article>
  <article class="bot-card"><h2>倒计时</h2>${toggle('playCountdown','会话倒计时','默认关闭。保存考试、生日、活动等日期，按北京时间查询剩余时间。只在查询时回复，到点不主动提醒。')}<div class="info-note" id="play-countdown-help"></div><p class="small-note">每会话最多10个、标题不重名。创建者、群管理员或机器人主人可删除。支持群聊共享和独立私聊。</p></article>
  <article class="bot-card"><h2>群内活动报名</h2>${toggle('playSignup','活动报名','默认关闭。每群同时一个活动，自定义2～1000个名额，报名去重、退出、满员提示、名单和提前结束。')}<div class="info-note" id="play-signup-help"></div><p class="small-note">报名名单显示参与者昵称，超过20人时显示前20人和总人数。发起人、群管理员或机器人主人可结束；到期停止报名，不主动发消息。</p></article>`;
  panel.querySelector('article:last-child').before(...more.children);
  panel.querySelector('.page-heading p').textContent='签到、小游戏、小决定和群活动，不用等待 AI，随时一起玩。';
  const notes=panel.querySelectorAll('article:last-child .small-note');notes[0].textContent+=' 新小游戏、倒计时和报名也保存在同一文件，旧版数据会自动兼容。每种扩展最多保存200个会话的记录。';notes[1].textContent='玩法总开关关闭时，各子功能的选择会保留。本次新增的四项功能默认关闭，按需启用后保存。';
  const form=document.getElementById('bot-form');form.insertBefore(panel,form.querySelector('footer'));
  const nav=document.createElement('button');nav.type='button';nav.dataset.tab='play';nav.textContent='互动玩法';document.querySelector('.bot-side nav').append(nav);
  const preview=()=>{const f=panel.querySelector('[data-setting=playPrefix]'),p=f.value||'/',at=panel.querySelector('[data-setting=playRequireMention]').checked?'@机器人 ':'';
   document.getElementById('play-daily-help').textContent=`${at}${p}签到　${p}积分　${p}签到榜　${p}今日运势`;
   document.getElementById('play-random-help').textContent=`${at}${p}掷骰 2d6\n${at}${p}帮我选 米饭 | 面条 | 饺子`;
   document.getElementById('play-poll-help').textContent=`${at}${p}发起投票 午饭吃什么 | 米饭 | 面条\n${at}${p}投票 1\n${at}${p}查看投票\n${at}${p}结束投票`;
   document.getElementById('play-help-command').textContent=`发送 ${at}${p}玩法帮助，查看当前启用功能的指令。`;
   document.getElementById('play-games-help').textContent=`${at}${p}猜数字 100　${p}猜 50　${p}猜数字状态　${p}结束猜数字\n${at}${p}成语接龙 一心一意\n${at}${p}接龙 意气风发　${p}接龙提示　${p}接龙状态　${p}结束接龙`;
   document.getElementById('play-countdown-help').textContent=`${at}${p}添加倒计时 周末 | 2026-12-05 18:00\n${at}${p}倒计时　${p}倒计时 周末　${p}删除倒计时 周末`;
   document.getElementById('play-signup-help').textContent=`${at}${p}发起报名 周末开黑 | 5\n${at}${p}报名　${p}退出报名　${p}报名名单　${p}结束报名`;
  };
  for(const key of ['playPrefix','playRequireMention'])panel.querySelector(`[data-setting=${key}]`).addEventListener('input',preview);
  return preview;
 }
 let update=()=>{};return{mount(){update=mount();},fill(){update();}};
})();
