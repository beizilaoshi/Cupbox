// Adapted from node-portscanner checkPortStatus, MIT. See vendor/ NOTICE/LICENSE.
import {Socket} from 'node:net';
export const HOST='127.0.0.1';
export function portNumber(port){if(typeof port!=='number'||!Number.isInteger(port)||port<1||port>65535)throw Error('端口必须为1～65535的整数');return port;}
export function checkLoopbackPort(port,{signal}={}){
  portNumber(port);signal?.throwIfAborted();
  return new Promise((resolve,reject)=>{const socket=new Socket();let status='closed',code='CLOSED';const abort=()=>socket.destroy(Object.assign(Error('检查已取消'),{code:'ABORTED'}));signal?.addEventListener('abort',abort,{once:true});
    socket.on('connect',()=>{if(socket.remoteAddress!==HOST){code='TARGET_BLOCKED';socket.destroy();return;}status='open';code='OPEN';socket.destroy();});socket.setTimeout(400);socket.on('timeout',()=>{code='TIMEOUT';socket.destroy();});socket.on('error',error=>{code=error.code==='ECONNREFUSED'?'CLOSED':error.code==='ABORTED'?'ABORTED':'CONNECTION_ERROR';});socket.on('close',()=>{signal?.removeEventListener('abort',abort);if(signal?.aborted)reject(signal.reason||Error('检查已取消'));else resolve({host:HOST,port,status,code});});socket.connect({host:HOST,port,family:4});
  });
}
