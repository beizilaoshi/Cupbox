import dns from 'node:dns/promises';
import {publicIP} from '../workbench/http.js';
export const MEDIA_DOMAINS=['douyin.com','iesdouyin.com','douyinvod.com','douyinpic.com','byteimg.com','pstatp.com','snssdk.com','bytecdn.cn','amemv.com','kuaishou.com','gifshow.com','kwai.net','ksapisrv.com','bilibili.com','b23.tv','bilivideo.com','hdslb.com','xiaohongshu.com','xhslink.com','xhscdn.com','qpic.cn','qq.com'];
// NapCat's current image CDN is under qq.com.cn, not qq.com. Keep this
// exception to the actual media host; never trust arbitrary proxy fake IPs.
const QQ_IMAGE_HOST='multimedia.nt.qq.com.cn';
const WEB_HOSTS=['github.com','www.github.com','api.github.com','raw.githubusercontent.com'];
export const inDomains=(host,domains)=>domains.some(d=>host===d||host.endsWith('.'+d));
export async function mediaPublicLookup(host,options,{lookup=dns.lookup,fetcher=fetch}={}){
 const rows=await lookup(host,{all:true});if(rows.length&&rows.every(r=>publicIP(r.address)))return rows;
 if(!(inDomains(host,MEDIA_DOMAINS)||host===QQ_IMAGE_HOST||WEB_HOSTS.includes(host))||!rows.length||!rows.every(r=>/^198\.(18|19)\./.test(r.address)))throw Error('媒体域名解析到非公网地址，已拒绝');
 const response=await fetcher('https://dns.alidns.com/resolve?name='+encodeURIComponent(host)+'&type=A',{signal:AbortSignal.timeout(5000),redirect:'error'});if(!response.ok)throw Error('媒体公网DNS解析失败');const body=await response.json(),addresses=[...new Set((body.Answer||[]).filter(a=>a.type===1).map(a=>a.data))];if(!addresses.length||addresses.length>20||addresses.some(a=>!publicIP(a)))throw Error('媒体公网DNS结果无效');return addresses.map(address=>({address,family:4}));
}
