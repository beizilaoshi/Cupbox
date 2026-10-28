import dns from 'node:dns/promises';
import {publicIP} from '../workbench/http.js';
// Some local proxies synthesize RFC2544 fake-IP records. Only known music CDN
// names may fall back to a fixed HTTPS DNS resolver; private IPs remain denied.
const domains=['music.126.net','music.163.com','qq.com','kugou.com','kugou.net','kuwo.cn'];
export async function musicPublicLookup(host,options,{lookup=dns.lookup,fetcher=fetch}={}){
 const rows=await lookup(host,{all:true});if(rows.length&&rows.every(r=>publicIP(r.address)))return rows;
 if(!domains.some(d=>host===d||host.endsWith('.'+d))||!rows.length||!rows.every(r=>/^198\.(18|19)\./.test(r.address)))throw Error('音乐域名解析到非公网地址，已拒绝');
 const response=await fetcher('https://dns.alidns.com/resolve?name='+encodeURIComponent(host)+'&type=A',{signal:AbortSignal.timeout(5000),redirect:'error'});if(!response.ok)throw Error('音乐公网DNS解析失败');const body=await response.json(),addresses=[...new Set((body.Answer||[]).filter(a=>a.type===1).map(a=>a.data))];if(!addresses.length||addresses.length>20||addresses.some(a=>!publicIP(a)))throw Error('音乐公网DNS返回非公网地址，已拒绝');return addresses.map(address=>({address,family:4}));
}
