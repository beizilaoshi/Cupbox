import { app, dialog } from 'electron';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL,fileURLToPath } from 'node:url';
const out=path.resolve('output/ui-review');await mkdir(out,{recursive:true});
app.setPath('userData',path.join(process.env.CUPBOX_HOME,'electron-profile'));app.disableHardwareAcceleration();
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aovcAAAAASUVORK5CYII=','base64');
const calls=[];let slow=false,failVision=false;
const server=http.createServer((req,res)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{
  const body=JSON.parse(raw||'{}');calls.push({url:req.url,body});
  if(req.url.endsWith('/images/generations')){res.setHeader('content-type','application/json');return res.end(JSON.stringify({data:[{b64_json:png.toString('base64')}]}));}
  if(req.url.endsWith('/audio/speech')){res.setHeader('content-type','audio/mpeg');return res.end('ID3test');}
  if(failVision&&Array.isArray(body.messages?.at(-1)?.content)){res.writeHead(500);return res.end('mock vision error');}
  const prompt=body.messages?.at(-1)?.content;const text=typeof prompt==='string'&&prompt.includes('\"passed\"')?JSON.stringify({passed:true,issues:[]}):typeof prompt==='string'&&prompt.includes('只返回 JSON')?JSON.stringify({tasks:[{id:'design',title:'产品设计',prompt:'明确页面与交互',cap:'text'},{id:'build',title:'前端实现',prompt:'交付组件代码与接口约定',cap:'text',dependsOn:['design']},{id:'verify',title:'检查与验证',prompt:'设计验收步骤',cap:'text',dependsOn:['design']}]}):'已完成本子项目。\n\n1. 明确交付范围与接口\n2. 实现独立模块\n3. 提供可复查的验收说明\n\n此为本地模拟 API 的集成验证结果。';
  setTimeout(()=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:text}}]}));},slow?3000:350);
});});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/v1`;
app.on('browser-window-created',(_e,win)=>{
  win.hide();win.webContents.setBackgroundThrottling(false);const errors=[];
  win.webContents.on('console-message',d=>{if(d.level==='error'&&!d.message.includes('DEMUXER'))errors.push(d.message);});
  win.webContents.once('did-finish-load',async()=>{
    const js=s=>win.webContents.executeJavaScript(s);
    const check=async(label,s)=>{if(!await js(s))throw Error(label);console.log('PASS '+label);};
    const wait=async(s)=>js(`new Promise((resolve,reject)=>{let n=0;const timer=setInterval(()=>{if(${s}){clearInterval(timer);resolve(true);}else if(++n>300){clearInterval(timer);reject(Error('等待超时'));}},40);})`);
    const capture=async(name)=>{await new Promise(r=>setTimeout(r,150));return writeFile(path.join(out,name),(await win.webContents.capturePage()).toPNG());};
    try{
      await wait('window.cupboxReady');
      await check('默认关闭多模型与工作流',`!document.querySelector('#multi-model-enabled').checked&&document.querySelector('#workflow-picker').disabled`);
      await js(`openModal('models')`);await check('模型库设置页显示',`!document.querySelector('#tab-models').hidden&&document.querySelector('#tab-api').hidden`);
      await js(`document.querySelector('#ml-name').value='文本工作伙伴';document.querySelector('#ml-base').value=${JSON.stringify(base)};document.querySelector('#ml-model').value='text-test';document.querySelector('#ml-key').value='mock-only';document.querySelector('#ml-save').click()`);
      await wait(`document.querySelector('#ml-status').textContent.includes('已保存')`);
      await check('表单保存独立文本模型并清除密钥回填',`cupbox.modelsList().then(ms=>ms.length===1&&ms[0].capabilities.includes('text')&&ms[0].hasApiKey&&!ms[0].apiKey&&!document.querySelector('#ml-key').value)`);
      for(const [id,cap,name] of [['image','image','绘图工作伙伴'],['audio','audio','语音工作伙伴'],['vision','vision','视觉工作伙伴']]){
        await js(`cupbox.modelSave({id:${JSON.stringify(id)},name:${JSON.stringify(name)},model:${JSON.stringify(id+'-test')},provider:'openai-compatible',baseUrl:${JSON.stringify(base)},apiKey:'mock-only',capabilities:[${JSON.stringify(cap)}]})`);
      }
      await js(`CupboxModels.refresh()`);
      await check('能力路由分别使用独立模型',`document.querySelector('#route-image').value==='image'&&document.querySelector('#route-audio').value==='audio'`);
      await js(`document.querySelector('#multi-model-enabled').click()`);await wait(`document.querySelector('#workflow-picker').disabled===false`);
      await check('开启协作偏好已持久化',`cupbox.prefsGet().then(p=>p.multiModel===true)`);
      await js(`document.querySelector('#project-workers input').click()`);
      await check('项目参与模型通过明确勾选保存',`cupbox.prefsGet().then(p=>p.projectWorkers.length===1)`);
      await capture('17-model-library.png');
      await js(`closeModal();document.querySelector('.composer-capabilities').open=true;document.querySelector('#workflow-picker').value='project';document.querySelector('#workflow-picker').dispatchEvent(new Event('change'));document.querySelector('#chat-text').value='制作一个完整的现代应用';window.projectSend=sendChat();true`);
      await wait(`document.querySelectorAll('#workflow-live-grid .workflow-card[data-state="running"]').length>=2`);
      await capture('18-project-workflow-running.png');
      await js('window.projectSend');
      await check('规划并行制作和整合完成并保存在历史',`cupbox.sessionsRead(sessionId).then(s=>s.messages.at(-1).tasks.length===3&&s.messages.at(-1).tasks.every(t=>t.status==='done'))`);
      await capture('19-project-workflow-complete.png');
      await js(`document.querySelector('#workflow-picker').value='direct';document.querySelector('#workflow-picker').dispatchEvent(new Event('change'));document.querySelector('[data-chat-cap="image"]').checked=true;document.querySelector('[data-chat-cap="audio"]').checked=true;document.querySelector('#chat-text').value='同时制作文字、插画与配音';window.mediaSend=sendChat();true`);await js('window.mediaSend');
      await check('同时选择的三种能力全部真实调用',`cupbox.sessionsRead(sessionId).then(s=>s.messages.at(-1).tasks.length===3&&s.messages.at(-1).media.length===2)`);
      const persisted=await js(`cupbox.sessionsRead(sessionId)`);for(const media of persisted.messages.at(-1).media)if(!(await readFile(fileURLToPath(media.url))).length)throw Error('媒体文件为空');
      await js(`openSession(sessionId)`);await check('重新打开历史可见图片和语音播放控件',`document.querySelectorAll('.msg .generated-media img').length>0&&document.querySelectorAll('.msg .generated-media audio').length>0`);
      const image=path.join(process.env.CUPBOX_HOME,'reference.png');await writeFile(image,png);dialog.showOpenDialog=async()=>({canceled:false,filePaths:[image]});
      await js(`document.querySelector('#add-chat-image').click()`);await wait(`document.querySelectorAll('.attachment-chip').length===1`);
      await js(`document.querySelectorAll('[data-chat-cap]').forEach(c=>c.checked=c.dataset.chatCap==='vision');document.querySelector('#chat-text').value='分析这张参考图';sendChat()`);
      if(!calls.some(c=>c.body.messages?.at(-1)?.content?.[1]?.image_url?.url?.startsWith('data:image/png')))throw Error('参考图未送至视觉端点');
      console.log('PASS 视觉图片实际上传到选定模型');
      slow=true;await js(`document.querySelectorAll('[data-chat-cap]').forEach(c=>c.checked=c.dataset.chatCap==='text');document.querySelector('#chat-text').value='取消测试';window.stopSend=sendChat();true`);await wait('sending');await js(`cupbox.chatCancel()`);await js('window.stopSend');
      await check('停止请求后恢复输入与草稿',`!sending&&!document.querySelector('#chat-text').disabled&&document.querySelector('#chat-text').value==='取消测试'`);slow=false;
      failVision=true;await js(`document.querySelector('#add-chat-image').click()`);await wait(`document.querySelectorAll('.attachment-chip').length===1`);
      await js(`document.querySelector('#workflow-picker').value='direct';document.querySelectorAll('[data-chat-cap]').forEach(c=>c.checked=['vision','image'].includes(c.dataset.chatCap));document.querySelector('#chat-text').value='验证失败子项目';sendChat()`);
      await check('单项失败保留其他媒体交付',`cupbox.sessionsRead(sessionId).then(s=>s.messages.at(-1).tasks.some(t=>t.status==='error')&&s.messages.at(-1).tasks.some(t=>t.status==='done'))`);
      failVision=false;
      // Retry only the failed vision task, with a newly attached reference.
      await js(`document.querySelector('#add-chat-image').click()`);await wait(`document.querySelectorAll('.attachment-chip').length===1`);
      const imageCalls=calls.filter(c=>c.url.endsWith('/images/generations')).length;
      await js(`document.querySelector('#workflow-live-grid .workflow-card[data-state="error"] button').click();true`);await wait('sending===false');
      await check('单项重试成功，不重复生成已完成的图片',`cupbox.sessionsRead(sessionId).then(s=>s.messages.at(-1).text.includes('真实')||s.messages.at(-1).tasks?.[0]?.status==='done')`);
      if(calls.filter(c=>c.url.endsWith('/images/generations')).length!==imageCalls)throw Error('重试重复调用了成功项');
      const exportPath=path.join(process.env.CUPBOX_HOME,'export.md');dialog.showSaveDialog=async()=>({canceled:false,filePath:exportPath});await js(`cupbox.chatExport(sessionId)`);if(!(await readFile(exportPath,'utf8')).includes('子项目')&&!(await readFile(exportPath,'utf8')).includes('产品设计'))throw Error('未导出子项目');console.log('PASS 对话与子项目导出');
      await js(`cupbox.win.minimize()`);await new Promise(r=>setTimeout(r,300));if(!win.isMinimized())throw Error('最小化失败');win.restore();win.hide();console.log('PASS 原生窗口最小化');
      if(errors.length)throw Error(errors.join('\n'));console.log('PASS no renderer errors');server.closeAllConnections();server.close();app.exit(0);
    }catch(e){console.error(e);server.closeAllConnections();server.close();app.exit(1);}
  });
});
await import(process.argv.includes('--packaged')?pathToFileURL(path.resolve('release/Cupbox可视化/resources/app/desktop/main.js')).href:'./main.js');
