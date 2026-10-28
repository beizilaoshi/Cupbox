// Original runtime + real file tool + local OpenAI fixture; no external AI calls.
import {mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import {spawn} from 'node:child_process';
import {launchConfiguration,environment} from './harness-host.js';
const root=path.resolve('output/harness-tools-review'),workspace=path.join(root,'workspace'),home=path.join(root,'home');await mkdir(workspace,{recursive:true});await mkdir(home,{recursive:true});await writeFile(path.join(workspace,'fixture.txt'),'HARNESS_REAL_FILE_TOOL_OK');
let toolSeen=false,toolReturned=false,requests=0;const names=new Set();
const server=http.createServer((req,res)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{
 const b=JSON.parse(raw);requests++;for(const t of b.tools||[])names.add(t.function.name);const results=(b.messages||[]).filter(m=>m.role==='tool');if(JSON.stringify(results).includes('HARNESS_REAL_FILE_TOOL_OK'))toolReturned=true;
 const useTool=!toolSeen&&b.tools?.some(t=>t.function.name==='read');if(useTool)toolSeen=true;
 const delta=useTool?{role:'assistant',tool_calls:[{index:0,id:'read-fixture',type:'function',function:{name:'read',arguments:JSON.stringify({file_path:'fixture.txt'})}}]}:{role:'assistant',content:'HARNESS_VERIFIED'};
 if(b.stream){res.setHeader('content-type','text/event-stream');res.write('data: '+JSON.stringify({id:'fixture',object:'chat.completion.chunk',created:1,model:'fixture',choices:[{index:0,delta,finish_reason:null}]})+'\n\n');res.write('data: '+JSON.stringify({id:'fixture',object:'chat.completion.chunk',created:1,model:'fixture',choices:[{index:0,delta:{},finish_reason:useTool?'tool_calls':'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}})+'\n\n');res.end('data: [DONE]\n\n');}
 else{res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:delta,finish_reason:useTool?'tool_calls':'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));}
 });});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const configuration=launchConfiguration({all:[{id:'fixture',name:'Local fixture',enabled:true,provider:'openai-compatible',model:'fixture',baseUrl:'http://127.0.0.1:'+server.address().port+'/v1',apiKey:'local-fixture',capabilities:['text']}]});const patch=path.join(home,'patch.json');await writeFile(patch,JSON.stringify(configuration.patch));
const runtime=path.resolve('desktop/harness-runtime'),child=spawn(path.join(runtime,'bin/node.exe'),[path.join(runtime,'host.mjs'),'--profile','headless','--patch',patch,'--json','Read fixture.txt using the read tool and report its exact content.'],{cwd:workspace,env:environment(process.env,home,configuration.env),windowsHide:true,stdio:['ignore','pipe','pipe']});let output='',errors='';child.stdout.on('data',c=>output+=String(c));child.stderr.on('data',c=>errors+=String(c));const timer=setTimeout(()=>child.kill(),25000);
const code=await new Promise(r=>{child.once('exit',r);child.once('error',e=>{errors+=e.message;r(-1);});});clearTimeout(timer);server.closeAllConnections();await new Promise(r=>server.close(r));
await writeFile(path.join(root,'events.jsonl'),output);await writeFile(path.join(root,'diagnostics.txt'),errors);
if(code!==0||!toolSeen||!toolReturned)throw Error(JSON.stringify({code,toolSeen,toolReturned,requests,error:errors.slice(-1800)}));
console.log(JSON.stringify({ok:true,requests,advertisedTools:names.size,readToolActuallyExecuted:toolReturned,durableEvents:output.split('\n').filter(Boolean).length}));
