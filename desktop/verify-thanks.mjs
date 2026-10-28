import {app,BrowserWindow} from 'electron';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const out=path.resolve('output/thanks-review'),home=path.join(out,'home-'+Date.now());
await mkdir(path.join(home,'.cupbox'),{recursive:true});await writeFile(path.join(home,'.cupbox/desktop.json'),JSON.stringify({startupEnabled:false,petEnabled:false,musicEnabled:false}));
process.env.CUPBOX_HOME=home;process.env.CUPBOX_UPDATE_DISABLE='1';process.env.CUPBOX_ANNOUNCEMENT_DISABLE='1';app.setPath('userData',path.join(home,'profile'));app.disableHardwareAcceleration();
process.on('uncaughtException',e=>{console.error(e);app.exit(1);});process.on('unhandledRejection',e=>{console.error(e);app.exit(1);});
const actualFetch=globalThis.fetch,live=process.argv.includes('--live');let body=await readFile('thanks.json','utf8'),etag='"first"',bad=false,hits=0;
globalThis.fetch=async(url,options)=>{if(String(url).startsWith('https://raw.githubusercontent.com/beizilaoshi/Cupbox/main/thanks.json')){hits++;if(!live){if(bad)throw Error('Fixture offline');if(options.headers['if-none-match']===etag)return new Response(null,{status:304});return new Response(body,{headers:{etag}});}try{return await actualFetch(url,options);}catch(e){console.error('Live GitHub fetch:',e.message,e.cause?.code);throw e;}}return actualFetch(url,options);};
const errors=[];let win;app.on('browser-window-created',(_,w)=>{if(!win)win=w;w.show=()=>{};w.showInactive=()=>{};w.webContents.setBackgroundThrottling(false);w.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});});
const pause=ms=>new Promise(r=>setTimeout(r,ms)),js=s=>win.webContents.executeJavaScript(s),check=(v,label)=>{if(!v)throw Error(label);console.log('PASS '+label);};
async function wait(s){for(let i=0;i<200;i++){try{if(await js(s))return;}catch{}await pause(50);}throw Error('Timeout: '+s);}
setTimeout(()=>{console.error('Thanks UI timeout');app.exit(1);},45000).unref();
await import(process.env.CUPBOX_THANKS_REVIEW_APP?pathToFileURL(path.join(process.env.CUPBOX_THANKS_REVIEW_APP,'desktop/main.js')).href:'./main.js');
void(async()=>{try{
 await app.whenReady();await wait('window.cupboxReady');await js("openModal('about');true");await wait("!document.querySelector('#about-thanks-refresh').disabled");if(live&&!await js("document.querySelectorAll('.about-thanks-entry').length===3")){console.log('Retry after:',await js("document.querySelector('#about-thanks-status').textContent"));await js("document.querySelector('#about-thanks-refresh').click();true");}await wait("document.querySelectorAll('.about-thanks-entry').length===3");
 check(await js("document.querySelector('#about-thanks-list').textContent.includes('杯艺宣（龚震宇）')"),'requested name appears as plain text in acknowledgement cards');
 if(live){const result=await js('cupbox.aboutThanks(true)');check(result.ok&&result.source==='github'&&result.entries[0].text.includes('杯艺宣（龚震宇）'),'packaged app reads the published GitHub file through real IPC');check(await js("document.querySelector('#ver-chip').textContent==='v1.2.0'"),'application remains at version 1.2.0');await js("document.querySelector('#about-thanks-title').scrollIntoView({block:'center'});true");await pause(150);await writeFile(path.join(out,'github-live.png'),(await win.webContents.capturePage()).toPNG());check(errors.length===0,'no renderer errors');app.exit(0);return;}
 await js("document.querySelector('#about-thanks-refresh').click();true");await wait("document.querySelector('#about-thanks-status').textContent.includes('无变化')");check(hits===2,'refresh detects unchanged GitHub file using ETag');
 const changed=JSON.parse(body);changed.entries[0].text+=' · 更新测试';body=JSON.stringify(changed);etag='"second"';
 await js("document.querySelector('#about-thanks-refresh').click();true");await wait("document.querySelector('#about-thanks-list').textContent.includes('更新测试')");check(true,'single file update refreshes the visible list');
 bad=true;await js("document.querySelector('#about-thanks-refresh').click();true");await wait("document.querySelector('#about-thanks-status').textContent.includes('无法读取 GitHub')");check(await js("document.querySelectorAll('.about-thanks-entry').length===0"),'network failure shows an error without displaying local or stale lists');
 await js("document.querySelector('#about-thanks-title').scrollIntoView({block:'center'});true");await pause(150);await writeFile(path.join(out,'thanks.png'),(await win.webContents.capturePage()).toPNG());
 check(errors.length===0,'no renderer errors');app.exit(0);
}catch(e){console.error(e);app.exit(1);}})();
