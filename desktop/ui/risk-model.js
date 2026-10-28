/* Shared presentation rules. Enforcement remains in the main process. */
"use strict";
window.CupboxRisk = (() => {
  function describe(tool, args = {}, risk = 'system') {
    const critical = (title, consequence, action) => ({level:'danger',label:'高风险操作',title,consequence,action,ack:true});
    const warn = (title, consequence, action='批准本次操作') => ({level:'warning',label:'需要你的确认',title,consequence,action,ack:false});
    if (/^(word_|ppt_|excel_|pdf_|office_)/.test(tool)) return (/_read$/.test(tool)||tool==='excel_analyze')?{level:'info',label:'办公资料读取',title:'允许读取办公文档？',consequence:'提取的文字、表格和备注可能提交给当前模型；不会执行宏、外部链接或公式，不代表图片已识别。',action:'允许本次读取',ack:false}:warn('允许写入办公文件？','将修改或生成真实 Word、PPT、Excel、PDF 或交换文件。请核对内容摘要与路径；覆盖会替换原文件，复杂 Excel 图表和透视表可能无法完整保留，建议另存。','批准本次写入');
    if(tool.startsWith('desktop_'))return critical('桌面协作会影响真实窗口','只允许你手动授权的目标窗口。截图和OCR可能含隐私；视觉分析会发送截图到所选模型。鼠标和按键可能发送、删除或执行内容；完全控制也需逐次批准。','核对并批准本次');
    if (tool === 'permission_full') return critical('允许更多操作自动执行？','普通文件修改将不再逐次询问。Shell、敏感文件和项目策略仍需单独批准。只在信任当前任务时开启。','开启完全控制');
    if (tool === 'environment_native') return warn('切换到本机运行？','AI 将使用真实工作文件夹，并可请求运行终端、项目脚本和系统工具。已批准的程序可以影响本机。','切换到本机');
    if (/删除|清空/.test(tool) || tool === 'fs_rm') return critical('确认删除这项内容？',tool === 'fs_rm'?'目标文件或目录将从原位置移除。系统回收站与操作备份用于恢复，请先核对路径和递归选项。':'这段任务记录将被永久移除，无法通过应用撤销。需要保留时，请先导出。','确认删除');
    if (tool === 'proc' && args.action === 'kill') return critical('结束这个进程？','进程会被终止，未保存的内容可能丢失。请核对进程名称、PID 和端口。','结束进程');
    if (/策略|policy/i.test(tool)) return critical('更改项目的授权边界？','命令白名单、可写目录或联网域名可能改变。保存后清除已有会话授权，请逐项核对。','确认更新策略');
    if (/敏感/.test(tool)) return warn('允许访问敏感文件？','文件可能包含密钥或凭据。读取的内容可能进入 AI 上下文，并发送给你配置的模型服务。','允许本次访问');
    if (['shell','run','pty_spawn','pty_write','pkg','test'].includes(tool)) return {...warn('允许在本机执行代码？','命令和项目依赖可以读写本机文件或访问网络。请核对命令及运行目录；这不是操作系统沙箱。','批准本次执行'),level:'danger',label:'本机代码执行'};
    if (tool === 'http') return warn('允许向这个服务发送请求？','请求内容将发送到下方域名。请确认目标、方法及正文，不要发送无关凭据。','允许本次请求');
    if (tool === 'clipboard_image' || tool === 'clip') return warn('允许访问系统剪贴板？','读取可能将私人内容加入任务；写入将替换剪贴板当前内容。');
    if (tool === 'git') return warn('允许修改 Git 仓库？','暂存、提交、切换分支或 stash 会改变仓库状态。请核对当前变更和执行参数。');
    if (risk === 'write') return warn('允许修改这些文件？','操作会写入或移动目标内容。请检查下方预览、影响路径和工作目录。','批准本次修改');
    if (risk === 'read') return {level:'info',label:'读取与预览',title:'允许读取这些内容？',consequence:'读取结果将提供给当前任务；请确认其中不含不希望发送给模型的内容。',action:'允许本次读取',ack:false};
    return warn('允许执行这项操作？','此工具会访问本机能力。请核对操作参数和目标范围。');
  }
  function targets(args) {
    return ['source','path','from','to','input','output','saveTo','url','command','cwd','pid','name'].filter(k=>args[k]!==undefined&&typeof args[k]!=='object').map(k=>[k,String(args[k]).slice(0,3000)]);
  }
  return {describe,targets};
})();
