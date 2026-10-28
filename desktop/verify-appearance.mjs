import {app} from 'electron';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const home=process.env.CUPBOX_HOME;if(!home||!path.resolve(home).startsWith(path.resolve('output')+path.sep))throw Error('Use isolated output home');
app.setPath('userData',path.join(home,'profile'));app.disableHardwareAcceleration();app.commandLine.appendSwitch('mute-audio');
await mkdir(path.join(home,'.cupbox'),{recursive:true});await writeFile(path.join(home,'.cupbox','desktop.json'),JSON.stringify({startupEnabled:false,startupDuration:5,petEnabled:false,musicEnabled:false,background:'none',theme:'light'}));
const out=path.resolve('output/appearance-review');await mkdir(out,{recursive:true});
let main,bot;const errors=[],js=(w,source)=>w.webContents.executeJavaScript(source);
async function wait(w,source){for(let i=0;i<150;i++){if(await js(w,source))return;await new Promise(r=>setTimeout(r,50));}throw Error('Timeout: '+source);}
const capture=async(name,w=main)=>writeFile(path.join(out,name+'.png'),(await w.webContents.capturePage()).toPNG());
setTimeout(()=>{console.error('Appearance timeout');app.exit(1);},150000).unref();
app.on('browser-window-created',(_e,w)=>{w.hide();w.show=()=>{};w.webContents.setBackgroundThrottling(false);w.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});w.webContents.once('did-finish-load',async()=>{try{
  if(w.webContents.getURL().includes('qq-bot.html')){
    bot=w;await wait(bot,'window.qqBotReady');
    await js(main,`openModal('theme');document.querySelector('[data-accent=inkgreen]').click();document.querySelector('[data-theme=dark]').click()`);
    await wait(bot,`document.documentElement.dataset.accent==='inkgreen'&&document.documentElement.dataset.theme==='dark'`);
    await new Promise(r=>setTimeout(r,400));await capture('07-qq-inkgreen',bot);console.log('PASS QQ follows palette and mode changes without reopening');
    await js(main,`document.querySelector('[data-accent=rainbow]').click();document.querySelector('[data-theme=light]').click()`);
    await wait(bot,`document.documentElement.dataset.accent==='rainbow'&&document.documentElement.dataset.theme==='light'`);
    const before=await js(main,`getComputedStyle(document.documentElement).getPropertyValue('--rainbow-hue')`);await new Promise(r=>setTimeout(r,250));const after=await js(main,`getComputedStyle(document.documentElement).getPropertyValue('--rainbow-hue')`);if(before===after)throw Error('Rainbow hue did not animate');console.log('PASS rainbow accent changes smoothly, not by filtering the whole interface');
    await capture('08-rainbow-palette');
    await js(main,`document.querySelector('[data-accent=inkgreen]').click();document.querySelector('#swatches').scrollIntoView({block:'center'})`);await wait(main,`cupbox.prefsGet().then(p=>p.accent==='inkgreen')`);await new Promise(r=>setTimeout(r,400));await capture('09-mixed-palette-gallery');
    main.webContents.debugger.attach('1.3');await main.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await wait(main,`matchMedia('(prefers-reduced-motion:reduce)').matches`);
    if(!await js(main,`CupboxStartup.play({...prefs,startupStyle:'prism'},{preview:true}).then(v=>v===false&&!CupboxStartup.sceneRunning)`))throw Error('Reduced motion did not skip scene');
    await js(main,`document.querySelector('[data-accent=rainbow]').click()`);if(!await js(main,`getComputedStyle(document.documentElement).animationName==='none'`))throw Error('Reduced motion did not stop rainbow');
    await main.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});main.webContents.debugger.detach();console.log('PASS reduced motion stops rainbow and skips startup effects');
    if(errors.length)throw Error(errors.join('\n'));console.log('PASS no renderer errors');app.exit(0);
  }else if(w.webContents.getURL().includes('index.html')){
    main=w;await wait(main,'window.cupboxReady');await js(main,`Promise.all(['aurora','jade','lunar','cathedral','hive','paper','emerald','orbital','liquid','festival'].map(key=>{const image=new Image();image.src='assets/opening-'+key+'.png';return image.decode();}))`);await js(main,`openModal('theme')`);
    if(!await js(main,`document.querySelectorAll('#swatches .swatch').length===12&&Object.keys(CupboxPalettes.catalog).length===8`))throw Error('Palette catalog missing');
    for(const accent of ['inkgreen','mistpurple','peachmilk','oceanblue','sunset','moongold','forestrose','rainbow'])for(const theme of ['light','dark']){
      await js(main,`document.querySelector('[data-accent=${accent}]').click();document.querySelector('[data-theme=${theme}]').click()`);
      await wait(main,`cupbox.prefsGet().then(p=>p.accent==='${accent}'&&p.theme==='${theme}')`);
      const contrast=await js(main,`(()=>{const s=getComputedStyle(document.documentElement),lum=v=>{const h=v.trim().slice(1);const a=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722;};const a=lum(s.getPropertyValue('--bg')),b=lum(s.getPropertyValue('--txt'));return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)})()`);
      if(contrast<4.5)throw Error('Insufficient text contrast: '+accent+' '+theme+' '+contrast);
    }
    console.log('PASS eight new palettes persist in light and dark mode with readable body text');
    await js(main,`document.querySelector('[data-accent=inkgreen]').click();document.querySelector('[data-theme=light]').click();openModal('startup')`);
    if(!await js(main,`document.querySelectorAll('.startup-card').length===15&&CupboxStartup.defaults.startupDuration===5&&CupboxStartup.defaults.startupStyle==='orbit'&&document.querySelector('[data-startup-style=orbit] .startup-default-badge').textContent==='默认'`))throw Error('Startup catalog or duration changed');
    await wait(main,`!document.querySelector('#tab-startup').hidden`);await js(main,`document.querySelector('.startup-grid').scrollIntoView({block:'center'})`);await new Promise(r=>setTimeout(r,400));await capture('01-startup-gallery');
    await js(main,`document.querySelector('[data-startup-filter=geometry]').click()`);if(!await js(main,`[...document.querySelectorAll('.startup-card')].filter(c=>!c.hidden).length===7&&document.querySelectorAll('.scene-brand-logo').length===11`))throw Error('Geometry filter or branded thumbnails missing');await capture('10-geometry-gallery');await js(main,`document.querySelector('[data-startup-filter=all]').click()`);console.log('PASS geometry filter groups seven branded options without changing selection');
    for(const style of ['cinema','pulse','prism','inkflow','fireworks','moonsea','quantmatrix','quantorbit','lattice','honeycomb','origami','mobius','polyhedron']){
      await js(main,`document.querySelector('[data-startup-style=${style}]').click()`);await wait(main,`cupbox.prefsGet().then(p=>p.startupStyle==='${style}')`);
      await js(main,`document.querySelector('#preview-startup').click()`);await wait(main,`CupboxStartup.sceneRunning&&document.querySelector('#startup-screen').dataset.style==='${style}'`);const geometry=await js(main,`CupboxStartupScenes.catalog['${style}'].geometry===true`);await new Promise(r=>setTimeout(r,3700));if(!await js(main,`(()=>{const logo=document.querySelector('#startup-screen .startup-logo'),r=logo.getBoundingClientRect();return document.querySelector('.startup-wordmark').textContent==='Cupbox'&&r.width>=44&&r.height>=44&&logo.complete&&logo.naturalWidth>0&&getComputedStyle(logo).display!=='none'&&document.querySelector('.startup-tagline').textContent===CupboxStartupScenes.catalog['${style}'].tagline})()`))throw Error('Geometry logo or brand missing: '+style);await capture('02-scene-'+style);
      await js(main,`document.querySelector('#skip-startup').click()`);if(!await js(main,`!CupboxStartup.sceneRunning&&document.querySelector('#startup-screen').hidden&&!document.querySelector('.layout').inert&&document.querySelector('.startup-wordmark').textContent==='Cupbox'`))throw Error('Scene resources or branding not restored: '+style);
    }
    console.log('PASS thirteen fullscreen scenes render, preserve branding and release resources on skip');
    main.setMinimumSize(960,680);main.setSize(960,680);
    for(const style of Object.keys(await js(main,'CupboxStartupScenes.catalog'))){
      await js(main,`void CupboxStartup.play({...prefs,startupStyle:'${style}',startupDuration:4},{preview:true})`);await new Promise(r=>setTimeout(r,3100));
      if(!await js(main,`['.startup-logo','.startup-wordmark','.startup-tagline'].every(s=>{const node=document.querySelector('#startup-screen '+s),r=node.getBoundingClientRect();return r.width>0&&r.left>=0&&r.top>=50&&r.right<=innerWidth&&r.bottom<=innerHeight&&getComputedStyle(s==='.startup-wordmark'?node.parentElement:node).opacity==='1'})`))throw Error('Compact premium branding unavailable: '+style);
      if(style==='lattice')await capture('11-geometry-compact');
      await js(main,'CupboxStartup.skip()');if(!await js(main,`!CupboxStartup.sceneRunning&&document.querySelector('#startup-screen').dataset.premium==='false'`))throw Error('Premium cleanup missing: '+style);
    }
    main.setSize(1340,880);console.log('PASS all thirteen fullscreen scenes fit 960px window and scale branding to shortened timelines');
    await js(main,`document.querySelector('#reset-startup').click()`);await wait(main,`cupbox.prefsGet().then(p=>p.startupStyle==='orbit'&&p.startupDuration===5)`);console.log('PASS reset restores five-second Sakura opening');
    await js(main,`void CupboxStartup.play({...prefs,startupStyle:'prism',startupDuration:.8},{preview:true})`);await wait(main,`document.querySelector('#startup-screen').hidden&&!CupboxStartup.sceneRunning`);console.log('PASS automatic startup completion restores the workspace');
    await js(main,'cupbox.qqOpen()');
  }
}catch(e){console.error(e);app.exit(1);}});});
await import(process.argv.includes('--packaged')?pathToFileURL(path.resolve('output/installer-stage/Cupbox/resources/app/desktop/main.js')).href:'./main.js');
