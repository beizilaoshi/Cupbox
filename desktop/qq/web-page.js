import {gunzipSync,inflateSync,brotliDecompressSync} from 'node:zlib';
export function responseText(response,limit=1024*1024){
 if(!response.bytes)return String(response.body||'');let bytes=Buffer.from(response.bytes);const encoding=String(response.headers?.['content-encoding']||'').toLowerCase();
 if(encoding==='gzip'||bytes[0]===31&&bytes[1]===139)bytes=gunzipSync(bytes,{maxOutputLength:limit});else if(encoding==='br')bytes=brotliDecompressSync(bytes,{maxOutputLength:limit});else if(encoding==='deflate')bytes=inflateSync(bytes,{maxOutputLength:limit});else if(encoding&&encoding!=='identity')throw Error('网页压缩格式不支持');
 if(bytes.length>limit)throw Error('网页解压后超过大小限制');return bytes.toString('utf8');
}
