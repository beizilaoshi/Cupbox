import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {HarnessEngine} from './harness-engine.js';
import {TOOL_DEFS} from '../dist/core/toolkit.js';
import {DEFINITIONS} from './workbench/definitions.js';
import {Workbench} from './workbench/runtime.js';
const root=path.resolve('output/work-122',String(Date.now())),workspace=path.join(root,'workspace'),home=path.join(root,'home');
await mkdir(workspace,{recursive:true});await mkdir(home,{recursive:true});
const calls=[['pwsh',{description:'Verify real PowerShell execution',command:"Write-Output 'PWSH_122_OK'"}],['run',{command:'echo RUN_122_OK',mode:'shell'}],['run',{command:'echo DEFAULT_122_OK'}],['fs_stat',{path:'.'}],['memory_recall',{query:'workflow',scope:'project'}]];
let step=0;const messages=[],seen=new Set(),approvals=[];
const server=http.createServer((req,res)=>{let raw='';req.on('data',v=>raw+=v);req.on('end',()=>{const b=JSON.parse(raw);messages.push(b.messages);for(const t of b.tools||[])seen.add(t.function.name);const call=calls[step++];const delta=call?{role:'assistant',tool_calls:[{index:0,id:'call-'+step,type:'function',function:{name:call[0],arguments:JSON.stringify(call[1])}}]}:{role:'assistant',content:'WORK_122_DONE'};res.setHeader('content-type','text/event-stream');res.end('data: '+JSON.stringify({choices:[{index:0,delta,finish_reason:null}]})+'\n\ndata: '+JSON.stringify({choices:[{index:0,delta:{},finish_reason:call?'tool_calls':'stop'}]})+'\n\ndata: [DONE]\n\n');});});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const prefs={approvalMode:'full',executionEnvironment:'native'},bench=await new Workbench({root:workspace,home,session:'verify',getPrefs:async()=>prefs,approve:async p=>{approvals.push(p);return false;}}).init();
const engine=new HarnessEngine({home:()=>home});
try{const result=await engine.run({workspace,config:{provider:'openai-compatible',model:'fixture',capabilities:['text'],baseUrl:'http://127.0.0.1:'+server.address().port+'/v1',apiKey:'fixture'},definitions:[...TOOL_DEFS,...DEFINITIONS],approvalMode:'full',approve:async p=>{approvals.push(p);return false;},execute:async(name,args)=>{const value=await bench.call(name,args);if(!value.ok)throw Error(value.message);return value;},prompt:'Execute the provided workflow.'});console.log(JSON.stringify({seen:[...seen],trace:result.trace,approvals},null,2));assert(result.trace.some(t=>t.name==='pwsh'&&t.ok&&t.output.includes('PWSH_122_OK')),'PowerShell must execute');assert(result.trace.some(t=>t.name==='run'&&t.ok&&t.output.includes('RUN_122_OK')),'run must execute through the native schema');assert.equal(approvals.length,0,'Full control must not request approval');console.log('PASS real PowerShell, native command schema, file tool and unattended full control');}finally{await engine.stopAll();bench.dispose();server.closeAllConnections();await new Promise(r=>server.close(r));}
