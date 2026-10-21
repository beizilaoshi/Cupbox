/** Bounded SSE reader for plain text replies; never publishes thinking/tool data. */
export async function readTextStream(response: Response,provider: 'openai'|'anthropic',onText:(delta:string)=>Promise<void>|void): Promise<{text:string}> {
  if(!response.body)throw Error('流式接口没有返回正文');
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',text='',complete=false,total=0;
  async function frame(value:string){
    const raw=value.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!raw)return;
    if(raw==='[DONE]'){complete=true;return;}
    const data=JSON.parse(raw);if(data.error||data.type==='error')throw Error('模型流式响应失败');
    let delta='';
    if(provider==='anthropic'){
      if(data.type==='content_block_start'&&data.content_block?.type==='tool_use')throw Error('文本流返回了未经允许的工具调用');
      if(data.type==='content_block_delta'&&data.delta?.type==='text_delta')delta=data.delta.text||'';
      if(data.type==='message_delta'&&data.delta?.stop_reason&&!['end_turn','stop_sequence'].includes(data.delta.stop_reason))throw Error('模型流式输出未完整结束');
      if(data.type==='message_stop')complete=true;
    }else{
      const choice=data.choices?.find((c:{index?:number})=>!c.index),d=choice?.delta;
      if(d?.tool_calls?.length)throw Error('文本流返回了未经允许的工具调用');
      if(typeof d?.content==='string')delta=d.content;
      if(choice?.finish_reason){if(choice.finish_reason!=='stop')throw Error('模型流式输出未完整结束');complete=true;}
    }
    if(delta){text+=delta;if(text.length>80000)throw Error('流式回复超过长度限制');await onText(delta);}
  }
  try{
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>4*1024*1024)throw Error('流式响应超过大小限制');buffer+=decoder.decode(value,{stream:true});
      let match;while((match=/\r?\n\r?\n/.exec(buffer))){const part=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length);if(part.length>256*1024)throw Error('流式事件超过大小限制');await frame(part);if(complete)return{text};}if(buffer.length>256*1024)throw Error('流式事件超过大小限制');
    }
    buffer+=decoder.decode();if(buffer.trim())await frame(buffer);if(!complete)throw Error('模型流式连接中断，已停止后续发送');return{text};
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
