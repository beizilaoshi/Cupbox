import { app } from 'electron';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import http from 'node:http';
const out=path.resolve('output/ui-review');await mkdir(out,{recursive:true});
app.setPath('userData',path.join(process.env.CUPBOX_HOME,'electron-profile'));app.disableHardwareAcceleration();
const markdown='# 清晰的交付\n\n这是 **加粗重点**，以及 `行内代码`。\n\n- 支持复制正文\n- 评价会影响上下文\n\n| 功能 | 状态 |\n| --- | --- |\n| 文件读写 | 已接入 |\n\n```js\nconst answer = 42;\nconsole.log(answer);\n```\n\n> 先检查，再交付。\n\n<script>window.markdownExecuted=true</script><img src="x" onerror="window.markdownExecuted=true">';
const calls=[];let toolMode=false,projectMode=false;
const server=http.createServer((req,res)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{
  const body=JSON.parse(raw||'{}');calls.push(body);const last=body.messages?.at(-1);
  const prompt=last?.content||'';
  if(projectMode&&typeof prompt==='string'&&prompt.includes('只返回 JSON')){const content=prompt.includes('"passed"')?JSON.stringify({passed:true,issues:[]}):JSON.stringify({tasks:[{id:'interface',title:'接口交付',prompt:'制作接口说明文件',cap:'text'},{id:'implementation',title:'实现交付',prompt:'基于接口说明制作模块',cap:'text',dependsOn:['interface']}]});res.setHeader('content-type','application/json');return res.end(JSON.stringify({choices:[{message:{content}}]}));}
  const scope=projectMode&&typeof prompt==='string'?prompt.match(/本子项目独立交付目录：([^。\n]+)/)?.[1]:null;
  const file=projectMode?(scope?path.join(scope,'part.txt'):'integrated.txt'):'delivered.txt';
  const toolResult=body.messages.filter(m=>m.role==='tool').at(-1);let preview;try{preview=JSON.parse(toolResult?.content||'{}');}catch{}
  const previous=body.messages.filter(m=>m.tool_calls?.length).at(-1);const previousArgs=previous?JSON.parse(previous.tool_calls[0].function.arguments):null;
  const message=toolMode&&preview?.confirmToken?{content:'确认执行预览。',tool_calls:[{id:'write-commit',type:'function',function:{name:'fs_write',arguments:JSON.stringify({...previousArgs,dryRun:false,confirmToken:preview.confirmToken})}}]}:toolMode&&!body.messages.some(m=>m.role==='tool')?{content:'准备写入文件。',tool_calls:[{id:'write-1',type:'function',function:{name:'fs_write',arguments:JSON.stringify({path:file,content:projectMode?'项目真实交付':'由预览事务文件工具交付'})}}]}:{content:toolMode?'文件工具执行已结束。':markdown};
  res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message}]}));
});});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/v1`;
app.on('browser-window-created',(_event,win)=>{
  win.hide();win.webContents.setBackgroundThrottling(false);const errors=[];win.webContents.on('console-message',d=>{if(d.level==='error')errors.push(d.message);});
  win.webContents.once('did-finish-load',async()=>{
    const js=s=>win.webContents.executeJavaScript(s),check=async(label,s)=>{if(!await js(s))throw Error(label);console.log('PASS '+label);};
    const wait=async condition=>js(`new Promise((resolve,reject)=>{let n=0;const timer=setInterval(()=>{if(${condition}){clearInterval(timer);resolve(true);}else if(++n>300){clearInterval(timer);reject(Error('等待超时'));}},40)})`);
    const capture=async name=>{await new Promise(r=>setTimeout(r,180));await writeFile(path.join(out,name),(await win.webContents.capturePage()).toPNG());};
    try{
      await wait('window.cupboxReady');
      await js(`cupbox.aiConfigSet({model:'mock-markdown',provider:'openai-compatible',baseUrl:${JSON.stringify(base)},apiKey:'mock-only'});`);await js('refreshModel()');
      await js(`document.querySelector('#chat-text').value='展示格式化答复';sendChat()`);
      await check('Markdown 标题、强调、表格与代码块实际渲染',`document.querySelector('.response-markdown h1')?.textContent==='清晰的交付'&&document.querySelectorAll('.response-markdown strong').length>0&&document.querySelectorAll('.response-table table').length>0&&document.querySelectorAll('.response-code pre code').length>0`);
      await check('清除脚本、事件属性与未授权远程图片',`!window.markdownExecuted&&!document.querySelector('.response-markdown script')&&!document.querySelector('.response-markdown img')&&!document.querySelector('.response-markdown [onerror]')`);
      await js(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedText=text;}}});document.querySelector('.response-actions button').click()`);await wait('window.copiedText');
      await check('复制正文保留内容并去掉 Markdown 标记',`window.copiedText.includes('加粗重点')&&!window.copiedText.includes('**加粗重点**')&&window.copiedText.includes('const answer = 42;')`);
      await js(`document.querySelector('.response-actions button:nth-child(2)').click()`);await check('可单独复制 Markdown 源文',`window.copiedText.includes('**加粗重点**')`);
      await js(`document.querySelector('.response-code-head button').click()`);await check('代码块单独复制不包含工具栏文字',`window.copiedText===${JSON.stringify('const answer = 42;\nconsole.log(answer);\n')}`);
      await js(`document.querySelector('.response-actions button:nth-child(3)').click()`);await wait(`document.querySelector('.response-actions button:nth-child(3)').getAttribute('aria-pressed')==='true'`);
      await check('好评写入会话且影响优先参考',`cupbox.sessionsRead(sessionId).then(s=>s.messages.at(-1).feedback==='up')`);
      await js(`document.querySelector('.response-actions button:nth-child(5)').click();document.querySelector('.response-memory-editor textarea').value='演示项目使用蓝色界面';document.querySelector('.response-memory-editor button').click()`);await wait(`!document.querySelector('.response-memory-editor')`);
      const factsPath=path.join(process.env.CUPBOX_HOME,'.cupbox','memory','facts.jsonl');if(!(await readFile(factsPath,'utf8')).includes('演示项目使用蓝色界面'))throw Error('未保存长期记忆');console.log('PASS 明确确认后才保存长期记忆');
      await js(`document.querySelector('#chat-scroll').scrollTop=0`);await capture('20-formatted-response.png');
      await js(`document.querySelector('#chat-text').value='演示项目应该使用什么界面';sendChat()`);
      if(!calls.at(-1).messages[0].content.includes('演示项目使用蓝色界面'))throw Error('长期记忆未召回');if(!calls.at(-1).messages[0].content.includes('有帮助的历史'))throw Error('好评参考未注入');console.log('PASS 长期记忆与好评参考实际进入后续请求');
      const firstId=await js(`cupbox.sessionsRead(sessionId).then(s=>s.messages.find(m=>m.role==='assistant').id)`);
      await js(`cupbox.responseFeedback({sessionId,messageId:${JSON.stringify(firstId)},value:'down'})`);if((await readFile(factsPath,'utf8')).includes('演示项目使用蓝色界面'))throw Error('差评未撤销对应记忆');
      await js(`openSession(sessionId)`);await check('重新打开对话恢复差评与上下文排除提示',`document.querySelectorAll('.response-excluded').length===1&&document.querySelector('.response-excluded .response-feedback-note').textContent.includes('排除')`);
      // Reject every existing answer to make the next request's history assertion unambiguous.
      await js(`(async()=>{const s=await cupbox.sessionsRead(sessionId);for(const m of s.messages.filter(m=>m.role==='assistant'))await cupbox.responseFeedback({sessionId,messageId:m.id,value:'down'});})()`);
      await js(`document.querySelector('#chat-text').value='继续演示项目';sendChat()`);if(calls.at(-1).messages.some(m=>m.role==='assistant'))throw Error('差评答复仍被发送');console.log('PASS 差评答复从真实后续请求中移除');
      toolMode=true;await js(`savePrefs({executionEnvironment:'sandbox'});newChat();setMode('agent');document.querySelector('#chat-text').value='创建 delivered.txt';window.toolSend=sendChat();true`);
      await wait(`!document.querySelector('#approval-screen').hidden`);
      await check('新增文件写入使用现有批准界面',`document.querySelector('#approval-args').textContent.includes('delivered.txt')`);await js(`document.querySelector('#approval-allow').click()`);await js('window.toolSend');
      const ctx=await js('cupbox.executionContext()');if((await readFile(path.join(ctx.sandbox,'delivered.txt'),'utf8'))!=='由预览事务文件工具交付')throw Error('文件工具没有真实交付');
      await check('Agent 广告工具与真实轨迹均包含预览事务文件能力',`cupbox.sessionsRead(sessionId).then(s=>s.messages.at(-1).trace.some(t=>t.name==='fs_write'&&t.ok))`);
      console.log('PASS Electron 文件工具通过预览令牌真实写入');await capture('21-file-tool-response.png');
      projectMode=true;
      await js(`newChat();document.querySelector('#multi-model-enabled').click();document.querySelector('#workflow-picker').value='project';document.querySelector('#workflow-picker').dispatchEvent(new Event('change'));document.querySelector('#workflow-scene').value='coding';document.querySelector('#workflow-quality').value='balanced';window.autoApproval=cupbox.onApproval(v=>cupbox.executionRespond(v.id,true));document.querySelector('#chat-text').value='开发一个完整项目并交付文件';sendChat()`);
      const project=await js('cupbox.sessionsRead(sessionId)');const message=project.messages.at(-1);if(message.tasks.length!==2||message.tasks.some(t=>t.status!=='done'))throw Error('项目子任务未完成');
      for(const task of message.tasks)if((await readFile(path.join(task.outputDir,'part.txt'),'utf8'))!=='项目真实交付')throw Error('子项目未落盘');
      if((await readFile(path.join(ctx.sandbox,'integrated.txt'),'utf8'))!=='项目真实交付')throw Error('协调模型未整合文件');console.log('PASS 依赖工作流各自落盘，协调模型整合真实文件');
      await capture('22-coding-workflow-delivery.png');await js('window.autoApproval();true');

      if(errors.length)throw Error(errors.join('\n'));console.log('PASS no renderer errors');server.closeAllConnections();server.close();app.exit(0);
    }catch(e){console.error(e);server.closeAllConnections();server.close();app.exit(1);}
  });
});
await import(process.argv.includes('--packaged')?pathToFileURL(path.resolve('release/Cupbox可视化/resources/app/desktop/main.js')).href:'./main.js');
