import { setTimeout as delay } from 'node:timers/promises';
import { naturalCut } from './conversation.js';
import { stripEmojiMarkers } from './emoji-policy.js';

export function visibleStream(raw,final=false){
  let text=stripEmojiMarkers(raw);
  const open=text.lastIndexOf('[[');if(open>=0&&!text.slice(open).includes(']]'))text=text.slice(0,open);
  if(!final&&text.endsWith('['))text=text.slice(0,-1);return text.trimStart();
}
export function clipText(text,limit){let value=String(text).slice(0,limit);if(/[\uD800-\uDBFF]$/.test(value))value=value.slice(0,-1);return value;}
/** Backpressure-aware QQ delivery. Reserve the last message for the remaining text/emoji. */
export class SegmentWriter{
  constructor({send,signal,chars=160,max=4,interval=1000,limit=1800,mode='natural',typingDelay=false,wait=delay}){Object.assign(this,{send,signal,chars,max,interval,limit,mode,typingDelay,wait});this.raw='';this.offset=0;this.count=0;this.delivered='';}
  async part(text,emoji){this.signal?.throwIfAborted();if(!text.trim()&&!emoji)return;if(this.count)await this.wait(this.typingDelay?Math.max(this.interval,Math.min(5000,400+text.length*35)):this.interval,undefined,{signal:this.signal});this.signal?.throwIfAborted();await this.send(text.trim(),{first:this.count===0,emoji});this.count++;this.delivered+=text;}
  async push(delta){
    this.raw+=delta;if(this.mode==='lines')return;const text=clipText(visibleStream(this.raw),this.limit);
    while(this.count<this.max-1){const rest=text.slice(this.offset);let cut=0;const window=rest.slice(0,this.chars);
      for(const match of window.matchAll(/[。！？!?\n](?:[”"’])?/g))if(match.index+match[0].length>=40){cut=match.index+match[0].length;break;}
      if(this.mode==='natural'||this.mode==='bubbles')cut=naturalCut(rest,this.chars,this.mode==='bubbles');else if(!cut&&rest.length>=this.chars)cut=this.chars;if(!cut)break;
      if(/[\uD800-\uDBFF]/.test(rest[cut-1]))cut--;if(!cut)break;
      await this.part(rest.slice(0,cut));this.offset+=cut;
    }
  }
  async finish(text,emoji){
    if(this.mode==='lines'){const lines=clipText(text,this.limit).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);while(lines.length>this.max)lines.splice(this.max-1,2,lines.slice(this.max-1,this.max+1).join(' '));if(!lines.length)await this.part('',emoji);else for(let i=0;i<lines.length;i++)await this.part(lines[i],i===lines.length-1?emoji:undefined);return this.count;}
    const final=clipText(visibleStream(text,true),this.limit);if(this.offset&&final.slice(0,this.offset)!==visibleStream(this.raw).slice(0,this.offset))throw Error('流式结果不一致，已停止后续发送');
    await this.part(final.slice(this.offset),emoji);this.offset=final.length;return this.count;
  }
}
