import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {QQService} from '../desktop/qq/service.js';
import {QQPlay,parsePlay} from '../desktop/qq/play.js';
import {validateSettings} from '../desktop/qq/store.js';
import {risksFor} from '../desktop/qq/risks.js';
const cleanup:(()=>any)[]=[];afterEach(async()=>{for(const fn of cleanup.splice(0))await fn();});
const self='123456',user='654321',group='111111';let sequence=0;
const message=(text:string,patch:any={}):any=>({post_type:'message',message_type:'group',self_id:self,user_id:user,group_id:group,sender:{nickname:'小明'},message_id:++sequence,message:[{type:'at',data:{qq:self}},{type:'text',data:{text}}],...patch});
const plain=(text:string,patch:any={})=>message(text,{message:[{type:'text',data:{text}}],...patch});
async function fixture(patch:any={}){
 const home=await mkdtemp(path.join(os.tmpdir(),'qq-play-')),model=vi.fn(async()=>({text:'普通聊天'}));
 const s=await new QQService({home,choices:{records:async()=>({all:[]})},respond:model}).init();
 cleanup.unshift(async()=>{s.background.dispose();await s.stop();await rm(home,{recursive:true,force:true});});
 s.config=validateSettings({enabled:true,playEnabled:true,cooldown:0,retainDialogue:false,globalMemory:false,...patch});s.engine.update(s.config);s.started=true;s.online=true;s.connectionState='online';s.bot={send:vi.fn(async()=>({message_id:99})),close:()=>{}};
 let now=Date.parse('2026-10-27T12:00:00+08:00');s.play=new QQPlay(s,{clock:()=>now,roll:(min:number)=>min});
 return{s,model,advance:(ms=6000)=>{now+=ms;},text:()=>s.bot.send.mock.calls.at(-1)?.[1].filter((x:any)=>x.type==='text').map((x:any)=>x.data.text).join('')||'',data:()=>s.store.json('play-data.json',null)};
}
describe('QQ 本地互动玩法',()=>{
 it('defaults off, validates configuration and preserves old settings',()=>{
  expect(validateSettings({}).playEnabled).toBe(false);expect(validateSettings({}).playRequireMention).toBe(true);
  for(const patch of [{playPrefix:''},{playPrefix:'a b'},{playPrefix:'\u200b'},{playCooldown:0},{playPollMinutes:1441},{playEnabled:'yes'}])expect(()=>validateSettings(patch)).toThrow();
  expect(risksFor(validateSettings({}),validateSettings({enabled:true,playEnabled:true})).some((r:any)=>r.title==='启用互动玩法')).toBe(true);
  expect(parsePlay(message('/签到啦'),validateSettings({}))).toBeNull();expect(parsePlay(message('聊聊/签到'),validateSettings({}))).toBeNull();
 });
 it('requires an actual mention, respects allowlists and disabled features, invokes no model',async()=>{
  const f=await fixture({groupAt:false,groupPolicy:'allow',allowedGroups:[group]});
  expect(await f.s.receive(plain('/签到'))).toMatchObject({skipped:'互动玩法需要 @ 机器人'});
  expect(await f.s.receive(message('/签到',{group_id:'222222'}))).toHaveProperty('skipped');expect(f.s.bot.send).not.toHaveBeenCalled();
  expect(await f.s.receive(message('/签到'))).toMatchObject({sent:true,play:true});expect(f.model).not.toHaveBeenCalled();
  f.s.config.playDice=false;expect(await f.s.receive(message('/掷骰'))).toMatchObject({skipped:'此互动玩法未开启'});expect(f.s.bot.send).toHaveBeenCalledTimes(1);
 });
 it('signs once a Beijing day, survives restart, counts consecutive days and isolates rooms/accounts',async()=>{
  const f=await fixture();await f.s.receive(message('/签到'));expect(f.text()).toContain('签到成功');const first=await f.data();expect(first.checkins[0].total).toBe(1);
  f.advance();await f.s.receive(message('/签到'));expect(f.text()).toContain('已经签到');expect((await f.data()).checkins[0].points).toBe(first.checkins[0].points);
  f.s.play=new QQPlay(f.s,{clock:()=>Date.parse('2026-10-28T00:00:00+08:00')});await f.s.receive(message('/签到'));expect(f.text()).toContain('连续 2 天');
  await f.s.receive(message('/签到',{user_id:'777777'}));expect((await f.data()).checkins).toHaveLength(2);
  await f.s.receive(message('/签到',{group_id:'222222'}));await f.s.receive(message('/签到',{self_id:'999999',message:[{type:'at',data:{qq:'999999'}},{type:'text',data:{text:'/签到'}}]}));expect((await f.data()).checkins).toHaveLength(4);
  const privateEvent=plain('/签到榜',{message_type:'private'});await f.s.receive(privateEvent);expect(f.text()).toContain('还没有签到记录');
 });
 it('keeps fortune stable across conversations and rolls constrained real choices without AI',async()=>{
  const f=await fixture();await f.s.receive(message('/今日运势'));const fortune=f.text().trim();f.advance();await f.s.receive(plain('/今日运势',{message_type:'private'}));expect(f.text()).toBe(fortune);
  f.advance();await f.s.receive(message('/掷骰 2d6'));expect(f.text()).toContain('2d6 → 1 + 1 = 2');f.advance();await f.s.receive(message('/掷骰 11d6'));expect(f.text()).toContain('骰子范围');
  f.advance();await f.s.receive(message('/帮我选 米饭 | 面条'));expect(f.text()).toContain('我抽到的是：米饭');expect(f.model).not.toHaveBeenCalled();
 });
 it('creates scoped polls, enforces one person one vote and restricts early closing',async()=>{
  const f=await fixture();await f.s.receive(message('/发起投票 午饭 | 米饭 | 面条'));expect(f.text()).toContain('进行中的投票');
  f.advance();await f.s.receive(message('/投票 1'));expect(f.text()).toContain('米饭 · 1 票');f.advance();await f.s.receive(message('/投票 2'));expect(f.text()).toContain('米饭 · 0 票');expect(f.text()).toContain('面条 · 1 票');
  await f.s.receive(message('/结束投票',{user_id:'777777'}));expect(f.text()).toContain('只有发起人');expect((await f.data()).polls[0].closed).toBe(false);
  f.advance();await f.s.receive(message('/查看投票',{group_id:'222222'}));expect(f.text()).toContain('还没有投票');f.advance();await f.s.receive(message('/结束投票'));expect(f.text()).toContain('投票已结束');
  const votes=(await f.data()).polls[0].votes;f.advance();await f.s.receive(message('/投票 1'));expect((await f.data()).polls[0].votes).toEqual(votes);
 });
 it('expires polls across midnight and leaves old votes closed after restart',async()=>{
  const f=await fixture({playPollMinutes:5});await f.s.receive(message('/发起投票 出门吗 | 去 | 不去'));f.advance(300001);await f.s.receive(message('/投票 1'));expect(f.text()).toContain('投票已结束');expect((await f.data()).polls[0].votes).toEqual({});
  f.advance();await f.s.receive(message('/发起投票 下一题 | A | B'));expect(f.text()).toContain('下一题');expect((await f.data()).polls).toHaveLength(1);
 });
 it('deduplicates persisted events after recreation and never retries unknown sends',async()=>{
  const f=await fixture(),e=message('/签到');f.s.bot.send.mockRejectedValueOnce(Object.assign(Error('timeout'),{code:'ONEBOT_TIMEOUT'}));expect(await f.s.receive(e)).toHaveProperty('skipped');expect((await f.data()).checkins[0].total).toBe(1);
  f.s.play=new QQPlay(f.s);expect(await f.s.receive(e)).toMatchObject({skipped:'重复玩法事件'});expect(f.s.bot.send).toHaveBeenCalledTimes(1);expect(f.model).not.toHaveBeenCalled();
 });
 it('cools down spam, shares delivery budget, and cancels before saving after settings change',async()=>{
  const f=await fixture({maxPerMinute:1});await f.s.receive(message('/签到'));expect(await f.s.receive(message('/积分'))).toMatchObject({skipped:'互动玩法冷却中'});f.advance();expect(await f.s.receive(message('/今日运势'))).toHaveProperty('skipped');expect(f.s.bot.send).toHaveBeenCalledTimes(1);
  f.s.engine.deliveryRate=[];let release:()=>void=()=>{};const pending=new Promise<void>(r=>{release=r;});const prior=f.s.store.change(()=>pending);f.advance();const turn=f.s.receive(message('/发起投票 测试 | A | B'));await new Promise(r=>setTimeout(r,10));f.s.engine.generation++;release();await prior;expect(await turn).toHaveProperty('skipped');expect((await f.data()).polls).toHaveLength(0);
 });
 it('supports configured prefixes and direct group commands without changing normal trigger settings',async()=>{
  const f=await fixture({playPrefix:'#',playRequireMention:false,groupAt:false});await f.s.receive(plain('#玩法帮助'));expect(f.text()).toContain('#签到');expect(f.s.config.groupAt).toBe(false);expect(f.model).not.toHaveBeenCalled();
 });
 it('rejects invalid/duplicate poll options and does not override sleep or private block rules',async()=>{
  const f=await fixture();await f.s.receive(message('/发起投票 主题 | A | A'));expect(f.text()).toContain('用法');expect((await f.data()).polls).toHaveLength(0);
  f.s.config.privatePolicy='allow';f.s.config.allowedUsers=[];await f.s.receive(plain('/签到',{message_type:'private'}));expect(f.s.bot.send).toHaveBeenCalledTimes(1);
  f.advance();f.s.config.sleepReplyEnabled=true;f.s.config.sleepHour=11;f.s.config.wakeHour=13;expect(await f.s.play.receive(message('/签到'))).toHaveProperty('skipped');expect(f.s.bot.send).toHaveBeenCalledTimes(1);
 });
});

