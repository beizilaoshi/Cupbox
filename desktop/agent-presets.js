export const AGENT_PRESETS = [
  {id:'standard',name:'标准模式',tag:'通用',description:'处理问答、文件和资料，适合大多数日常任务。根据目标使用搜索、文件和终端工具。',detail:'先理解目标与现有资料，再选择必要工具，完成后说明结果和未解决的问题。',usage:'选择此预设，在对话中描述目标；涉及本地文件时先选择工作目录。',prompt:'围绕用户目标工作，先检查可用资料，再使用必要工具完成任务。交付清楚的结果，并如实说明未验证或未完成的部分。'},
  {id:'march7th',name:'三月七',tag:'游戏助手',description:'围绕星穹铁道安排日常、体力和周常任务。连接本机三月七小助手，使用已配置的任务与自定义流程。',detail:'协助梳理任务顺序、解释运行日志与排查配置问题。游戏任务从「配置工作流」手动启动，并可查看日志、停止任务。',usage:'先打开「配置工作流」，选择 March7th Assistant.exe 并配置任务，再保存运行。可在对话中粘贴日志请求排查。',prompt:'你是三月七游戏工作流助手。帮助用户安排星穹铁道日常、体力和周常任务，解释三月七小助手配置与日志。运行入口在设置中的三月七工作流，需要用户选择本机程序和任务后点击运行。对话没有专用小助手启动工具，不能声称已启动或已完成游戏任务，也不要通过终端绕过专用入口。'},
  {id:'pentest',name:'渗透模式',tag:'安全测试',description:'审查本地代码、配置和测试证据。主动渗透测试固定为127.0.0.1，并从专用入口逐次确认。',detail:'先明确目标、授权范围和测试环境，再检查代码、配置或用户提供的测试结果；按影响和证据整理发现。',usage:'先提交本地代码或日志进行审查；需要实际检测时打开「配置本机测试」，启用固定127.0.0.1的专用 Agent 并确认端口。',prompt:'你是安全测试与防御审查助手。先明确授权范围、目标和测试环境，再根据实际读取的代码、配置、日志或工具结果分析风险。优先采用影响小、可复查的验证方式。报告复现条件、证据、影响和修复建议，区分猜测与已验证漏洞。不要扩大用户授权范围。'},
  {id:'coding',name:'代码模式',tag:'开发',description:'阅读现有项目，定位问题、实现功能并验证修改。适合修复 Bug、重构代码与完成开发任务。',detail:'先读代码与项目约定，确定改动范围，再实施并运行合适的检查；保留现有改动并说明验证结果。',usage:'选择项目目录，描述需要实现的功能或报错，例如「修复登录失败，保留当前页面布局」。',prompt:'你是代码开发与修复助手。先读取项目结构、约定和相关代码，保留已有改动，围绕用户目标实现完整修改。执行合适的构建或测试，记录实际证据；未执行检查不得声称通过。交付时解释变更、验证结果和剩余限制。'},
  {id:'creative',name:'创造模式',tag:'创作',description:'把想法整理成文案、故事、页面或多媒体方案。先统一主题与风格，再制作内容并逐步打磨。',detail:'明确受众、目的和表达风格，形成创意方向，制作完整内容，并检查结构、细节与素材的一致性。',usage:'描述想做的内容、读者和风格；图片、音频或视频生成需在对话中选择相应模型能力。',prompt:'你是创意与内容制作助手。明确目标受众、用途和风格，形成一致的创意方向，再交付完整可用的文案、设计方案或素材。保持角色、语气和视觉描述一致。实际生成媒体需要已选择的相应模型能力；未生成的素材不能声称已交付。'},
];

