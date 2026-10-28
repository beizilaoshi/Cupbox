import http from 'node:http';
import {HOST,portNumber} from './port-check.js';
export const PROBE_PATHS=['/','/.git/HEAD','/.env'];
export function strictLoopbackURL(input){
  if(typeof input!=='string'||!/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})(\/[a-zA-Z0-9._~/-]*)?$/.test(input))throw Error('仅接受显式 http://127.0.0.1:端口/路径；不支持域名、别名、代理、凭据或重定向');
  const url=new URL(input);portNumber(Number(url.port||80));if(url.hostname!==HOST||url.username||url.password||url.search||url.hash)throw Error('目标必须严格为127.0.0.1');return url;
}
export function pinnedRequest({port,path='/',method='HEAD',body,headers={},maxBytes=16384,timeout=2000,signal}){
  portNumber(port);if(typeof path!=='string'||!/^\/[a-zA-Z0-9._~/-]*$/.test(path)||!['HEAD','GET','POST'].includes(method))throw Error('请求路径或方法不在固定本机协议范围');signal?.throwIfAborted();
  if(body&&Buffer.byteLength(body)>2*1024*1024)throw Error('本机模型请求正文超过2MB，已停止');
  return new Promise((resolve,reject)=>{let done=false;const finish=(err,value)=>{if(done)return;done=true;clearTimeout(timer);err?reject(err):resolve(value);};
    const req=http.request({hostname:HOST,family:4,port,path,method,headers,agent:false,maxHeaderSize:16384,signal},response=>{if(response.statusCode>=300&&response.statusCode<400){response.destroy();finish(Error('服务返回重定向，已拒绝跟随'));return;}let size=0,truncated=false;const pieces=[];response.on('data',chunk=>{const remaining=maxBytes-size;if(remaining>0){pieces.push(chunk.subarray(0,remaining));size+=Math.min(chunk.length,remaining);}if(chunk.length>remaining){truncated=true;response.destroy();finish(null,{status:response.statusCode,headers:response.headers,bytes:Buffer.concat(pieces),truncated});}});response.on('end',()=>finish(null,{status:response.statusCode,headers:response.headers,bytes:Buffer.concat(pieces),truncated}));response.on('error',error=>finish(error));});
    req.once('socket',socket=>socket.once('connect',()=>{if(socket.remoteAddress!==HOST)req.destroy(Error('连接地址未通过固定目标检查'));}));req.on('error',error=>finish(error));const timer=setTimeout(()=>req.destroy(Error('本机请求超时')),timeout);if(body)req.write(body);req.end();
  });
}
export async function localModelRequest(input,init={}){
  const url=strictLoopbackURL(String(input));if(init.method!=='POST')throw Error('本机模型只允许 POST 推理请求');
  const data=await pinnedRequest({port:Number(url.port||80),path:url.pathname,method:'POST',body:init.body,headers:init.headers,maxBytes:1024*1024,timeout:25000,signal:init.signal});if(data.truncated)throw Error('本机模型响应超过1MB，已停止');
  try{const parsed=JSON.parse(data.bytes.toString('utf8'));if((parsed.choices?.[0]?.message?.tool_calls||[]).length>12)throw Error('TOO_MANY_TOOLS');}catch(error){if(error.message==='TOO_MANY_TOOLS')throw Error('本机模型一次请求了过多工具，已停止');}
  return new Response(data.bytes,{status:data.status,headers:{'content-type':'application/json'}});
}
export async function inspectHTTP(port,path,signal){
  if(!PROBE_PATHS.includes(path))throw Error('只允许预设的三个检查路径');const response=await pinnedRequest({port,path,method:path==='/'?'HEAD':'GET',signal}),findings=[];
  if(path==='/'){
    for(const [header,code,title]of [['content-security-policy','CSP_MISSING','缺少 Content-Security-Policy'],['x-content-type-options','NOSNIFF_MISSING','缺少 X-Content-Type-Options'],['x-frame-options','FRAME_POLICY_MISSING','未提供 X-Frame-Options（需结合 CSP frame-ancestors 判断）']])if(!response.headers[header])findings.push({code,title,severity:'review'});
  }else if(response.status===200){const text=response.bytes.toString('utf8'),exposed=path==='/.git/HEAD'?/^(?:ref: refs\/|[a-f0-9]{40}\s*$)/.test(text):/^(?:export\s+)?[A-Z_][A-Z0-9_]*\s*=/m.test(text);if(exposed)findings.push({code:path==='/.env'?'ENV_EXPOSED':'GIT_HEAD_EXPOSED',title:path==='/.env'?'疑似环境配置文件可被读取':'疑似 Git 元数据可被读取',severity:'high'});}
  return{host:HOST,port,path,status:response.status,truncated:response.truncated,findings,note:'仅返回状态与规则结论，不返回响应正文、Cookie或配置值；规则提示不等于确认漏洞'};
}
