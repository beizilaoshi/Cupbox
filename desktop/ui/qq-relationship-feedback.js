'use strict';
(()=>{
 const line=document.createElement('p');line.id='relationship-growth-feedback';line.className='small-note';line.setAttribute('role','status');document.getElementById('relationship-summary').after(line);
 const reasons={recorded:'已记录真实相处事件',locked:'好感已锁定；其他数值按独立规则变化',cooldown:'处于相处变化冷却中',daily_limit:'今天的事件变化已达上限',duplicate:'相同原话已经记录，不重复计分',no_event:'好感与信任需要明确的相处依据',opt_out:'尊重对方停止关系玩法的意愿',proactive:'主动消息不计作对方的相处进展',already_recorded:'本轮事件已记录'};
 function render(record){const u=record?.companion?.growthUpdate;if(!record){line.textContent='';return;}if(!u){line.textContent='尚无本轮成长记录；请确认关系成长已开启，并查看当前角色与会话的档案。';return;}const changes=[['好感',u.affection],['信任',u.trust],['熟悉度',u.familiarity]].filter(([,n])=>Number.isFinite(n)&&n!==0).map(([label,n])=>label+(n>0?'+':'')+Number(n.toFixed(1)));line.textContent=(changes.length?'本轮 '+changes.join(' · ')+'。':'本轮数值未变化。')+(reasons[u.status]||'按实际相处记录')+' · '+new Date(u.at).toLocaleString();}
 window.addEventListener('qq:relation-selected',e=>render(e.detail));render(window.BotRelations?.selected());
})();
