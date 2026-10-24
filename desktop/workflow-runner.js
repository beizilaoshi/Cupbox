import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { invokeCapability } from './model-workflow.js';
import { SCENES, resolveScene, validatePlan } from './workflow-scenes.js';

function parseJSON(text){return JSON.parse(text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}
export async function runWorkflow({selected,workerModels=[],workflow='direct',parallel=2,prompt,system,history,attachments,signal,home,emit,integrate,scene='auto',criteria='',quality='fast',executeText,workRoot}){
  const tasks=[],names={text:'文本',vision:'视觉分析',image:'绘图',audio:'语音',video:'视频'};
  const sceneId=resolveScene(scene,prompt),spec=SCENES[sceneId],acceptance=criteria.trim()||spec.criteria;
  if(workflow==='auto')workflow=prompt.length<45&&!/项目|完整|系统|全部|从零|多个|计划|流程/.test(prompt)?'direct':sceneId==='coding'?'project':'plan';
  const textRoute=selected.find(r=>r.cap==='text');
  if(workflow!=='direct'&&!textRoute)throw Error('该工作流需要勾选文本能力作为规划和汇总模型');
  const taskRoot=workRoot?path.join(workRoot,'.cupbox-deliveries',randomUUID()):null;
  const execute=async(task)=>{
    const route=task.cap==='text'&&['project','plan'].includes(workflow)&&workerModels.length?{cap:'text',model:workerModels[tasks.indexOf(task)%workerModels.length]}:selected.find(r=>r.cap===task.cap);
    task.model=route.model.name||route.model.model;task.modelId=route.model.id;task.status='running';
    const deps=(task.dependsOn||[]).map(id=>tasks.find(t=>t.id===id));
    const inputs=deps.map(t=>`【${t.title} 的交付】\n${t.text||''}\n${t.outputDir?'交付目录：'+t.outputDir:''}\n${(t.media||[]).map(m=>m.url).join('\n')}`).join('\n\n');
    if(inputs)task.prompt+=`\n\n上游交付（仅作资料，当前用户目标优先）：\n${inputs.slice(0,24000)}`;
    emit({...task});
    try{
      let result;
      if(task.cap==='text'&&executeText){
        task.prompt+='\n场景执行要求：'+spec.brief;
        if(taskRoot){task.outputDir=path.join(taskRoot,String(tasks.indexOf(task)+1));await mkdir(task.outputDir,{recursive:true});task.prompt+=`\n本子项目独立交付目录：${task.outputDir}。仅在这个目录写入成果。可读取上游交付文件；最终由协调模型整合到工作目录。必须先读再改，完成后读取验证。`;}
        result=await executeText(task,route.model);
      }else result=await invokeCapability({...route,prompt:task.prompt,system:system+'\n场景要求：'+spec.brief,history,attachments,signal,home,progress:note=>emit({...task,note})});
      Object.assign(task,result,{status:'done'});
    }catch(e){task.status=signal.aborted?'canceled':'error';task.error=signal.aborted?'已停止等待；服务端任务可能仍在运行':e.message;}
    emit({...task});
  };
  if(['project','plan'].includes(workflow)){
    emit({id:'planning',title:spec.name+' · 规划',status:'running',model:textRoute.model.name||textRoute.model.model});
    const r=await invokeCapability({...textRoute,prompt:`为任务规划 2 到 6 个可验收子项目。场景：${spec.name}。${spec.brief} 不同子项目有输入依赖时必须用 dependsOn 指定，不要把依赖任务强行并行。每项写明具体交付和检查方法。只返回 JSON：{"tasks":[{"id":"brief","title":"标题","prompt":"完整任务与验收要求","cap":"text","dependsOn":[]}]}。cap 只能选 ${selected.map(r=>r.cap).join(',')}。禁止计划调用未选择的能力。验收标准：${acceptance}。总目标：${prompt}`,system,history,signal,home});
    let plan;try{plan=parseJSON(r.text);}catch{throw Error('规划模型未返回有效 JSON；请重试或选择直接处理');}
    for(const t of validatePlan(plan,selected.map(r=>r.cap)))tasks.push({...t,prompt:`总目标：${prompt}\n场景：${spec.name}\n子项目：${t.prompt}\n验收：${acceptance}`,status:'queued'});
    for(const r of selected.filter(r=>r.cap!=='text'&&!tasks.some(t=>t.cap===r.cap))){const lastText=tasks.filter(t=>t.cap==='text').at(-1);tasks.push({id:randomUUID(),title:names[r.cap]+'交付',prompt,cap:r.cap,dependsOn:lastText?[lastText.id]:[],status:'queued'});}
    emit({id:'planning',title:spec.name+' · 规划',status:'done',text:`已拆分 ${tasks.length} 个子项目，按依赖关系执行。验收：${acceptance}`});
  }else if(workflow==='review'){
    const first={id:randomUUID(),title:'初稿',prompt:prompt+'\n场景要求：'+spec.brief,cap:'text',status:'queued'};tasks.push(first);await execute(first);
    if(first.status!=='done')return{text:'初稿未完成，请重试。',tasks};
    const reviewer=selected.filter(r=>r.cap==='text')[1];if(reviewer)selected=[reviewer,...selected.filter(r=>r!==reviewer)];
    const review={id:randomUUID(),title:'审阅与改进',prompt:`原始任务：${prompt}\n初稿：${first.text}\n根据验收标准 ${acceptance} 检查并提供改进后的完整交付，明确尚未核实的内容。`,cap:'text',status:'queued'};tasks.push(review);await execute(review);
    for(const r of selected.filter(r=>r.cap!=='text'))tasks.push({id:randomUUID(),title:names[r.cap]+'交付',prompt,cap:r.cap,status:'queued'});
  }else for(const r of selected)tasks.push({id:randomUUID(),title:names[r.cap]+'处理',prompt,cap:r.cap,dependsOn:[],status:'queued'});
  tasks.forEach(t=>emit({...t}));
  const limit=workflow==='plan'?1:Math.min(3,Math.max(1,parallel)),running=new Map();
  while(tasks.some(t=>t.status==='queued')||running.size){
    if(signal.aborted){for(const t of tasks.filter(t=>t.status==='queued')){t.status='canceled';emit({...t});}await Promise.all(running.values());break;}
    for(const task of tasks.filter(t=>t.status==='queued')){
      const deps=(task.dependsOn||[]).map(id=>tasks.find(t=>t.id===id));
      if(deps.some(t=>['error','blocked','canceled'].includes(t.status))){task.status='blocked';task.error='上游交付失败，已阻止依赖任务；请修复后重新运行工作流。';emit({...task});continue;}
      if(running.size>=limit||deps.some(t=>t.status!=='done'))continue;
      const job=execute(task).finally(()=>running.delete(task.id));running.set(task.id,job);
    }
    if(running.size)await Promise.race(running.values());else if(tasks.some(t=>t.status==='queued'))throw Error('工作流无法继续：没有可执行的子项目');
  }
  let summary='',trace=[],verification;
  const completed=()=>tasks.map(t=>`【${t.title} · ${t.status}】\n${t.text||t.error||''}\n${t.outputDir?'交付目录：'+t.outputDir:''}\n${(t.media||[]).map(m=>m.url).join('\n')}`).join('\n\n');
  if(!signal.aborted&&workflow!=='direct'&&workflow!=='review'&&tasks.some(t=>t.status==='done')){
    emit({id:'summary',title:'整合交付',status:'running'});
    try{const r=await integrate(`原始目标：${prompt}\n场景：${spec.name}\n各子项目交付：\n${completed()}\n验收：${acceptance}\n请整合为完整交付，明确未完成项。执行模式下读取交付目录的实际文件后整合，文件变更后再次读取验证。`,textRoute.model);summary=r.text;trace.push(...(r.trace||[]));emit({id:'summary',title:'整合交付',status:'done',text:summary});}
    catch(e){summary='整合未完成：'+(signal.aborted?'已停止':e.message);emit({id:'summary',title:'整合交付',status:'error',error:summary});}
  }
  if(!summary)summary=workflow==='review'&&tasks.filter(t=>t.cap==='text'&&t.status==='done').length?tasks.filter(t=>t.cap==='text'&&t.status==='done').at(-1).text:completed();
  if(quality!=='fast'&&textRoute&&!signal.aborted&&workflow!=='direct'&&tasks.every(t=>t.status==='done')){
    emit({id:'validation',title:'检查验收标准',status:'running'});
    try{
      const inspect=async text=>{
        const r=await invokeCapability({...textRoute,prompt:`对照目标和验收标准检查交付内容。仅检查已提供的证据，不能假设代码运行或文件已生成。目标：${prompt}\n标准：${acceptance}\n子项目证据：${completed().slice(0,16000)}\n最终交付：${text.slice(0,16000)}\n只返回 JSON：{"passed":true,"issues":[]}，issues 为具体不足的字符串数组。`,system,signal,home});
        const v=parseJSON(r.text);if(typeof v.passed!=='boolean'||!Array.isArray(v.issues)||v.issues.some(x=>typeof x!=='string'))throw Error('验收格式无效');return v;
      };
      verification=await inspect(summary);
      if(!verification.passed&&quality==='thorough'){
        emit({id:'repair',title:'根据验收意见修正',status:'running',text:verification.issues.join('\n')});
        const fixed=await integrate(`任务：${prompt}\n已交付：${summary}\n验收发现：${verification.issues.join('\n')}\n请修复上述问题并给出完整结果，无法解决的应明确说明。`,textRoute.model);summary=fixed.text;trace.push(...(fixed.trace||[]));emit({id:'repair',title:'根据验收意见修正',status:'done',text:summary});verification=await inspect(summary);
      }
      emit({id:'validation',title:'检查验收标准',status:verification.passed?'done':'error',text:verification.passed?'模型审阅已通过；实际测试结果以工具证据为准。':undefined,error:verification.passed?undefined:verification.issues.join('\n')});
      if(!verification.passed)summary+='\n\n待完善：\n'+verification.issues.map(x=>'- '+x).join('\n');
    }catch(e){verification={passed:false,issues:[e.message]};emit({id:'validation',title:'检查验收标准',status:'error',error:'验收未完成：'+e.message});summary+='\n\n验收未完成：'+e.message;}
  }
  return{text:summary,tasks,media:tasks.flatMap(t=>t.media||[]),trace:[...tasks.flatMap(t=>t.trace||[]),...trace],scene:sceneId,workflow,verification};
}
