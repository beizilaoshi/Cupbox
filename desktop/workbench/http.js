import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import ipaddr from 'ipaddr.js';
import { fail } from './files.js';
export function publicIP(value){try{let ip=ipaddr.parse(value);if(ip.kind()==='ipv6'&&ip.isIPv4MappedAddress())ip=ip.toIPv4Address();return ip.range()==='unicast';}catch{return false;}}
export async function pinnedTarget(input,lookup=dns.lookup){const url=new URL(input);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)fail('E_HTTP_URL','只允许不含内嵌凭据的 HTTP/HTTPS 地址');const host=url.hostname.replace(/^\[|\]$/g,''),addresses=net.isIP(host)?[{address:host,family:net.isIP(host)}]:await lookup(host,{all:true});if(!addresses.length||addresses.some(a=>!publicIP(a.address)))fail('E_SSRF','域名解析到私网、环回、保留或链路本地地址，已拒绝');return{url,addresses};}
export async function requestHTTP(args,{authorize,signal,lookup=dns.lookup,requestFactory}={}){
  const started=Date.now(),timeout=Math.max(1,Math.min(60000,args.timeoutMs||15000)),limit=Math.max(1,Math.min(10*1024*1024,args.maxBytes||1024*1024));
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();const timer=setTimeout(abort,timeout);
  try{
    let current=String(args.url),method=String(args.method||'GET').toUpperCase();if(!['GET','POST','PUT','PATCH','DELETE','HEAD'].includes(method))fail('E_HTTP_METHOD','不支持该 HTTP 方法');
    let headers={...args.headers},body=args.body;if(body&&typeof body==='object'){if('json'in body){body=JSON.stringify(body.json);headers['content-type']||='application/json';}else if(body.form){body=new URLSearchParams(body.form).toString();headers['content-type']||='application/x-www-form-urlencoded';}else fail('E_HTTP_BODY','无效请求体');}
    for(const k of Object.keys(headers))if(['host','connection','content-length','transfer-encoding','proxy-authorization','cookie'].includes(k.toLowerCase())||/[\r\n]/.test(String(headers[k])))fail('E_HTTP_HEADERS','禁止该请求头或换行：'+k);
    if(body&&Buffer.byteLength(String(body))>1024*1024)fail('E_TOO_LARGE','请求体超过 1 MB');
    for(let hop=0;hop<=5;hop++){
      const {url,addresses}=await pinnedTarget(current,lookup);await authorize?.(url,method);controller.signal.throwIfAborted();
      const response=await new Promise((resolve,reject)=>{
        // DNS is resolved once above and the validated address set is pinned in this connection's lookup.
        const req=(requestFactory||(url.protocol==='https:'?https:http).request)(url,{method,headers,signal:controller.signal,agent:false,lookup:(_h,opts,cb)=>{if(opts?.all)cb(null,addresses);else cb(null,addresses[0].address,addresses[0].family);}},resolve);req.on('error',reject);if(body&&!['GET','HEAD'].includes(method))req.write(String(body));req.end();
      });
      if([301,302,303,307,308].includes(response.statusCode)&&response.headers.location&&args.redirect!=='manual'){
        response.resume();if(args.redirect==='error')fail('E_HTTP_REDIRECT','服务返回重定向');if(hop===5)fail('E_HTTP_REDIRECT','重定向超过 5 跳');const next=new URL(response.headers.location,url);if(next.origin!==url.origin){headers={...headers};for(const k of Object.keys(headers))if(!['accept','accept-language','user-agent','content-type'].includes(k.toLowerCase()))delete headers[k];}
        if(response.statusCode===303||[301,302].includes(response.statusCode)&&method==='POST'){method='GET';body=undefined;}current=next.href;continue;
      }
      const pieces=[];let size=0,truncated=false;for await(const chunk of response){const remaining=limit-size;if(chunk.length>remaining){if(remaining>0)pieces.push(chunk.subarray(0,remaining));size=limit;truncated=true;response.destroy();break;}pieces.push(chunk);size+=chunk.length;}
      const bytes=Buffer.concat(pieces),type=String(response.headers['content-type']||''),binary=args.responseType==='binary'||!args.responseType||args.responseType==='auto'?(!/json|text|xml|javascript|x-www-form-urlencoded/.test(type)):false;
      const safeHeaders={...response.headers};delete safeHeaders['set-cookie'];
      let data;if(args.responseType==='binary'||binary)data={binary:true,bytes:size};else{data=bytes.toString('utf8');if((args.responseType==='json'||/json/.test(type))&&!truncated){try{data=JSON.parse(data);}catch{if(args.responseType==='json')fail('E_HTTP_JSON','响应不是有效 JSON');}}}
      return{status:response.statusCode,statusText:response.statusMessage,headers:safeHeaders,body:data,truncated,size,durationMs:Date.now()-started,bytes};
    }
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
