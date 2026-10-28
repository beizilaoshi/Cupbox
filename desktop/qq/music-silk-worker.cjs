const {parentPort,workerData}=require('node:worker_threads');
const {encode,isSilk}=require('silk-wasm');
void(async()=>{try{const result=await encode(new Uint8Array(workerData.pcm),24000);if(!isSilk(result.data))throw Error('invalid codec output');const data=Uint8Array.from(result.data);parentPort.postMessage({ok:true,data,duration:result.duration},[data.buffer]);}catch{parentPort.postMessage({ok:false});}})();