export const PRESET_RISKS={standard:{level:'medium',label:'可能读写文件',text:'批准读取的资料可能提交给模型；文件修改与本机工具仍按当前权限设置处理。'},coding:{level:'high',label:'文件与命令风险',text:'可能修改项目文件、安装依赖或请求执行命令。请确认工作目录并备份重要文件；每次操作仍受批准规则约束。'},pentest:{level:'high',label:'渗透测试 · 高风险',text:'主动检测可能使本机服务异常、产生测试流量或影响数据。仅限 127.0.0.1，实际检测必须从专用入口逐次确认；此对话只允许资料审查。'},march7th:{level:'high',label:'自动化 · 高风险',text:'小助手运行可能占用鼠标键盘、操作游戏账号，并受游戏服务条款约束。启动与停止必须从三月七工作流确认，切换预设不会启动程序。'},creative:{level:'low',label:'内容与隐私',text:'素材与设定可能提交给所选模型；生成内容需自行核对，媒体能力仍取决于模型配置。'}};
export function validateCustomPreset(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['id','name','base','description','prompt'].includes(k)))throw Error('自定义预设字段无效');
 if(value.id!==undefined&&!/^custom-[a-zA-Z0-9-]{8,64}$/.test(value.id))throw Error('自定义预设 ID 无效');
 if(!AGENT_PRESETS.some(p=>p.id===value.base))throw Error('请选择有效的基础预设');
 for(const [key,max]of [['name',40],['description',240],['prompt',12000]])if(typeof value[key]!=='string'||value[key].length>max||key!=='description'&&!value[key].trim())throw Error('名称需为1～40字，说明最多240字，角色指令需为1～12000字');
 return{...(value.id?{id:value.id}:{}),name:value.name.trim(),base:value.base,description:value.description.trim(),prompt:value.prompt.trim()};
}
export function customPresetList(values){if(!Array.isArray(values)||values.length>20)return[];const out=[];for(const item of values){try{const p=validateCustomPreset(item);if(p.id&&!out.some(x=>x.id===p.id))out.push(p);}catch{}}return out;}
export function resolveAgentPreset(id,custom=[]) {
 const builtin=AGENT_PRESETS.find(p=>p.id===id);if(builtin)return{...builtin,risk:PRESET_RISKS[id]};
 const own=customPresetList(custom).find(p=>p.id===id);if(!own)return{...AGENT_PRESETS[0],risk:PRESET_RISKS.standard};const base=AGENT_PRESETS.find(p=>p.id===own.base);
 return{...base,...own,custom:true,policyId:base.id,customPrompt:own.prompt,prompt:base.prompt+'\n【用户自定义工作方式】\n'+own.prompt,detail:base.detail+'\n\n自定义指令：\n'+own.prompt,risk:PRESET_RISKS[base.id]};
}
export const AGENT_PLUGINS=[
 {id:'persona',name:'智能体角色设定',description:'应用当前预设的角色、表达习惯与自定义指令。关闭后仍保留系统安全规则和基础预设的硬性限制。',risk:'low'},
 {id:'time-context',name:'时间感知',description:'向模型提供本机当前日期、时间与时区，方便理解今天、明天等时间表达。',risk:'low'},
 {id:'tool-files',name:'工作区文件工具',description:'允许 AI 请求读取、创建和修改工作区文件。读取内容可能提交给模型，写入仍需通过权限和预览校验。',risk:'high'},
 {id:'tool-terminal',name:'终端与 PowerShell',description:'允许 AI 请求执行本机命令和终端输入，可能修改文件或启动程序。命令批准与工作区限制始终有效。',risk:'high'},
 {id:'tool-web',name:'联网与搜索',description:'允许请求搜索、网页和 HTTP 工具。查询和请求内容可能发送给外部服务，域名授权仍然生效。',risk:'medium'},
 {id:'tool-computer',name:'桌面视觉与操控',description:'仅在已授权窗口内截图、识别或操控。开关本身不授予读屏和鼠标权限，需在权限设置中另行开启。',risk:'high'}
];
export function agentPluginEnabled(states,presetId,pluginId){return states?.[presetId]?.[pluginId]!==false;}
export function agentPresetPrompt(id,custom=[],states) {
 const preset=resolveAgentPreset(id,custom),policy=preset.policyId||preset.id;
 const boundary=policy==='pentest'?'主动渗透测试的目标严格固定为127.0.0.1，必须从本机渗透测试入口人工选择端口并确认。本对话仅能读取资料与分析，不能用终端、HTTP、浏览器、桌面控制或其他工具变更目标或绕过专用入口。':policy==='march7th'?'本对话仅分析配置、任务和用户提供的日志。启动与停止只通过三月七工作流的本机界面完成，不允许使用终端、桌面或其他工具绕过启动确认。':'';
 const role=agentPluginEnabled(states,preset.id,'persona')?`【Agent 预设：${preset.name}】\n${preset.prompt}`:'';
 const time=states&&agentPluginEnabled(states,preset.id,'time-context')?`当前本机时间：${new Date().toISOString()}；本机时区：${Intl.DateTimeFormat().resolvedOptions().timeZone}。`:'';
 const disabled=states?AGENT_PLUGINS.filter(p=>p.id.startsWith('tool-')&&!agentPluginEnabled(states,preset.id,p.id)).map(p=>p.name):[];
 return[role,boundary,time,disabled.length?'此预设已关闭：'+disabled.join('、')+'。不要请求这些工具，也不要用其他工具绕过对应开关。':''].filter(Boolean).join('\n');
}

// A behavior preset cannot replace a specialized launcher's authorization boundary.
const REVIEW_TOOLS=new Set(['hash','time','codec','csv','search','word_read','ppt_read','excel_read','excel_analyze','pdf_read','fs_read','fs_stat','grep','diff','fs_read_text_file','fs_read_multiple_files','fs_list_directory','fs_list_directory_with_sizes','fs_directory_tree','fs_search_files','fs_get_file_info']);
export function agentPresetAllowsTool(id,name,custom=[],states){
  const preset=resolveAgentPreset(id,custom);if(['pentest','march7th'].includes(preset.policyId||preset.id)&&!REVIEW_TOOLS.has(name))return false;
  const group=/^desktop_/.test(name)?'tool-computer':/^(shell|run|proc|pty_|git$|pkg$|test$)/.test(name)?'tool-terminal':/^(http|web_)/.test(name)?'tool-web':/^(word_|ppt_|excel_|pdf_|office_|fs_|grep$|diff$|hash$|search$|ocr$|csv$|rename$|organize$|obfuscate$|zip$)/.test(name)?'tool-files':null;
  return !group||agentPluginEnabled(states,preset.id,group);
}
