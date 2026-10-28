import {statfs} from 'node:fs/promises';
import path from 'node:path';

export async function readDiskUsage(directory){
  let current=path.resolve(directory);
  for(;;){
    try{
      const row=await statfs(current),total=Number(row.blocks)*Number(row.bsize),available=Number(row.bavail)*Number(row.bsize);
      if(!Number.isFinite(total)||total<=0||!Number.isFinite(available)||available<0)throw Error('DISK_STATS_INVALID');
      return{totalBytes:total,availableBytes:available,usedPercent:Math.max(0,Math.min(100,100*(1-available/total))),checkedAt:Date.now()};
    }catch(e){const parent=path.dirname(current);if(e.code!=='ENOENT'||parent===current)throw e;current=parent;}
  }
}
