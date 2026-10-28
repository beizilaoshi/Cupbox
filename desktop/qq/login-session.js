import path from 'node:path';
import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

// QQ's native session remains in NapCat's private profile. This file contains
// only the previously verified account, never a password or a bearer token.
export class LoginSession {
  constructor(root){this.root=root;this.file=path.join(root,'remembered-login.json');}
  async read(){
    try{const value=JSON.parse(await readFile(this.file,'utf8'));return value.version===1&&typeof value.account==='string'&&/^\d{5,16}$/.test(value.account)?{account:value.account,savedAt:typeof value.savedAt==='string'?value.savedAt:''}:null;}catch{return null;}
  }
  async save(account){
    account=String(account);if(!/^\d{5,16}$/.test(account))throw Error('无效的登录账号');
    await mkdir(this.root,{recursive:true});const temp=this.file+'.'+randomUUID()+'.tmp';
    try{await writeFile(temp,JSON.stringify({version:1,account,savedAt:new Date().toISOString()}),{mode:0o600,flag:'wx'});await rename(temp,this.file);}finally{await unlink(temp).catch(()=>{});}
  }
}
