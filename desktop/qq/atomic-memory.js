import {rename} from 'node:fs/promises';

// Windows scanners and a concurrent local reader may briefly hold the old file.
// Keep the original intact; retry the same atomic replacement, never unlink it.
export async function replaceMemoryFile(source,target,replace=rename,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
  for(let attempt=0;;attempt++){
    try{return await replace(source,target);}catch(error){
      if(attempt>=4||!['EPERM','EACCES','EBUSY'].includes(error.code))throw error;
      await wait(20*2**attempt);
    }
  }
}
