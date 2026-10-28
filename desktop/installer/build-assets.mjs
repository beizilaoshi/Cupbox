// Compose the established Cupbox artwork and editable vector identity for the wizard.
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.resolve(here, '../ui/assets');
await mkdir(path.join(here, 'assets'), { recursive:true });
const w=656,h=1256;
for (const dark of [false,true]) {
  const overlay=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><linearGradient id="wash" x2="0" y2="1"><stop stop-color="${dark?'#111b32':'#f6f3ff'}" stop-opacity=".96"/><stop offset=".4" stop-color="${dark?'#19243b':'#f6f3ff'}" stop-opacity=".22"/><stop offset=".8" stop-color="${dark?'#101b30':'#e8edff'}" stop-opacity=".30"/><stop offset="1" stop-color="${dark?'#0d162b':'#e8edff'}" stop-opacity=".98"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#wash)"/>
  <text x="60" y="245" font-family="Segoe UI, sans-serif" font-weight="600" font-size="60" fill="${dark?'#eff2ff':'#283453'}">Cupbox</text>
  <rect x="62" y="280" width="78" height="4" rx="2" fill="${dark?'#baafff':'#8372cf'}"/>
  <text x="60" y="1140" font-family="Segoe UI, sans-serif" font-size="21" letter-spacing="5" fill="${dark?'#d2d8ef':'#536181'}">A LITTLE SPACE.</text>
  <text x="60" y="1178" font-family="Segoe UI, sans-serif" font-size="21" letter-spacing="5" fill="${dark?'#d2d8ef':'#536181'}">FOR BIG IDEAS.</text>
  </svg>`);
  const logo=await sharp(await readFile(path.join(assets,'cupbox-logo.svg'))).resize(116,116).png().toBuffer();
  await sharp(path.join(assets,'startup-atelier.png')).resize(w,h,{fit:'cover',position:sharp.strategy.attention})
    .modulate({brightness:dark?.60:1,saturation:dark?.75:.85})
    .composite([{input:overlay},{input:logo,left:58,top:60}]).png()
    .toFile(path.join(here,'assets',dark?'wizard-dark.png':'wizard-light.png'));
}
await sharp(path.join(assets,'cupbox-logo.svg')).resize(128,128).png().toFile(path.join(here,'assets','wizard-logo.png'));
// Compose existing original artwork; retain transparent mascot masters unchanged.
const destination=path.join(here,'assets');
for(const [name,mascot] of [['chat','mascot-wave'],['tools','mascot-academy'],['style','mascot-spring'],['banner-tools','mascot-academy'],['banner-style','mascot-spring']]){
  const banner=name.startsWith('banner-'),width=banner?1920:1440,height=360;
  const wash=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g"><stop stop-color="#f4f5ff" stop-opacity=".95"/><stop offset="1" stop-color="#fff1f8" stop-opacity=".68"/></linearGradient></defs><rect width="100%" height="100%" rx="32" fill="url(#g)"/><circle cx="${width-220}" cy="160" r="156" fill="white" fill-opacity=".8"/><g opacity=".35"><path d="M80 230Q330 30 650 210" fill="none" stroke="#a9b7e8" stroke-width="2" stroke-dasharray="4 12"/><circle cx="150" cy="160" r="42" fill="#cbd5f5"/><circle cx="300" cy="125" r="26" fill="#efd3e6"/><circle cx="450" cy="160" r="14" fill="#b9d5e6"/></g></svg>`);
  const character=await sharp(path.join(assets,'logos',mascot+'.png')).resize(330,330,{fit:'contain'}).png().toBuffer();
  await sharp({create:{width,height,channels:4,background:'#f7f8ff'}}).composite([{input:wash},{input:character,left:width-360,top:15}]).png().toFile(path.join(destination,(banner?'':'feature-')+name+'.png'));
}
const hero=await sharp(path.join(assets,'logos','mascot-snuggle.png')).resize(580,580,{fit:'contain'}).png().toBuffer();
const wash=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="656" height="1256"><defs><linearGradient id="a" x2="0" y2="1"><stop stop-color="#eef1ff" stop-opacity=".70"/><stop offset="1" stop-color="#fbeaf5" stop-opacity=".88"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#a)"/><circle cx="328" cy="640" r="295" fill="white" fill-opacity=".86"/></svg>');
await sharp(path.join(assets,'startup-atelier.png')).resize(656,1256,{fit:'cover'}).composite([{input:wash},{input:hero,left:38,top:352}]).png().toFile(path.join(destination,'uninstall-hero.png'));
console.log('Installer artwork ready (welcome, interactive feature cards and uninstall companion).');

