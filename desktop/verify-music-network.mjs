import {app,BrowserWindow} from 'electron';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const targetFile=relative=>process.env.CUPBOX_MUSIC_REVIEW_APP?pathToFileURL(path.join(process.env.CUPBOX_MUSIC_REVIEW_APP,'desktop',relative)).href:new URL(relative,import.meta.url).href;
const {EchoMusicSession}=await import(targetFile('qq/echo-music-session.js'));
const {BackgroundMusicOnline}=await import(targetFile('background-music-online.js'));
process.on('uncaughtException',e=>{console.error(e);app.exit(1);});
process.on('unhandledRejection',e=>{console.error(e);app.exit(1);});
console.log('Starting isolated network music UI review');
const out=path.resolve('output/music-network-review'),home=path.join(out,'home');
await mkdir(path.join(home,'.cupbox'),{recursive:true});
await writeFile(path.join(home,'.cupbox/desktop.json'),JSON.stringify({startupEnabled:false,petEnabled:false,musicEnabled:false}));
process.env.CUPBOX_HOME=home;process.env.CUPBOX_UPDATE_DISABLE='1';process.env.CUPBOX_ANNOUNCEMENT_DISABLE='1';
app.setPath('userData',path.join(out,'profile'));app.disableHardwareAcceleration();app.commandLine.appendSwitch('mute-audio');
// Isolated fake provider; the real library, IPC, preload and renderer remain in use.
const hash=n=>String(n).padStart(32,'a');
let signedIn=true;
EchoMusicSession.prototype.status=async()=>({loggedIn:signedIn,userid:signedIn?'123':'',nickname:signedIn?'测试音乐账号':'',method:'kugou',phase:signedIn?'saved':'idle',accounts:[]});
EchoMusicSession.prototype.request=async function(action){
 if(action==='playlists')return{status:1,data:{info:[{listid:88,name:'我的收藏 · 樱花与清晨',song_count:2},{listid:89,name:'专注工作 / 很长的名字也能完整展示',song_count:2,list_create_userid:123}]}};
 if(action==='playlistTracks')return{status:1,data:{info:[{hash:hash(1),filename:'筑梦音乐 - 清晨的樱花.mp3'},{hash:hash(2),audio_info:{songname:'超长标题测试 · 春风穿过透明的玻璃窗与慢慢飘落的花瓣',singername:'筑梦音乐'}}]}};
 if(action==='search')return{status:1,data:{lists:[{FileHash:hash(3),SongName:'搜索结果 · 白日梦',SingerName:'筑梦音乐'}]}};
 if(action==='url')return{status:1,url:'https://fs.kugou.com/test.mp3'};
 throw Error('Unexpected fixture route: '+action);
};
const bytes=await readFile('desktop/ui/assets/audio/petal-drift.mp3');
const original=BackgroundMusicOnline.prototype.fetchAudio;
BackgroundMusicOnline.prototype.fetchAudio=async function(song,signal){this.download=async()=>({status:200,bytes});return original.call(this,song,signal);};
let main;const errors=[];
app.on('browser-window-created',(_,w)=>{w.show=()=>{};w.showInactive=()=>{};w.webContents.setBackgroundThrottling(false);w.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});if(!main)main=w;});
const js=s=>main.webContents.executeJavaScript(s),pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(s){for(let i=0;i<220;i++){try{if(await js(s))return;}catch{}await pause(50);}throw Error('Timeout: '+s);}
const check=(v,message)=>{if(!v)throw Error(message);console.log('PASS '+message);};
setTimeout(()=>{console.error('UI timeout');app.exit(1);},75000).unref();
await import(process.env.CUPBOX_MUSIC_REVIEW_APP?pathToFileURL(path.join(process.env.CUPBOX_MUSIC_REVIEW_APP,'desktop/main.js')).href:'./main.js');
void(async()=>{
await app.whenReady();console.log('Desktop ready');
try{
 await wait('window.cupboxReady&&window.CupboxMusic?.state');await js("openModal('music');true");
 check(await js("!!document.querySelector('#bgmusic-search')&&document.querySelector('#bgmusic-login').open===false"),'visible search and collapsed account controls');
 await js("document.querySelector('#bgmusic-playlists-tab').click();true");await wait("document.querySelectorAll('#bgmusic-playlists .bgmusic-result').length===2");
 await js("document.querySelector('#bgmusic-playlists .bgmusic-result button').click();true");await wait("document.querySelectorAll('.music-network-label').length===2");
 check(await js("Array.from(document.querySelectorAll('.music-network-label')).every(x=>x.textContent==='网络歌单'&&x===x.parentElement.lastElementChild)"),'synced cards end with network playlist labels');
 const id=await js("CupboxMusic.state.tracks.find(t=>t.network).id");
 await js(`document.querySelector('[data-track-id="${id}"] .music-track-play').click();true`);await wait('CupboxMusic.state.playing&&CupboxMusic.audio.currentTime>0');
 check(await js('CupboxMusic.audio.src.startsWith("file:")'),'first network playback resolves and decodes a local cache file');
 await js(`document.querySelector('[data-track-id="${id}"] input').click();true`);await wait(`CupboxMusic.state.tracks.find(t=>t.id==='${id}').disabled`);
 await js("document.querySelector('#bgmusic-playlists .bgmusic-result button').click();true");await wait("document.querySelector('#bgmusic-status').textContent.includes('新增 0')");
 check(await js(`CupboxMusic.state.tracks.filter(t=>t.network).length===2&&CupboxMusic.state.tracks.find(t=>t.id==='${id}').disabled`),'repeat sync preserves disabled cards without duplicates');
 await js("document.querySelector('#bgmusic-search-tab').click();document.querySelector('#bgmusic-query').value='白日梦';document.querySelector('#bgmusic-search-form').requestSubmit();true");await wait("document.querySelectorAll('#bgmusic-results .bgmusic-result').length===1");
 await js("document.querySelector('#bgmusic-results button').click();true");await wait("CupboxMusic.state.tracks.filter(t=>t.network).length===3");
 check(true,'search result adds into the same network music cards');
 for(const [name,width,theme] of [['light',1340,'light'],['dark',1340,'dark'],['compact',900,'light']]){
  main.setSize(width,920);await js(`document.documentElement.dataset.theme='${theme}';document.querySelector('#bgmusic-online').scrollIntoView({block:'start'});true`);await pause(180);
  const bad=await js(`Array.from(document.querySelectorAll('#bgmusic-online,.music-track:has(.music-network-label)')).filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.id||e.className)`);check(!bad.length,name+' cards have no horizontal overflow: '+bad.join(','));
  await writeFile(path.join(out,name+'.png'),(await main.webContents.capturePage()).toPNG());
  await js("document.querySelector('.music-network-label').scrollIntoView({block:'center'});true");await pause(100);await writeFile(path.join(out,name+'-tracks.png'),(await main.webContents.capturePage()).toPNG());
 }
 await js(`document.querySelector('[data-track-id="${id}"] .music-remove').click();true`);await wait("document.querySelector('#app-risk-dialog').open");
 check(await js("document.querySelector('#app-risk-dialog').textContent.includes('不会取消酷狗收藏')"),'themed removal dialog explains local-only effect');
 await js("document.querySelector('#app-risk-buttons [data-response=\"1\"]').click();true");await wait(`!CupboxMusic.state.tracks.some(t=>t.id==='${id}')`);
 check(errors.length===0,'no renderer errors');app.exit(0);
}catch(e){console.error(e);app.exit(1);}
})();
