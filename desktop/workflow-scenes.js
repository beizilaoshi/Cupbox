export const SCENES={
  general:{name:'通用任务',brief:'围绕目标交付可用结果，明确输入输出和未解决问题。',criteria:'交付完整，事实与假设区分清楚，未完成项明确。'},
  coding:{name:'开发与修复',brief:'先检查现有目录与代码，再设计接口、实现模块、整合和验证。依赖共享接口的模块应串联。执行模式下使用文件工具交付真实文件，保留已有代码。',criteria:'文件实际存在，接口匹配，说明验证方式、已运行检查及未验证风险；没有执行的测试不能声称通过。'},
  research:{name:'调研与分析',brief:'拆分待回答的问题、证据收集、相互核验和结论。仅使用用户材料或真正读取的来源；没有网络检索工具时明确资料限制，不编造链接。',criteria:'结论有证据和来源说明，区分已核实信息与推断，包含分歧与局限。'},
  writing:{name:'写作与文案',brief:'先确定读者、目的、风格和提纲，再写初稿，最后检查结构、语气和冗余。各章节依赖同一提纲。',criteria:'符合受众和语气，结构连贯，无占位符、重复段落或虚构引用。'},
  data:{name:'数据与表格',brief:'先读取实际数据和字段，检查缺失值与口径，再计算、核对和输出结论。不得虚构数据或仅凭提示猜测统计结果。',criteria:'字段与计算口径清楚，结果能从数据复查，异常和缺失已说明。'},
  creative:{name:'多媒体创作',brief:'先形成一致的创意简报、色彩与角色说明，再将简报传递到绘图、配音或视频任务，保持素材一致。语音输入应为可直接朗读的文稿。',criteria:'素材围绕同一主题，角色与风格一致，实际生成文件可用，未生成素材明确列出。'},
};
export function resolveScene(scene,prompt){
  if(SCENES[scene])return scene;
  if(/代码|开发|修复|程序|组件|网站|应用|bug|code|repo/i.test(prompt))return 'coding';
  if(/数据|统计|表格|csv|excel|分析数据/i.test(prompt))return 'data';
  if(/插画|配音|分镜|视频|海报|绘图/i.test(prompt))return 'creative';
  if(/调研|研究|对比|调查|来源/i.test(prompt))return 'research';
  if(/文案|文章|写作|剧本|报告|博客/i.test(prompt))return 'writing';
  return 'general';
}
export function validatePlan(plan,capabilities){
  if(!Array.isArray(plan?.tasks)||!plan.tasks.length||plan.tasks.length>6)throw Error('规划应包含 1–6 个子项目');
  const tasks=plan.tasks.map((t,i)=>({id:String(t.id||`task-${i+1}`),title:String(t.title||'').slice(0,100),prompt:String(t.prompt||'').slice(0,12000),cap:t.cap,dependsOn:Array.isArray(t.dependsOn)?[...new Set(t.dependsOn.map(String))]:[]}));
  const ids=new Set(tasks.map(t=>t.id));
  if(ids.size!==tasks.length||tasks.some(t=>!t.title||!t.prompt||!capabilities.includes(t.cap)||t.dependsOn.some(d=>!ids.has(d)||d===t.id)))throw Error('规划包含重复任务、无效能力或错误依赖');
  const visited=new Set(),visiting=new Set();
  function visit(id){if(visiting.has(id))throw Error('任务依赖包含循环，请重新规划');if(visited.has(id))return;visiting.add(id);for(const d of tasks.find(t=>t.id===id).dependsOn)visit(d);visiting.delete(id);visited.add(id);}
  tasks.forEach(t=>visit(t.id));return tasks;
}