// Code-native UI artwork: high-DPI rounded controls with explicit focus/hover states.
const svgPng=async(name,svg)=>sharp(Buffer.from(svg)).png().toFile(path.join(destination,name+'.png'));
const mix=(a,b,t)=>'#'+[0,2,4].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
const actions={next:'下一步  →',start:'开始设置  →',install:'开始安装',update:'更新并保留数据',back:'←  上一步',cancel:'取消',finish:'完成',leave:'先留下来',continue:'继续安装',exit:'退出安装',remove:'确认卸载',folder:'查看数据目录  ↗'};
for(const [id,text] of Object.entries(actions))for(let frame=0;frame<=4;frame++){
 const primary=['next','start','install','update','finish'].includes(id),danger=['exit','remove'].includes(id),t=frame/4;
 const a=primary?mix('7889d6','6273c2',t):danger?mix('fff1f4','fbdce4',t):mix('ffffff','edf0fb',t);
 const b=primary?mix('a48ddd','8e73cf',t):a,ink=primary?'#fff':danger?'#a23f5a':'#53617d',font=primary||id==='folder'?44:danger?48:56;
 await svgPng('skin-'+id+'-'+frame,`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="168"><defs><linearGradient id="b"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect x="5" y="5" width="590" height="154" rx="40" fill="url(#b)" stroke="${primary?'#ffffff66':danger?'#edc5d1':'#dfe4f2'}" stroke-width="3"/><text x="300" y="${font>50?104:100}" text-anchor="middle" font-family="Microsoft YaHei UI, sans-serif" font-size="${font}" font-weight="${primary?600:500}" fill="${ink}">${text}</text></svg>`);
}
for(const [index,title,sub,icon]of [[0,'对话与灵感','从一句话开始','M58 55h62v44H88l-18 15V99H58Z'],[1,'工具与协作','把任务交给工具','m61 88 23-23 17 17 21-21M109 61h13v13'],[2,'主题与陪伴','布置你的日常','m90 56 10 22 24 4-18 18 4 24-20-11-20 11 4-24-18-18 24-4Z']])for(const selected of [false,true]){
 await svgPng('skin-card-'+index+(selected?'-selected':''),`<svg xmlns="http://www.w3.org/2000/svg" width="540" height="480"><defs><linearGradient id="c" x2="1" y2="1"><stop stop-color="${selected?'#edf0ff':'#ffffff'}"/><stop offset="1" stop-color="${selected?'#f3edff':'#fcfcff'}"/></linearGradient></defs><rect x="6" y="6" width="528" height="468" rx="52" fill="url(#c)" stroke="${selected?'#a49bd6':'#e5e8f2'}" stroke-width="4"/><g transform="translate(130 25) scale(1.5)" stroke="${selected?'#8376ba':'#92a0c2'}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="${icon}"/></g><text x="270" y="298" text-anchor="middle" font-family="Microsoft YaHei UI, sans-serif" font-size="47" font-weight="600" fill="#465570">${title}</text><text x="270" y="365" text-anchor="middle" font-family="Microsoft YaHei UI, sans-serif" font-size="34" fill="#8b94aa">${sub}</text>${selected?'<circle cx="467" cy="65" r="20" fill="#9185cb"/><path d="m458 65 6 6 12-13" fill="none" stroke="white" stroke-width="4"/>':''}</svg>`);
}
await svgPng('skin-data',`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="400"><defs><linearGradient id="c"><stop stop-color="#f0f4ff"/><stop offset="1" stop-color="#faf4fd"/></linearGradient></defs><rect x="4" y="4" width="1592" height="392" rx="48" fill="url(#c)" stroke="#e3e5f2" stroke-width="3"/><g transform="translate(52 62)" fill="none" stroke="#9ca6ca" stroke-width="9" stroke-linejoin="round"><path d="m0 20 55-20 55 20v52c0 48-55 73-55 73S0 120 0 72Z"/><path d="m29 69 19 19 36-40"/></g></svg>`);
const portrait=await sharp(path.join(assets,'logos','mascot-sakura.png')).resize(570,570,{fit:'contain'}).png().toBuffer();
const glass=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="656" height="1256"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="#edf0ff" stop-opacity=".8"/><stop offset="1" stop-color="#faedf5" stop-opacity=".6"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><rect x="38" y="38" width="580" height="1180" rx="58" fill="white" fill-opacity=".58" stroke="white" stroke-opacity=".8" stroke-width="3"/><text x="88" y="160" font-family="Segoe UI,sans-serif" font-size="61" font-weight="600" fill="#566287">Cupbox</text><text x="90" y="221" font-family="Microsoft YaHei UI,sans-serif" font-size="28" fill="#8991ab">让灵感，有处安放。</text><circle cx="328" cy="710" r="266" fill="white" fill-opacity=".76"/><text x="90" y="1110" font-family="Segoe UI,sans-serif" font-size="22" letter-spacing="4" fill="#8f96b0">YOUR EVERYDAY</text><text x="90" y="1155" font-family="Segoe UI,sans-serif" font-size="22" letter-spacing="4" fill="#8f96b0">CREATIVE COMPANION.</text></svg>`);
await sharp(path.join(assets,'startup-atelier.png')).resize(656,1256,{fit:'cover'}).composite([{input:glass},{input:portrait,left:43,top:430}]).png().toFile(path.join(destination,'wizard-light.png'));
console.log('Rounded UI kit ready (animated button states, accessible feature cards and data panel).');
// A shared compact farewell layout, including a real-progress track (no timer progress).
for(const active of [0,1,2]){
 const labels=['确认卸载','移除程序','完成'];
 await svgPng('skin-uninstall-'+['confirm','progress','done'][active],`<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="100">${labels.map((label,i)=>`<circle cx="${30+i*515}" cy="48" r="23" fill="${i===active?'#9584cd':i<active?'#ccd3eb':'#edf0f7'}"/><text x="${30+i*515}" y="58" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="29" fill="${i===active?'white':'#929db9'}">${i+1}</text><text x="${74+i*515}" y="61" font-family="Microsoft YaHei UI,sans-serif" font-size="35" fill="${i===active?'#657195':'#a3acc0'}">${label}</text>${i<2?`<path d="M${285+i*515} 49h170" stroke="#e0e4f0" stroke-width="3"/>`:''}`).join('')}</svg>`);
}
await svgPng('skin-progress-card','<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="400"><rect x="4" y="4" width="1592" height="392" rx="48" fill="#ffffff" stroke="#e1e5f1" stroke-width="3"/></svg>');
await svgPng('skin-progress-track','<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="44"><rect width="1600" height="44" rx="22" fill="#eceef8"/></svg>');
await svgPng('skin-progress-fill','<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="44"><defs><linearGradient id="g"><stop stop-color="#8b9bdb"/><stop offset="1" stop-color="#b59adb"/></linearGradient></defs><rect width="1600" height="44" rx="22" fill="url(#g)"/></svg>');
const farewellGlass=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="656" height="1256"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="#eef0ff" stop-opacity=".82"/><stop offset="1" stop-color="#f7e9f3" stop-opacity=".7"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><rect x="38" y="38" width="580" height="1180" rx="58" fill="white" fill-opacity=".58" stroke="white" stroke-width="3"/><text x="85" y="157" font-family="Segoe UI,sans-serif" font-size="60" fill="#697296">Cupbox</text><text x="88" y="222" font-family="Microsoft YaHei UI,sans-serif" font-size="27" fill="#969bb5">暂别一下，创作还在。</text><circle cx="328" cy="683" r="275" fill="white" fill-opacity=".7"/><text x="88" y="1110" font-family="Microsoft YaHei UI,sans-serif" font-size="27" fill="#969bb5">筑梦喵，期待下次见。</text></svg>');
await sharp(path.join(assets,'startup-atelier.png')).resize(656,1256,{fit:'cover'}).composite([{input:farewellGlass},{input:hero,left:38,top:380}]).png().toFile(path.join(destination,'uninstall-hero.png'));
