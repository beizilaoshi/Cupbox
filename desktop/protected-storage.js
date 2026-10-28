import path from 'node:path';
import {realpath} from 'node:fs/promises';
import {inside} from './execution-policy.js';
async function canonical(value){let cursor=path.resolve(value);const tail=[];while(true){try{return path.join(await realpath(cursor),...tail);}catch(error){if(error.code!=='ENOENT')throw error;const parent=path.dirname(cursor);if(parent===cursor)throw error;tail.unshift(path.basename(cursor));cursor=parent;}}}
export async function checkProtectedStorage(target,write,roots){
  for(const value of roots){const root=await canonical(value),file=await canonical(target),sandbox=path.join(root,'sandbox');if(inside(root,file)&&!inside(sandbox,file)||write&&inside(file,root))throw Object.assign(Error('文件工具不能访问应用私有记忆、凭据、权限配置或覆盖其上级目录；请使用本机专用管理界面'),{code:'PROTECTED_STORAGE'});}
}
