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
console.log('Installer artwork ready (light / dark, high DPI).');
