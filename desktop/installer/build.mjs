// Build from a fresh isolated staging tree; preserve existing portable releases.
import { spawn } from 'node:child_process';
import { access, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
process.chdir(root);
if(process.platform!=='win32')throw Error('Windows installer must be built on Windows.');
const pkg=JSON.parse(await readFile('package.json','utf8'));
const desktop=JSON.parse(await readFile('desktop/package.json','utf8'));
if(pkg.version!==desktop.version)throw Error('Desktop and root versions differ.');
const candidates=[process.env.ISCC_PATH,path.join(root,'output/installer-tools/InnoSetup/ISCC.exe'),
  'C:/Program Files (x86)/Inno Setup 6/ISCC.exe','C:/Program Files/Inno Setup 6/ISCC.exe',
  path.join(process.env.LOCALAPPDATA||'','Programs/Inno Setup 6/ISCC.exe')].filter(Boolean);
let iscc;for(const candidate of candidates){try{await access(candidate);iscc=candidate;break;}catch{}}
if(!iscc)throw Error('Install Inno Setup 6.7+ from https://jrsoftware.org/isdl.php, or set ISCC_PATH to ISCC.exe.');
async function run(exe,args){await new Promise((resolve,reject)=>{
  const child=spawn(exe,args,{cwd:root,stdio:'inherit',windowsHide:true});
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`${path.basename(exe)} exited ${code}`)));
});}
await run(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.build.json']);
await run(process.execPath,[path.join(here,'build-assets.mjs')]);
await run(process.execPath,['desktop/pack.mjs','--out=output/installer-stage/Cupbox']);
await run(iscc,[`/DAppVersion=${pkg.version}`,path.join(here,'cupbox.iss')]);
const name=`Cupbox-Setup-${pkg.version}-x64.exe`,file=path.join(root,'release',name);
const hash=createHash('sha256').update(await readFile(file)).digest('hex');
await writeFile(file+'.sha256',`${hash}  ${name}\n`);
console.log(`Installer ready: ${file}\nSHA256: ${hash}`);
