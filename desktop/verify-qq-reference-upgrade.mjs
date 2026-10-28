import {app,BrowserWindow} from 'electron';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';import {pathToFileURL} from 'node:url';
const out=path.resolve('output/qq-reference-upgrade',String(Date.now())),home=path.join(out,'home'),root=path.resolve('release/Cupbox可视化/resources/app');
await mkdir(path.join(home,'.cupbox'),{recursive:true});await writeFile(path.join(home,'.cupbox/desktop.json'),JSON.stringify({startupEnabled:false,petEnabled:false}));
const {BotMemory}=await import(pathToFileURL(path.join(root,'desktop/qq/memory.js'))),memory=new BotMemory(path.join(home,'.cupbox/memory/qq-bot')),target={account:'123456',kind:'private',id:'654321'};
await memory.append({self_id:target.account,user_id:target.id,message_type:'private',message_id:42},[{role:'user',name:'qq_654321',text:'我喜欢乌龙茶'}]);
const file=await memory.file(target),original=await readFile(file,'utf8');
process.env.CUPBOX_HOME=home;process.env.CUPBOX_UPDATE_DISABLE='1';process.env.CUPBOX_ANNOUNCEMENT_DISABLE='1';app.setPath('userData',path.join(out,'profile'));app.disableHardwareAcceleration();
const errors=[];app.on('browser-window-created',(_,w)=>{w.show=()=>{};w.showInactive=()=>{};w.webContents.setBackgroundThrottling(false);w.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});});
const pause=ms=>new Promise(r=>setTimeout(r,ms));async function wait(fn,label){for(let i=0;i<240;i++){if(await fn())return;await pause(50);}throw Error(label);}const check=(v,label)=>{if(!v)throw Error(label);console.log('PASS '+label);};
void(async()=>{try{
 await import(pathToFileURL(path.join(root,'desktop/main.js')));await wait(()=>BrowserWindow.getAllWindows().length,'main');const main=BrowserWindow.getAllWindows()[0];await wait(()=>main.webContents.executeJavaScript('Boolean(window.cupboxReady)').catch(()=>false),'main ready');await main.webContents.executeJavaScript('cupbox.qqOpen()');let bot;await wait(()=>{bot=BrowserWindow.getAllWindows().find(w=>w!==main&&w.webContents.getURL().includes('qq-bot.html'));return bot&&!bot.webContents.isLoading();},'bot');const js=s=>bot.webContents.executeJavaScript(s);await wait(()=>js('Boolean(window.qqBotReady)').catch(()=>false),'bot ready');
 await js(`document.querySelector('[data-tab=memory]').click();BotMemoryUI.refresh();true`);await wait(()=>js(`document.getElementById('memory-notes').value.includes('乌龙茶')`),'memory loaded');
 check(await js(`!document.querySelector('[data-setting=memoryAutoOrganize]').checked`),'local organization defaults off');
 await js(`BotSections.reveal(document.getElementById('memory-evidence-preview'));document.getElementById('memory-evidence-preview').click();true`);await wait(()=>js(`!document.getElementById('memory-evidence-apply').disabled`),'evidence actual IPC preview');
 check(await readFile(file,'utf8')===original,'preview does not write memory');check(await js(`document.getElementById('memory-evidence-result').textContent.includes('我喜欢乌龙茶')`),'preview displays literal evidence');
 await js(`document.getElementById('memory-evidence-preview').closest('article').scrollIntoView({block:'start',behavior:'instant'});true`);await pause(350);await writeFile(path.join(out,'memory-preview.png'),(await bot.webContents.capturePage()).toPNG());
 await js(`document.getElementById('memory-evidence-apply').click();true`);await wait(()=>js(`document.getElementById('memory-evidence-result').textContent.includes('已保存：新增 1 条')`),'apply actual IPC');
 const data=JSON.parse(await readFile(file,'utf8'));check(data.facts.length===1&&data.facts[0].sourceId===data.turns[0].evidenceId,'persisted fact has original evidence reference');
 await js(`document.querySelector('[data-setting=memoryAutoOrganize]').checked=true;document.querySelector('[data-setting=memoryAutoOrganize]').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#bot-form').requestSubmit();true`);await wait(()=>js(`document.querySelector('#save-hint').textContent.includes('设置已保存')`),'settings form saved');check(await js(`qqBot.get().then(s=>s.settings.memoryAutoOrganize&&!s.running)`),'opt-in persisted without starting robot');
 await js(`document.querySelector('[data-tab=health]').click();document.getElementById('health-refresh').click();true`);await wait(()=>js(`document.getElementById('health-disk').textContent.includes('GB')`),'real disk result displayed');
 await wait(()=>js(`!document.querySelector('[data-panel=health]').hidden`),'health panel visible');await pause(350);await js(`document.getElementById('health-heading').scrollIntoView({block:'start',behavior:'instant'});true`);await writeFile(path.join(out,'disk-health.png'),(await bot.webContents.capturePage()).toPNG());
 bot.setSize(960,680);for(const page of ['memory','health']){await js(`document.querySelector('[data-tab=${page}]').click();true`);check(await js(`document.querySelector('.bot-main').scrollWidth<=document.querySelector('.bot-main').clientWidth+1`),page+' no horizontal overflow');}
 check(errors.length===0,'no renderer errors');console.log('OUTPUT '+out);app.exit(0);
 }catch(e){console.error(e.stack||e);console.error(errors);app.exit(1);}})();
