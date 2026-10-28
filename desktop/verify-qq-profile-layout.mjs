import {app,BrowserWindow} from 'electron';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';import {pathToFileURL} from 'node:url';
const out=path.resolve('output/qq-profile-layout',String(Date.now())),home=path.join(out,'home'),root=path.resolve('release/Cupbox可视化/resources/app');
await mkdir(path.join(home,'.cupbox'),{recursive:true});
await writeFile(path.join(home,'.cupbox/desktop.json'),JSON.stringify({startupEnabled:false,petEnabled:false,musicEnabled:false}));
process.env.CUPBOX_HOME=home;process.env.CUPBOX_UPDATE_DISABLE='1';process.env.CUPBOX_ANNOUNCEMENT_DISABLE='1';app.setPath('userData',path.join(out,'profile'));app.disableHardwareAcceleration();
const errors=[];app.on('browser-window-created',(_,w)=>{w.show=()=>{};w.showInactive=()=>{};w.webContents.setBackgroundThrottling(false);w.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});});
const pause=ms=>new Promise(r=>setTimeout(r,ms));async function wait(fn,label){for(let i=0;i<240;i++){if(await fn())return;await pause(50);}throw Error(label);}
const check=(value,label)=>{if(!value)throw Error(label);console.log('PASS '+label);};
void(async()=>{try{
 const {BotMemory}=await import(pathToFileURL(path.join(root,'desktop/qq/memory.js'))),memory=new BotMemory(path.join(home,'.cupbox/memory/qq-bot'));
 for(let i=0;i<35;i++)await memory.saveRomance({self_id:123456,user_id:654321+i,message_type:'private'},`${654321+i}:companion:cafe`,{score:i-20,trust:-10,familiarity:60,userLabel:i===0?'用户昵称比较长时也要保持页面对齐':'测试用户 '+(i+1),userBio:'兴趣与日常资料。'.repeat(20),companionMode:'route',steps:[]});
 await import(pathToFileURL(path.join(root,'desktop/main.js')));await wait(()=>BrowserWindow.getAllWindows().length,'main');const main=BrowserWindow.getAllWindows()[0];await wait(()=>main.webContents.executeJavaScript('Boolean(window.cupboxReady)').catch(()=>false),'main ready');await main.webContents.executeJavaScript('cupbox.qqOpen()');let bot;
 await wait(()=>{bot=BrowserWindow.getAllWindows().find(w=>w!==main&&w.webContents.getURL().includes('qq-bot.html'));return bot&&!bot.webContents.isLoading();},'bot');const js=s=>bot.webContents.executeJavaScript(s);await wait(()=>js('Boolean(window.qqBotReady)').catch(()=>false),'bot ready');bot.setMinimumSize(800,600);
 await js(`document.querySelector('[data-tab=user-data]').click();true`);await wait(()=>js(`document.querySelectorAll('.profile-person').length===35`),'profiles');await js(`document.querySelector('.profile-person').click();true`);
 for(const width of [840,1000,1280])for(const theme of ['light','dark']){
  bot.setSize(width,740);await js(`document.documentElement.dataset.theme='${theme}'`);await pause(130);let reference;
  for(const pane of ['overview','profile','relationship','memory']){
   await js(`document.querySelector('[data-profile-tab=${pane}]').click();true`);await pause(30);
   const geometry=await js(`(()=>{const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}};return{frame:rect(document.getElementById('relation-detail-frame')),directory:rect(document.querySelector('.profile-directory')),overflow:[...document.querySelectorAll('#relation-detail-host,#relation-directory,.bot-main')].some(n=>n.scrollWidth>n.clientWidth+1),overflowNodes:[...document.querySelectorAll('#relation-detail-host,#relation-directory,.bot-main')].filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>({id:n.id,cls:n.className,width:n.clientWidth,scroll:n.scrollWidth})),wide:[...document.querySelectorAll('#relation-detail-host *')].filter(n=>n.getClientRects().length&&n.getBoundingClientRect().right>document.getElementById('relation-detail-host').getBoundingClientRect().left+document.getElementById('relation-detail-host').clientWidth).map(n=>({id:n.id,cls:n.className,tag:n.tagName,width:n.getBoundingClientRect().width})),visible:[...document.querySelectorAll('[data-profile-pane]')].filter(n=>!n.hidden).length};})()`);
   if(geometry.overflow||geometry.visible!==1){await writeFile(path.join(out,'failure.png'),(await bot.webContents.capturePage()).toPNG());console.log('FAILED_GEOMETRY '+JSON.stringify(geometry)+' '+out);}
   check(!geometry.overflow&&geometry.visible===1,width+' '+theme+' '+pane+' fits');if(reference)check(JSON.stringify(reference)===JSON.stringify({frame:geometry.frame,directory:geometry.directory}),'tab switch keeps frame geometry');reference={frame:geometry.frame,directory:geometry.directory};
   if(width!==1000)await writeFile(path.join(out,`${width}-${theme}-${pane}.png`),(await bot.webContents.capturePage()).toPNG());
  }
 }
 await js(`document.querySelectorAll('.profile-person')[34].click();document.querySelector('[data-profile-tab=profile]').click();document.getElementById('relation-directory').scrollTop=350;document.getElementById('relation-detail-host').scrollTop=200;true`);
 check(await js(`document.getElementById('relation-editor-title').textContent.includes('用户昵称比较长')&&document.querySelector('.bot-main').scrollWidth<=document.querySelector('.bot-main').clientWidth+1`),'long display names stay inside the archive header');
 const before=await js(`({left:document.getElementById('relation-directory').scrollTop,right:document.getElementById('relation-detail-host').scrollTop})`);check(before.left>0&&before.right>0,'both regions scroll');
 await js(`document.getElementById('relation-user-bio').value='草稿内容';document.getElementById('relation-user-bio').dispatchEvent(new Event('input',{bubbles:true}));true`);
 check(await js(`document.getElementById('relation-directory').scrollTop===${before.left}&&document.getElementById('relation-detail-host').scrollTop===${before.right}`),'editing preserves both scroll positions');
 await js(`switchTab('chat');switchTab('user-data');true`);check(await js(`document.getElementById('relation-user-bio').value==='草稿内容'`),'draft survives page switches');
 check(await js(`(()=>{const host=document.getElementById('relation-detail-host'),header=document.querySelector('.profile-detail-head'),footer=document.querySelector('.profile-actions');return header.getBoundingClientRect().bottom<=host.getBoundingClientRect().top+1&&footer.getBoundingClientRect().top>=host.getBoundingClientRect().bottom-1;})()`),'header and save actions do not cover content');
 await js(`document.getElementById('relation-save').click();true`);await wait(()=>js(`document.getElementById('relation-edit-status').textContent.includes('用户数据已保存')`),'profile save');check(await js(`BotRelations.selected().userBio==='草稿内容'`),'archive edits still persist through the real IPC');
 check(!errors.length,'no renderer errors '+errors.join(';'));console.log('QQ_PROFILE_LAYOUT_OK '+out);app.exit(0);
}catch(e){console.error(e);app.exit(1);}})();
