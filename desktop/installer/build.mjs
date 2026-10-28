// Build from a fresh isolated staging tree; preserve existing portable releases.
import { spawn } from 'node:child_process';
import { access, open, readFile, writeFile, cp } from 'node:fs/promises';
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
await run(iscc,[`/DAppVersion=${pkg.version}`,`/DPayloadRoot=${path.join(root,'output/installer-stage/Cupbox')}`,path.join(here,'cupbox.iss')]);
const name=`Cupbox-Setup-${pkg.version}-x64.exe`,file=path.join(root,'release',name);
const hash=createHash('sha256').update(await readFile(file)).digest('hex');
await writeFile(file+'.sha256',`${hash}  ${name}\n`);
// Keep the visible portable application in sync with the installer payload.
// Merge only packaged application files; never clear release or user data.
const portableArg=process.argv.find(arg=>arg.startsWith('--portable-out='));
const skipPortableSync=process.argv.includes('--skip-portable-sync');
const portableDir=path.resolve(root,portableArg?portableArg.slice('--portable-out='.length):'release/Cupbox可视化');
const relative=path.relative(path.join(root,'release'),portableDir);
if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Portable output must be a subdirectory of release.');
if(!skipPortableSync){
  // Windows image locks deny writes to a running app; avoid a half-copied portable tree.
  const portableExe=path.join(portableDir,'Cupbox可视化.exe');
  let portableBusy=false;
  try{const handle=await open(portableExe,'r+');await handle.close();}
  catch(error){portableBusy=['EPERM','EBUSY','EACCES'].includes(error?.code);}
  if(portableBusy){
    console.warn('Portable copy is running; skipped sync to '+portableDir+'. Quit Cupbox, then copy output/installer-stage/Cupbox over it (or re-run npm run pack:installer). The installer itself is complete.');
  }else{
    await cp(path.join(root,'output/installer-stage/Cupbox'),portableDir,{recursive:true,force:true});
    console.log('Portable application synced: '+portableExe);
  }
}
else console.log('Portable executable sync skipped; the installer was built from the complete isolated staging tree.');
console.log(`Installer ready: ${file}\nSHA256: ${hash}`);