describe('扩展小游戏与群活动',()=>{
 it('keeps additions opt-in, validates custom dictionary and carries old local state forward',async()=>{
  const c=validateSettings({});for(const key of ['playGuess','playIdiom','playCountdown','playSignup'])expect(c[key]).toBe(false);
  for(const patch of [{playRoundMinutes:0},{playGuessAttempts:101},{playIdioms:'不是成语啊'},{playIdioms:42}])expect(()=>validateSettings(patch)).toThrow();
  expect(validateSettings({playIdioms:'一心一意\n意气风发'}).playIdioms).toContain('意气风发');
  const f=await fixture({playGuess:true});await f.s.store.write('play-data.json',{version:1,checkins:[{room:'old',user:'old',points:99}],polls:[],seen:[]});await f.s.receive(message('/猜数字'));expect(f.text()).toContain('想好啦');expect((await f.data()).checkins[0].points).toBe(99);expect((await f.data()).guessGames).toHaveLength(1);
 });
 it('plays shared guessing with truthful hints and reveals no answer before finish',async()=>{
  const f=await fixture({playGuess:true});f.s.play.roll=()=>42;await f.s.receive(message('/猜数字 100'));expect(f.text()).not.toContain('42');
  f.advance();await f.s.receive(message('/猜 30'));expect(f.text()).toContain('小了');await f.s.receive(message('/猜 50',{user_id:'777777'}));expect(f.text()).toContain('大了');
  f.advance();await f.s.receive(message('/猜数字状态'));expect(f.text()).toContain('已猜 2 次');expect(f.text()).not.toContain('42');
  f.advance();await f.s.receive(message('/猜 42'));expect(f.text()).toContain('猜中了');expect((await f.data()).guessGames[0]).toMatchObject({closed:true,attempts:3});expect(f.model).not.toHaveBeenCalled();
 });
 it('enforces game ownership, chance limit, expiry and conversation separation',async()=>{
  const f=await fixture({playGuess:true,playGuessAttempts:5});await f.s.receive(message('/猜数字'));await f.s.receive(message('/结束猜数字',{user_id:'777777'}));expect(f.text()).toContain('只有发起人');
  await f.s.receive(message('/猜数字状态',{group_id:'222222'}));expect(f.text()).toContain('还没开始');
  for(let i=0;i<5;i++){f.advance();await f.s.receive(message('/猜 2'));}expect(f.text()).toContain('机会用完');
  f.advance();await f.s.receive(message('/猜数字 10'));f.advance(31*60000);await f.s.receive(message('/猜 1'));expect(f.text()).toContain('这局已结束');
 });
 it('restores a running game after recreation and does not duplicate a replayed guess',async()=>{
  const f=await fixture({playGuess:true});await f.s.receive(message('/猜数字'));f.s.play=new QQPlay(f.s);const e=message('/猜 50');await f.s.receive(e);expect((await f.data()).guessGames[0].attempts).toBe(1);f.s.play=new QQPlay(f.s);expect(await f.s.receive(e)).toMatchObject({skipped:'重复玩法事件'});expect((await f.data()).guessGames[0].attempts).toBe(1);
 });
 it('checks real dictionary entries, word boundaries, repeats, hints and custom idioms',async()=>{
  const f=await fixture({playIdiom:true,playIdioms:'大展宏图\n图穷匕见'});await f.s.receive(message('/成语接龙 一心一意'));expect(f.text()).toContain('成语接龙开始');
  f.advance();await f.s.receive(message('/接龙 一马当先'));expect(f.text()).toContain('要以“意”');f.advance();await f.s.receive(message('/接龙 意气风发'));expect(f.text()).toContain('接上了');
  f.advance();await f.s.receive(message('/接龙提示'));expect(f.text()).toContain('发扬光大');f.advance();await f.s.receive(message('/接龙 意气风发'));expect(f.text()).toContain('已经用过');
  f.advance();await f.s.receive(message('/接龙 发扬光大'));f.advance();await f.s.receive(message('/接龙 大展宏图'));expect(f.text()).toContain('接上了');f.advance();await f.s.receive(message('/接龙状态'));expect(f.text()).toContain('下一个以“图”');expect((await f.data()).idiomGames[0].used).toHaveLength(4);
 });
 it('protects idiom game ending and expires without proactively sending',async()=>{
  const f=await fixture({playIdiom:true});await f.s.receive(message('/成语接龙 一心一意'));await f.s.receive(message('/结束接龙',{user_id:'777777'}));expect(f.text()).toContain('只有发起人');
  f.advance(31*60000);expect(f.s.bot.send).toHaveBeenCalledTimes(2);await f.s.receive(message('/接龙 意气风发'));expect(f.text()).toContain('这局接龙已结束');
 });
 it('persists valid Beijing countdown dates, rejects impossible dates and limits delete permissions',async()=>{
  const f=await fixture({playCountdown:true});await f.s.receive(message('/添加倒计时 活动 | 2026-10-28 12:00'));expect(f.text()).toContain('还剩 1天0小时0分');
  f.advance();await f.s.receive(message('/添加倒计时 错误 | 2027-02-30 12:00'));expect(f.text()).toContain('有效的北京时间');expect((await f.data()).countdowns).toHaveLength(1);
  f.advance();await f.s.receive(message('/添加倒计时 活动 | 2026-10-29 12:00'));expect(f.text()).toContain('同名');
  await f.s.receive(message('/删除倒计时 活动',{user_id:'777777'}));expect(f.text()).toContain('只有创建者');f.advance();await f.s.receive(message('/倒计时 活动',{group_id:'222222'}));expect(f.text()).toContain('没有这个');
  f.advance(2*86400000);await f.s.receive(message('/倒计时 活动'));expect(f.text()).toContain('已过去');f.advance();await f.s.receive(message('/删除倒计时 活动'));expect((await f.data()).countdowns).toHaveLength(0);
 });
 it('keeps private countdowns isolated and enforces the per-room limit',async()=>{
  const f=await fixture({playCountdown:true});for(let i=0;i<11;i++){f.advance();await f.s.receive(plain(`/添加倒计时 活动${i} | 2027-01-01 12:00`,{message_type:'private'}));}expect(f.text()).toContain('最多保存10个');expect((await f.data()).countdowns).toHaveLength(10);
  f.advance();await f.s.receive(plain('/倒计时',{message_type:'private',user_id:'777777'}));expect(f.text()).toContain('还没有倒计时');
 });
 it('deduplicates signups, handles capacity and withdrawal, and restricts closing',async()=>{
  const f=await fixture({playSignup:true});await f.s.receive(message('/发起报名 开黑 | 2'));f.advance();await f.s.receive(message('/报名'));expect(f.text()).toContain('报名成功');f.advance();await f.s.receive(message('/报名'));expect(f.text()).toContain('已经报名');
  await f.s.receive(message('/报名',{user_id:'777777',sender:{nickname:'小红'}}));await f.s.receive(message('/报名',{user_id:'888888'}));expect(f.text()).toContain('名额已经满');
  f.advance();await f.s.receive(message('/退出报名'));expect(f.text()).toContain('已退出');f.advance();await f.s.receive(message('/报名',{user_id:'888888'}));expect(f.text()).toContain('报名成功');f.advance();await f.s.receive(message('/报名名单'));expect(f.text()).toContain('小红');expect(f.text()).toContain('2/2');
  f.advance();await f.s.receive(message('/结束报名',{user_id:'777777'}));expect(f.text()).toContain('只有发起人');f.advance();await f.s.receive(message('/结束报名'));expect(f.text()).toContain('报名已结束');
 });
 it('expires signup, rejects private signup and disabled games without model calls',async()=>{
  const f=await fixture({playSignup:true});await f.s.receive(message('/发起报名 活动 | 10'));f.advance(31*60000);await f.s.receive(message('/报名'));expect(f.text()).toContain('报名已结束');expect((await f.data()).signups[0].members).toHaveLength(0);
  f.advance();await f.s.receive(plain('/报名',{message_type:'private'}));expect(f.text()).toContain('在群聊中使用');expect(await f.s.receive(message('/猜数字'))).toMatchObject({skipped:'此互动玩法未开启'});expect(f.model).not.toHaveBeenCalled();
 });
 it('uses the same real-mention and authorization gates for new games',async()=>{
  const f=await fixture({playGuess:true,groupPolicy:'allow',allowedGroups:[group]});expect(await f.s.receive(plain('/猜数字'))).toMatchObject({skipped:'互动玩法需要 @ 机器人'});expect(await f.s.receive(message('/猜数字',{group_id:'222222'}))).toHaveProperty('skipped');expect(f.s.bot.send).not.toHaveBeenCalled();expect(await f.data()).toBeNull();
 });
});
