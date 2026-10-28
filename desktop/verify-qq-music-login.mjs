import {app,BrowserWindow} from 'electron';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';import {pathToFileURL} from 'node:url';
const out=path.resolve('output/qq-music-login-review',String(Date.now())),home=path.join(out,'home');
await mkdir(path.join(home,'.cupbox'),{recursive:true});
await writeFile(path.join(home,'.cupbox/desktop.json'),JSON.stringify({startupEnabled:false,petEnabled:false}));
process.env.CUPBOX_HOME=home;process.env.CUPBOX_UPDATE_DISABLE='1';process.env.CUPBOX_ANNOUNCEMENT_DISABLE='1';
app.setPath('userData',path.join(out,'profile'));app.disableHardwareAcceleration();
const errors=[];
app.on('browser-window-created',(_,w)=>{w.show=()=>{};w.showInactive=()=>{};w.webContents.setBackgroundThrottling(false);w.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,label){for(let i=0;i<240;i++){if(await fn())return;await pause(50);}throw Error(label);}
const check=(value,label)=>{if(!value)throw Error(label);console.log('PASS '+label);};
void(async()=>{try{
 const root=path.resolve('release/Cupbox可视化/resources/app');
 await import(pathToFileURL(path.join(root,'desktop/main.js')).href);
 await wait(()=>BrowserWindow.getAllWindows().length,'main window');const main=BrowserWindow.getAllWindows()[0];
 await wait(()=>main.webContents.executeJavaScript('Boolean(window.cupboxReady)').catch(()=>false),'main ready');
 await main.webContents.executeJavaScript('cupbox.qqOpen()');let bot;
 await wait(()=>{bot=BrowserWindow.getAllWindows().find(w=>w!==main&&w.webContents.getURL().includes('qq-bot.html'));return bot&&!bot.webContents.isLoading();},'bot window');
 const js=s=>bot.webContents.executeJavaScript(s);
 await wait(()=>js('Boolean(window.qqBotReady)').catch(()=>false),'bot ready');
 await js("document.querySelector('[data-tab=music]').click();true");
 await wait(()=>js("!!document.querySelector('#echo-login-card')&&!document.querySelector('#echo-login-start').disabled"),'login card ready');
 check(await js("document.querySelector('#echo-login-card').textContent.includes('酷狗概念版')&&document.querySelector('#echo-login-badge').textContent==='未登录'"),'点歌页独立概念版登录入口');
 await js("document.querySelector('#echo-login-start').click();true");
 await wait(()=>js("!document.querySelector('#echo-login-qr').hidden&&document.querySelector('#echo-login-qr').naturalWidth>0"),'live QR generated');
 check(await js("qqBot.musicLoginStatus().then(s=>s.phase==='waiting'&&!s.loggedIn&&!JSON.stringify(s).includes('token'))"),'真实概念版二维码、主进程不向界面返回token');
 await writeFile(path.join(out,'music-login-qr.png'),(await bot.webContents.capturePage()).toPNG());
 check(await js("document.querySelectorAll('[data-music-method]').length===5"),'五种登录方式完整显示');
 for(const method of ['sms','account','qq','wechat']){
  await js("document.querySelector('[data-music-method="+method+"]').click();true");
  await wait(()=>js("document.querySelector('[data-music-method="+method+"]').getAttribute('aria-selected')==='true'&&!document.querySelector('#echo-login-start').disabled"),'method '+method);
  if(['sms','account'].includes(method)){
   check(await js("document.querySelector('#echo-qr-panel').hidden&&!document.querySelector('#echo-panel-"+method+"').hidden&&document.querySelector('#echo-login-qr').hidden"),'表单模式隐藏旧二维码 '+method);
   if(method==='sms'){await js("document.querySelector('#echo-sms-send').click();true");await wait(()=>js("document.querySelector('#echo-login-status').textContent.includes('11位手机号')"),'phone validation');check(true,'空手机号被本机拦截，不发送短信');}
   if(method==='account'){await js("document.querySelector('#echo-password').value='not-submitted-password';true");check(await js("document.querySelector('#echo-password').type==='password'"),'密码默认掩码');}
  }else{
   check(await js("document.querySelector('#echo-password').value===''"),'切换方式清空密码 '+method);
   await js("document.querySelector('#echo-login-start').click();true");
   await wait(()=>js("!document.querySelector('#echo-login-qr').hidden&&document.querySelector('#echo-login-qr').naturalWidth>0&&!document.querySelector('#echo-login-start').disabled"),'live OAuth QR '+method);
   check(await js("qqBot.musicLoginStatus().then(s=>s.method==='"+method+"'&&!JSON.stringify(s).includes('qrsig')&&!JSON.stringify(s).includes('wx_code'))"),'真实授权二维码与会话隔离 '+method);
  }
  await writeFile(path.join(out,'music-login-'+method+'.png'),(await bot.webContents.capturePage()).toPNG());
 }
 bot.setSize(960,680);check(await js("document.querySelector('.bot-main').scrollWidth<=document.querySelector('.bot-main').clientWidth+1"),'最小窗口登录区不溢出');
 await writeFile(path.join(out,'music-login-small.png'),(await bot.webContents.capturePage()).toPNG());
 await js("qqBot.musicLoginCancel()");await js("qqBot.musicLogout()");
 check(await js("qqBot.musicLoginStatus().then(s=>!s.loggedIn&&!s.qrImage)"),'取消和退出会清除扫码状态');
 check(await js("qqBot.get().then(s=>!s.running&&!s.online)"),'没有连接QQ或发送消息');
 check(!errors.length,'无界面错误');console.log('QQ_MUSIC_LOGIN_UI_OK '+out);app.exit(0);
}catch(error){console.error(error);app.exit(1);}})();
