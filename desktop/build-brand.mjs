// Render the editable SVG identity into native window icon assets.
import { app, BrowserWindow } from 'electron';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
const win = new BrowserWindow({ show:false, webPreferences:{ sandbox:true, contextIsolation:true } });
await win.loadFile(path.resolve('desktop/ui/assets/cupbox-logo.svg'));
const url = await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{
  const img=new Image();img.onload=()=>{const c=document.createElementNS('http://www.w3.org/1999/xhtml','canvas');c.width=256;c.height=256;c.getContext('2d').drawImage(img,0,0,256,256);resolve(c.toDataURL('image/png'))};img.onerror=reject;img.src=location.href;
})`);
const png = Buffer.from(url.split(',')[1], 'base64');
await writeFile('desktop/ui/assets/cupbox-logo.png', png);
const header = Buffer.alloc(22);
header.writeUInt16LE(1,2); header.writeUInt16LE(1,4);
header.writeUInt16LE(1,10); header.writeUInt16LE(32,12);
header.writeUInt32LE(png.length,14); header.writeUInt32LE(22,18);
await writeFile('desktop/ui/assets/cupbox-logo.ico', Buffer.concat([header,png]));
console.log('Rendered SVG → 256px PNG + ICO');
app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
