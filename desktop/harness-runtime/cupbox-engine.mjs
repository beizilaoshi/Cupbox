// Cupbox's carrier adapter. This plugin has no Web application or HTTP server.
export const inject=['tools','approval','sessionQuery'];
export function apply(ctx,config={}){
 let seq=0;const pending=new Map(),native=new Set((config.definitions||[]).map(d=>d.name));
 function ask(kind,payload,signal){return new Promise((resolve,reject)=>{if(signal?.aborted){reject(Error('已停止'));return;}const id=++seq;const abort=()=>{pending.delete(id);reject(Error('已停止'));};const settle=fn=>v=>{signal?.removeEventListener('abort',abort);pending.delete(id);fn(v);};pending.set(id,{resolve:settle(resolve),reject:settle(reject)});signal?.addEventListener('abort',abort,{once:true});if(!process.connected){pending.get(id).reject(Error('Cupbox 连接已断开'));return;}process.send({type:'cupbox:engine-request',id,kind,payload});});}
 const receive=async message=>{
  if(message?.type==='cupbox:engine-reply'){const item=pending.get(message.id);if(item)(message.error?item.reject(Error(message.error)):item.resolve(message.value));}
  if(message?.type==='cupbox:engine-inspect'){try{const value=await ctx.sessionQuery.readSession(message.sessionId);process.send?.({type:'cupbox:engine-inspected',id:message.id,value});}catch(e){process.send?.({type:'cupbox:engine-inspected',id:message.id,error:e.message});}}
 };
 ctx.effect(()=>{process.on('message',receive);return()=>{process.off('message',receive);for(const p of [...pending.values()])p.reject(Error('工作引擎已停止'));};});
 ctx.on('approval/request',async req=>await ask('approval',{name:req.toolName,reason:req.displayReason?.zh||req.reason||'',sessionId:req.agent.session.id},req.signal)?'allowed-once':'rejected');
 ctx.on('user-questions/request',req=>ask('question',{questions:req.questions},req.signal));
 const readOnly=new Set(['read','read_image','glob','grep','job_output','job_list','todo_read','todo_write','get_goal','list_skills','read_skill','list_mcp_resources','list_mcp_resource_templates','read_mcp_resource','ask_user_question','enter_plan_mode','exit_plan_mode']);
 ctx.on('tools/pre-execute',async(exec,next)=>{
  await ask('guard',{name:exec.name,args:exec.arguments,sessionId:exec.agent?.session.id},exec.signal);
  if(native.has(exec.name)||readOnly.has(exec.name))return next();
  const allowed=await ask('approval',{name:exec.name,args:exec.arguments,sessionId:exec.agent?.session.id},exec.signal);
  return allowed?next():{kind:'deny',reason:'用户未批准本次操作。'};
 });
 for(const def of config.definitions||[]){if(ctx.tools.get(def.name))continue;ctx.tools.register({name:def.name,description:def.description,parameters:def.parameters,output:{schema:{},render:(_args,value)=>[{type:'text',text:typeof value==='string'?value:JSON.stringify(value)}]},execute:(args,exec)=>ask('tool',{name:def.name,args,sessionId:exec.agent?.session.id},exec.signal)});}
 ctx.on('agent/assistant-stream',({agent,frame})=>{if(frame.type==='chunk'&&frame.chunk.type==='text-delta')process.send?.({type:'cupbox:engine-text',sessionId:agent.session.id,delta:frame.chunk.text});});
}
