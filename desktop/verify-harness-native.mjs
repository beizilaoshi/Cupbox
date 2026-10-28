import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';import http from 'node:http';
import {HarnessEngine} from './harness-engine.js';
const root=path.resolve('output/harness-native',String(Date.now())),workspace=path.join(root,'workspace'),home=path.join(root,'home');await mkdir(workspace,{recursive:true});await mkdir(home,{recursive:true});await writeFile(path.join(workspace,'fixture.txt'),'CUPBOX_NATIVE_READ');
let requests=0,step=0;const inputs=[],names=new Set(),events=[],approvals=[];
const server=http.createServer((req,res)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{const b=JSON.parse(raw);requests++;inputs.push(b);for(const t of b.tools||[])names.add(t.function.name);let delta;
 if(step===0){step++;delta={role:'assistant',tool_calls:[{index:0,id:'read-1',type:'function',function:{name:'read',arguments:JSON.stringify({file_path:'fixture.txt'})}}]};}
 else if(step===1){step++;delta={role:'assistant',tool_calls:[{index:0,id:'write-1',type:'function',function:{name:'write',arguments:JSON.stringify({file_path:'created.txt',content:'CUPBOX_NATIVE_WRITE'})}}]};}
 else if(step===2){step++;delta={role:'assistant',tool_calls:[{index:0,id:'native-1',type:'function',function:{name:'cupbox_test_tool',arguments:JSON.stringify({value:'native'})}}]};}
 else delta={role:'assistant',content:'CUPBOX_NATIVE_DONE'};
 res.setHeader('content-type','text/event-stream');res.write('data: '+JSON.stringify({choices:[{index:0,delta,finish_reason:null}]})+'\n\n');res.end('data: '+JSON.stringify({choices:[{index:0,delta:{},finish_reason:delta.tool_calls?'tool_calls':'stop'}],usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15}})+'\n\ndata: [DONE]\n\n');});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const config={model:'fixture',provider:'openai-compatible',baseUrl:'http://127.0.0.1:'+server.address().port+'/v1',apiKey:'fixture-key',capabilities:['text']},engine=new HarnessEngine({home:()=>home}),definitions=[{name:'cupbox_test_tool',description:'Cupbox native test tool',parameters:{type:'object',properties:{value:{type:'string'}},required:['value'],additionalProperties:false}}];
const options={workspace,config,definitions,approve:async p=>{approvals.push(p);return true;},execute:async(name,args)=>{if(name!=='cupbox_test_tool')throw Error('Unknown tool');return{value:'CUPBOX_NATIVE_TOOL_'+args.value};},onTool:e=>events.push(e)};
try{
 const result=await engine.run({...options,prompt:'Read fixture.txt, create created.txt, call cupbox_test_tool and report.'});
 if(result.text!=='CUPBOX_NATIVE_DONE'||!inputs.some(b=>JSON.stringify(b.messages).includes('CUPBOX_NATIVE_READ'))||await readFile(path.join(workspace,'created.txt'),'utf8')!=='CUPBOX_NATIVE_WRITE'||!inputs.some(b=>JSON.stringify(b.messages).includes('CUPBOX_NATIVE_TOOL_native')))throw Error('Native engine execution failed');
 if(!approvals.some(p=>p.name==='write')||!events.some(e=>e.item?.ok))throw Error('Native approvals or trace missing');
 const resumed=await engine.run({...options,id:result.harnessSessionId,resume:true,prompt:'Continue this exact task.'});if(!inputs.at(-1).messages.some(m=>JSON.stringify(m).includes('CUPBOX_NATIVE_READ')))throw Error('Task context was not resumed');
 const connection=await engine.connect(options);let saved;try{saved=await connection.inspect(result.harnessSessionId);}finally{await connection.close();}
 if(!saved.events.some(e=>e.type==='assistant/message'))throw Error('Native history inspection failed');
 console.log(JSON.stringify({ok:true,requests,tools:names.size,read:true,write:true,nativeTool:true,approval:true,resume:resumed.harnessSessionId===result.harnessSessionId,history:true,trace:result.trace.length}));console.log('OUTPUT '+root);
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
