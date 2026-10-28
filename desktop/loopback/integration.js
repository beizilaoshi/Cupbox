import {uiMessageBox} from '../ui-prompts.js';
import path from 'node:path';import {pathToFileURL} from 'node:url';
import {ipcMain,BrowserWindow,dialog,clipboard} from 'electron';
import {LoopbackAudit} from './agent.js';import {strictLoopbackURL} from './network.js';
const consentVersion=1;
export function installLoopbackAudit({app,desktopDir,getPrefs,savePrefs,choices,plugins}){
  let owner;const trusted=event=>{if(event.sender.isDestroyed()||event.sender.getURL()!==pathToFileURL(path.join(desktopDir,'ui/index.html')).href)throw Error('本机渗透测试 Agent 只接受主窗口中的本地操作');};
  const service=new LoopbackAudit({getPrefs,plugins,resolveModel:async id=>{const all=(await choices.records()).all,model=all.find(m=>m.id===id&&m.enabled!==false&&m.capabilities?.includes('text'));if(!model)throw Error('请选择可用的本机文本模型');strictLoopbackURL(model.baseUrl);return model;},notify:state=>{if(owner&&!owner.isDestroyed())owner.send('audit:progress',state);}});
  const state=async()=>{const enabled=await service.enabled(),models=[];if(enabled)for(const m of (await choices.records()).all){try{if(m.enabled===false||!m.capabilities?.includes('text')||m.provider!=='openai-compatible')continue;strictLoopbackURL(m.baseUrl);models.push({id:m.id,name:m.name||m.model,baseUrl:m.baseUrl});}catch{/* Cloud and alias endpoints are deliberately omitted. */}}return{enabled,target:'127.0.0.1',models,running:Boolean(service.controller)};};
  const handle=(name,fn)=>ipcMain.handle(name,async(event,p)=>{try{trusted(event);return{ok:true,...await fn(event,p)};}catch(e){return{ok:false,error:e.name==='AbortError'?'检查已停止，后续连接已取消。':/HTTP\s*\d|API key|api_key|sk-[a-z0-9_-]{8}/i.test(e.message||'')?'检查或本机模型请求失败；已停止，未重试。':String(e.message||'本机检查失败').slice(0,400)};}});
  handle('audit:state',()=>state());
  handle('audit:enable',async(event,p)=>{if(!p||typeof p.enabled!=='boolean'||Object.keys(p).some(k=>k!=='enabled'))throw Error('开启参数无效');if(p.enabled&&!await service.enabled()){
    const r=await uiMessageBox(BrowserWindow.fromWebContents(event.sender),{type:'warning',title:'开启本机渗透测试 Agent',message:'只对你有权测试的 127.0.0.1 服务进行检查',detail:'本功能直接连接本机服务，文件沙箱不会隔离这些服务。端口连接、HTTP请求和配置暴露检查仍可能触发本机服务日志、限流或异常行为。仅确认的端口与三个固定路径可被访问；不跟随重定向，不提供命令、文件或记忆工具。\n\n默认不运行；开启后仍需手动确认端口再开始。模型规划只能选择 http://127.0.0.1 的本机兼容模型，不使用云模型。\n\n本机安全头提示不等于已确认漏洞。关闭开关会取消当前检查并隐藏入口。',buttons:['保持关闭','了解风险并开启'],defaultId:0,cancelId:0,noLink:true});if(r.response!==1)return{...await state(),cancelled:true};}
    service.cancel();await savePrefs({localAuditEnabled:p.enabled,localAuditConsentVersion:p.enabled?consentVersion:0});return state();
  });
  handle('audit:run',async(event,p)=>{if(p?.exposureChecks===true){if(!await service.enabled())throw Error('请先开启本机渗透测试 Agent');const r=await uiMessageBox(BrowserWindow.fromWebContents(event.sender),{type:'warning',title:'高风险：配置暴露探测',message:'确认本轮读取配置暴露探测响应？',detail:'目标仅为 127.0.0.1，端口：'+(Array.isArray(p.ports)?p.ports.join(', '):'无效端口')+'\n固定请求：GET /.git/HEAD 与 GET /.env\n\n这些路径可能返回密钥或内部配置。响应仅在内存中做规则判断，正文和配置值不会进入报告或模型。请求仍可能触发日志、告警、限流或服务缺陷。请确认服务归属与影响；取消不会启动本轮检查。',buttons:['取消本轮','确认本轮探测'],cancelId:0});if(r.response!==1)throw Error('已取消配置暴露探测，尚未启动本轮检查');}owner=event.sender;const close=()=>service.cancel();event.sender.once('destroyed',close);try{return{report:await service.run(p)};}finally{event.sender.removeListener('destroyed',close);}});
  handle('audit:cancel',()=>{service.cancel();return{cancelled:true};});
  handle('audit:copy',()=>{if(!service.last)throw Error('还没有已完成的检查报告');clipboard.writeText(JSON.stringify(service.last,null,2));return{copied:true};});
  app.on('before-quit',()=>service.cancel());return service;
}
