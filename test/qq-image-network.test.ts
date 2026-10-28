import {describe,it,expect,vi} from 'vitest';
import {mediaPublicLookup} from '../desktop/qq/media-network.js';
import {recognizeImages} from '../desktop/qq/capabilities.js';
import sharp from 'sharp';

describe('QQ image CDN behind system fake-IP DNS',()=>{
 it('resolves exact GitHub readme hosts through fake DNS while rejecting lookalikes',async()=>{for(const host of ['github.com','api.github.com','raw.githubusercontent.com'])expect(await mediaPublicLookup(host,{}, {lookup:async()=>[{address:'198.18.0.23',family:4}],fetcher:async()=>({ok:true,json:async()=>({Answer:[{type:1,data:'8.8.8.8'}]})})})).toEqual([{address:'8.8.8.8',family:4}]);await expect(mediaPublicLookup('github.com.evil.example',{}, {lookup:async()=>[{address:'198.18.0.23',family:4}]})).rejects.toThrow('非公网');});
 const fakeLookup=async()=>[{address:'198.18.0.23',family:4}];
 const answer=(ip='8.8.8.8')=>vi.fn(async()=>({ok:true,json:async()=>({Answer:[{type:1,data:ip}]})}));
 it('resolves the current NapCat image host to a validated real public address',async()=>{
  const fetcher=answer();
  expect(await mediaPublicLookup('multimedia.nt.qq.com.cn',{}, {lookup:fakeLookup,fetcher})).toEqual([{address:'8.8.8.8',family:4}]);
  expect(fetcher.mock.calls[0][0]).toContain('name=multimedia.nt.qq.com.cn');
 });
 it('does not broaden the exception to lookalikes, arbitrary qq.com.cn hosts or private DNS answers',async()=>{
  for(const host of ['multimedia.nt.qq.com.cn.evil.example','evilqq.com.cn','unknown.qq.com.cn']){
   const fetcher=answer();await expect(mediaPublicLookup(host,{}, {lookup:fakeLookup,fetcher})).rejects.toThrow('非公网');expect(fetcher).not.toHaveBeenCalled();
  }
  for(const ip of ['127.0.0.1','192.168.1.1','169.254.169.254','198.18.0.2'])await expect(mediaPublicLookup('multimedia.nt.qq.com.cn',{}, {lookup:fakeLookup,fetcher:answer(ip)})).rejects.toThrow('结果无效');
  const fetcher=answer();await expect(mediaPublicLookup('multimedia.nt.qq.com.cn',{}, {lookup:async()=>[{address:'127.0.0.1',family:4}],fetcher})).rejects.toThrow('非公网');expect(fetcher).not.toHaveBeenCalled();
 });
 it('downloads and converts real image bytes before supplying them to vision',async()=>{
  const bytes=await sharp({create:{width:48,height:48,channels:3,background:'#ff0000'}}).png().toBuffer();
  const request=vi.fn(async()=>({status:200,truncated:false,bytes})),invoke=vi.fn(async()=>({text:'红色图片'}));
  const result=await recognizeImages(['https://multimedia.nt.qq.com.cn/download?test=1'],{provider:'openai-compatible',capabilities:['vision']},'看看图片',new AbortController().signal,'',{request,invoke});
  expect(result.text).toBe('红色图片');expect(request.mock.calls[0][1].lookup).toBe(mediaPublicLookup);
  const attachment=invoke.mock.calls[0][0].attachments[0];expect(attachment.mime).toBe('image/jpeg');expect(attachment.data).toMatch(/^data:image\/jpeg;base64,/);
  expect((await sharp(Buffer.from(attachment.data.split(',')[1],'base64')).metadata()).width).toBe(48);
 });
});
