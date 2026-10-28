// Isolated Electron smoke test: mock model, temporary application data, no external model calls.
import {app,BrowserWindow} from 'electron';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import http from 'node:http';
const out=path.resolve('output/agent-capabilities-review',String(Date.now()));
process.env.CUPBOX_HOME=path.join(out,'home');process.env.CUPBOX_UPDATE_DISABLE='1';process.env.CUPBOX_ANNOUNCEMENT_DISABLE='1';
app.setPath('userData',path.join(out,'profile'));app.disableHardwareAcceleration();
const home=path.join(process.env.CUPBOX_HOME,'.cupbox');await mkdir(path.join(home,'memory'),{recursive:true});
await writeFile(path.join(home,'memory','user.md'),'资深前端，TypeScript，偏好简洁回复');
const calls=[];
const server=http.createServer((req,res)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{
  const body=JSON.parse(raw),results=body.messages.filter(m=>m.role==='tool');calls.push(body);
  const initial=body.messages.find(m=>m.role==='user')?.content;
  let message={content:'能力已核对'};
  if(initial==='AGENT_FLOW'){
    const previous=results.length?JSON.parse(results.at(-1).content):null;
    let name,args;
    if(!results.length){name='fs_write';args={path:'delivered.txt',content:'默认目录真实交付'};}
    else if(results.length===1){name='fs_write';args={path:'delivered.txt',content:'默认目录真实交付',dryRun:false,confirmToken:previous.confirmToken};}
    else if(results.length===2){name='memory_manage';args={};}
    else if(results.length===3){name='memory_recall';args={query:'前端'};}
    if(name)message={content:'执行测试步骤',tool_calls:[{id:'step-'+results.length,type:'function',function:{name,arguments:JSON.stringify(args)}}]};
  }
  res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message}]}));
});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
app.on('browser-window-created',(_,win)=>{win.show=()=>{};win.hide();win.webContents.setBackgroundThrottling(false);});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const check=(value,label)=>{if(!value)throw Error(label);console.log('PASS '+label);};
void (async()=>{try{
  await import(process.argv.includes('--packaged')?pathToFileURL(path.resolve('release/Cupbox可视化/resources/app/desktop/main.js')).href:'./main.js');
  let win;for(let i=0;i<150;i++){win=BrowserWindow.getAllWindows().find(w=>!w.isDestroyed());if(win&&!win.webContents.isLoading()&&await win.webContents.executeJavaScript('Boolean(window.cupboxReady)').catch(()=>false))break;await pause(100);}
  const js=s=>win.webContents.executeJavaScript(s);
  await js(`savePrefs({workspace:'',executionEnvironment:'native',approvalMode:'smart',agentPreset:'standard'});cupbox.aiConfigSet({provider:'openai-compatible',model:'mock-capabilities',baseUrl:${JSON.stringify('http://127.0.0.1:'+server.address().port+'/v1')},apiKey:'mock-only'})`);
  await js(`cupbox.chatSend({mode:'ask',text:'ASK_FLOW'})`);
  check(!calls.at(-1).tools&&calls.at(-1).messages[0].content.includes('本次没有执行工具'),'问答模式如实声明无执行工具');
  await js(`window.testApproval=cupbox.onApproval(v=>cupbox.executionRespond(v.id,v.tool==='fs_write'&&v.args.path==='delivered.txt'));true`);
  const result=await js(`cupbox.chatSend({mode:'agent',text:'AGENT_FLOW'})`);
  if(result.ok===false)throw Error(result.error);check(true,'真实 Agent 工作流完成');
  const request=calls.find(c=>c.messages.some(m=>m.content==='AGENT_FLOW'));
  check(['fs_read','fs_write','run'].every(n=>request.tools.some(t=>t.function.name===n)),'未选项目也真实接入读写与受控命令工具');
  const sandbox=(await js('cupbox.executionContext()')).sandbox;
  check((await readFile(path.join(sandbox,'delivered.txt'),'utf8'))==='默认目录真实交付','预览与批准后文件保存在默认目录');
  const toolResults=calls.at(-1).messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content));
  const memories=toolResults.filter(r=>r.data?.runtime);
  check(memories.length===2&&memories.every(r=>r.data.runtime.user.includes('TypeScript')&&r.data.counts.facts===0),'真实对话管理与召回均能读取已注入的画像');
  await js(`(async()=>{await savePrefs({filesystemTools:false});await cupbox.agentPluginConfigure({presetId:'standard',id:'tool-terminal',enabled:false});return cupbox.chatSend({mode:'agent',text:'FILTER_FLOW'});})()`);
  const filtered=calls.at(-1),names=filtered.tools.map(t=>t.function.name);
  check(!names.some(n=>['fs_write','fs_read','run','git','pkg','test'].includes(n))&&filtered.messages[0].content.includes('文件写入：未接入'),'关闭能力后实际工具与系统声明同步收敛');
  await js(`window.testApproval();true`);
  await writeFile(path.join(out,'result.json'),JSON.stringify({ok:true,requests:calls.length,sandbox},null,2));
  console.log('AGENT_CAPABILITIES_OK');server.closeAllConnections();server.close();app.exit(0);
}catch(e){console.error(e);server.closeAllConnections();server.close();app.exit(1);}})();
