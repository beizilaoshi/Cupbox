export const PLAY_DEFAULTS={playEnabled:false,playRequireMention:true,playPrefix:'/',playCheckin:true,playFortune:true,playDice:true,playChoice:true,playPoll:true,playCooldown:5,playPollMinutes:60};
Object.assign(PLAY_DEFAULTS,{playGuess:false,playIdiom:false,playCountdown:false,playSignup:false,playRoundMinutes:30,playGuessAttempts:20,playIdioms:''});
export function validatePlay(c){
 if(typeof c.playPrefix!=='string'||!c.playPrefix.trim()||c.playPrefix.length>10||/[\s\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/u.test(c.playPrefix))throw Error('玩法指令前缀需为1～10个非空白可见字符');
 for(const [key,min,max]of [['playCooldown',1,300],['playPollMinutes',5,1440]])if(!Number.isInteger(c[key])||c[key]<min||c[key]>max)throw Error('玩法冷却或投票时长超出范围');
 for(const [key,min,max]of [['playRoundMinutes',5,1440],['playGuessAttempts',5,100]])if(!Number.isInteger(c[key])||c[key]<min||c[key]>max)throw Error('小游戏时长或猜测次数超出范围');
 if(typeof c.playIdioms!=='string'||c.playIdioms.length>6000||c.playIdioms.split(/[\s,，、]+/u).filter(Boolean).some(word=>!/^\p{Script=Han}{4}$/u.test(word)))throw Error('自定义成语需为四个汉字，每行一个，合计最多6000字');
}
