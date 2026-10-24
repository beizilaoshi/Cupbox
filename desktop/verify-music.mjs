import {app,BrowserWindow,dialog} from 'electron';
import {SYSTEM_MUSIC} from './music-library.js';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const home=process.env.CUPBOX_HOME;if(!home||!path.resolve(home).startsWith(path.resolve('output')+path.sep))throw Error('Use isolated output home');
app.setPath('userData',path.join(home,'profile'));app.disableHardwareAcceleration();app.commandLine.appendSwitch('mute-audio');
await mkdir(path.join(home,'.cupbox'),{recursive:true});await writeFile(path.join(home,'.cupbox','desktop.json'),JSON.stringify({startupEnabled:false,petEnabled:false,musicEnabled:true}));
const out=path.resolve('output/music-review');await mkdir(out,{recursive:true});
const errors=[];let main,bot,mainTested=false;
const fixture=path.join(out,'my-test-song.wav');
const wave=Buffer.alloc(44+22050*2);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(22050,24);wave.writeUInt32LE(44100,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(wave.length-44,40);for(let i=0;i<22050;i++)wave.writeInt16LE(Math.round(Math.sin(i*440/22050*Math.PI*2)*1000),44+i*2);await writeFile(fixture,wave);
dialog.showOpenDialog=async()=>({canceled:false,filePaths:[fixture]});
const js=(win,source)=>win.webContents.executeJavaScript(source);
async function wait(win,source){for(let i=0;i<160;i++){if(await js(win,source))return;await new Promise(r=>setTimeout(r,50));}throw Error('Timeout: '+source);}
setTimeout(()=>{console.error('Music UI timeout');app.exit(1);},70000).unref();
app.on('browser-window-created',(_e,win)=>{win.hide();win.show=()=>{};win.webContents.setBackgroundThrottling(false);win.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});win.webContents.once('did-finish-load',async()=>{try{
  if(win.webContents.getURL().includes('qq-bot.html')){
    bot=win;await wait(bot,'window.qqBotReady&&CupboxMusic.state?.playing');
    if(await js(bot,'CupboxMusic.audio!==null'))throw Error('QQ created a duplicate player');
    await js(bot,`document.querySelector('#music-control').click()`);await wait(main,'!CupboxMusic.state.enabled&&CupboxMusic.audio.paused');await wait(bot,'!CupboxMusic.state.playing');
    if(!await js(main,`getComputedStyle(document.querySelector('.music-vinyl')).animationPlayState==='paused'&&!document.querySelector('#music-control').classList.contains('is-playing')`))throw Error('Paused animation not stopped');
    const saved=JSON.parse(await readFile(path.join(home,'.cupbox','desktop.json'),'utf8'));if(saved.musicEnabled!==false)throw Error('Pause not persisted');
    console.log('PASS QQ pauses the shared player, stops animation and persists the choice');
    const loaded=new Promise(resolve=>main.webContents.once('did-finish-load',resolve));main.webContents.reload();await loaded;await wait(main,'window.cupboxReady&&window.CupboxMusic?.state?.enabled===false');if(!await js(main,'CupboxMusic.audio.paused'))throw Error('Reload ignored saved pause');console.log('PASS renderer reload respects saved pause');
    await js(bot,`document.querySelector('#music-control').click()`);await wait(main,'CupboxMusic.state.playing&&!CupboxMusic.audio.paused');await wait(bot,'CupboxMusic.state.playing');
    await writeFile(path.join(out,'02-qq-music.png'),(await bot.webContents.capturePage()).toPNG());
    console.log('PASS QQ resumes the one player and both window controls agree');
    if(errors.length)throw Error(errors.join('\n'));console.log('PASS no renderer errors');app.exit(0);
  }else if(win.webContents.getURL().includes('index.html')){
    if(mainTested)return;mainTested=true;
    main=win;await wait(main,'window.cupboxReady&&window.CupboxMusic?.state?.playing&&CupboxMusic.audio.currentTime>0');
    if(!await js(main,`CupboxMusic.audio.loop&&getComputedStyle(document.querySelector('.music-vinyl')).animationPlayState==='running'&&document.querySelector('.music-notes').getAttribute('aria-hidden')==='true'`))throw Error('Music visuals or loop missing');
    await writeFile(path.join(out,'01-main-music.png'),(await main.webContents.capturePage()).toPNG());
    console.log('PASS supplied MP3 decodes and auto plays with rotating vinyl and decorative notes');
    await js(main,`document.querySelector('#music-settings-open').click()`);await wait(main,`!document.querySelector('#tab-music').hidden&&document.querySelectorAll('.music-track').length===${SYSTEM_MUSIC.length}`);
    if(!await js(main,`document.querySelectorAll('.music-track .music-remove').length===0&&document.querySelectorAll('.music-system-label').length===${SYSTEM_MUSIC.length}`))throw Error('System music exposes delete');
    for(const id of SYSTEM_MUSIC.slice(1).map(t=>t.id)){
      await js(main,`document.querySelector('[data-track-id="${id}"] .music-track-play').click()`);await wait(main,`CupboxMusic.state.currentId==='${id}'&&CupboxMusic.state.playing&&CupboxMusic.audio.currentTime>0`);
    }
    console.log('PASS all eight supplied songs decode; settings selects songs and protects system entries');
    await js(main,`document.querySelector('#music-mode').value='sequence';document.querySelector('#music-mode').dispatchEvent(new Event('change'))`);await wait(main,`CupboxMusic.state.mode==='sequence'&&!CupboxMusic.audio.loop`);
    await js(main,`cupbox.musicCommand({action:'select',id:'petal-drift'})`);await wait(main,`CupboxMusic.state.currentId==='petal-drift'&&CupboxMusic.state.playing`);
    await js(main,`(()=>{const c=document.querySelector('[data-track-id="where-the-light-rests"] input');c.checked=false;c.dispatchEvent(new Event('change',{bubbles:true}));})()`);await wait(main,`CupboxMusic.state.tracks.find(t=>t.id==='where-the-light-rests').disabled`);
    await js(main,`CupboxMusic.audio.dispatchEvent(new Event('ended'))`);await wait(main,`CupboxMusic.state.currentId==='morning-sync'&&CupboxMusic.state.playing`);
    await js(main,`document.querySelector('#music-mode').value='random';document.querySelector('#music-mode').dispatchEvent(new Event('change'))`);await wait(main,`CupboxMusic.state.mode==='random'`);
    await js(main,`CupboxMusic.audio.dispatchEvent(new Event('ended'))`);await wait(main,`CupboxMusic.state.currentId!=='morning-sync'&&CupboxMusic.state.currentId!=='where-the-light-rests'&&CupboxMusic.state.playing`);
    for(const id of SYSTEM_MUSIC.filter(t=>t.id!=='where-the-light-rests').map(t=>t.id))await js(main,`cupbox.musicCommand({action:'disable',id:'${id}',disabled:true})`);
    await wait(main,`CupboxMusic.state.currentId===null&&CupboxMusic.audio.paused&&!CupboxMusic.state.error`);
    await js(main,`cupbox.musicCommand({action:'disable',id:'petal-drift',disabled:false})`);await js(main,`cupbox.musicCommand({action:'mode',mode:'single'})`);await wait(main,`CupboxMusic.state.playing&&CupboxMusic.audio.loop`);
    console.log('PASS sequence and random advance automatically, skip disabled songs and recover from an empty queue');
    await js(main,`document.querySelector('#music-import').click()`);await wait(main,`CupboxMusic.state.tracks.length===${SYSTEM_MUSIC.length+1}`);
    const custom=await js(main,`CupboxMusic.state.tracks.find(t=>!t.system).id`);
    await js(main,`document.querySelector('[data-track-id="${custom}"] .music-track-play').click()`);await wait(main,`CupboxMusic.state.currentId==='${custom}'&&CupboxMusic.state.playing&&CupboxMusic.audio.currentTime>0`);
    await js(main,`document.querySelector('[data-track-id="${custom}"] .music-remove').click()`);await wait(main,`document.querySelector('#app-risk-dialog').open`);await js(main,`document.querySelector('#app-risk-buttons [data-response="0"]').click()`);await wait(main,`!document.querySelector('#music-import').disabled`);if(!await js(main,`CupboxMusic.state.tracks.length===${SYSTEM_MUSIC.length+1}`))throw Error('Cancel deleted track');
    await js(main,`document.querySelector('[data-track-id="${custom}"] .music-remove').click()`);await wait(main,`document.querySelector('#app-risk-dialog').open`);await js(main,`document.querySelector('#app-risk-buttons [data-response="1"]').click()`);await wait(main,`CupboxMusic.state.tracks.length===${SYSTEM_MUSIC.length}&&CupboxMusic.state.currentId==='petal-drift'&&CupboxMusic.state.playing`);
    await readFile(fixture);console.log('PASS local import decodes, themed delete supports cancellation and preserves source file');
    await js(main,`document.querySelector('#music-volume').value='42';document.querySelector('#music-volume').dispatchEvent(new Event('input'));document.querySelector('#music-volume').dispatchEvent(new Event('change'))`);await wait(main,`CupboxMusic.state.volume===.42&&CupboxMusic.audio.volume===.42`);
    await writeFile(path.join(out,'03-music-settings-light.png'),(await main.webContents.capturePage()).toPNG());
    await js(main,`document.documentElement.dataset.theme='dark'`);await writeFile(path.join(out,'04-music-settings-dark.png'),(await main.webContents.capturePage()).toPNG());await js(main,`document.documentElement.dataset.theme='light';closeModal()`);
    await js(main,'cupbox.qqOpen()');
  }
}catch(e){console.error(e);app.exit(1);}});});
await import(process.env.CUPBOX_MUSIC_REVIEW_APP?pathToFileURL(path.join(process.env.CUPBOX_MUSIC_REVIEW_APP,'desktop/main.js')).href:process.argv.includes('--packaged')?pathToFileURL(path.resolve('output/installer-stage/Cupbox/resources/app/desktop/main.js')).href:'./main.js');
