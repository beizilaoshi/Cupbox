export const SCENES={
  office_templates:{name:'模板批量填充',brief:'先 word_read 检查真实 DOCX 模板和变量，再 word_template/word_mailmerge 预览生成；命中缺失或目标冲突应停止。批量最多20份，源模板保留，提交后抽查真实输出与变量，不把说明当成已生成文件。',criteria:'真实输出存在，变量准确，模板与原数据保留，失败项明确。'},
  office_clean:{name:'表格清洗与统计',brief:'先 excel_analyze 核实缺失、重复和数值，再 excel_transform 筛选、排序、去重，必要时 excel_format 美化；excel_merge 只合并相同表头。公式单元格不能用过期缓存猜测；统计使用本地工具计算。输出默认另存，预览提交后再核对。',criteria:'输入输出行数与统计可追溯，原文件保留，输出已读回。'},
  office_pdf:{name:'PDF 整理',brief:'pdf_read 只提取文字层，扫描件另需 OCR。pdf_merge/pdf_extract/pdf_stamp 处理本机 PDF，pdf_create 仅制作文字报告。先预览后批准提交，核对页数页序；不声称保留所有签名表单，不把水印当脱敏，不执行脚本或外链。',criteria:'输出 PDF 实际存在，页数页序符合要求，原件保留，限制明确。'},
  office_exchange:{name:'格式交换与归档',brief:'使用 office_import_csv 导入 UTF-8 CSV/TSV；office_export 导出 Office 文字或表格，不是保真视觉转换。编号默认保留文字，CSV 出口需防公式注入，先预览提交，再读取实际文件检查；pdf_create 仅生成文字 PDF。',criteria:'真实输出存在，文字与编号正确，转换限制明确，已读回核对。'},
  office_word:{name:'Word 报告',brief:'使用 word_read 读取真实资料，用 word_create 制作真实 DOCX，支持标题、段落、项目符号与表格。先预览，使用相同参数与令牌按批准规则提交，再 word_read 读回。默认另存，不执行宏，不把文字回复当成文件。',criteria:'DOCX 实际存在，内容与来源一致，已读回核对，并列出文件路径和未验证项。'},
  office_ppt:{name:'PPT 汇报',brief:'先核对资料与提纲，用 ppt_create 生成真实 PPTX，每页简洁，包含必要备注，再 ppt_read 核对真实页序。先预览、再按批准规则提交；文字提纲不是已完成的 PPT。',criteria:'PPTX 实际存在，结构和页序合理，数据有依据，已读回核对。'},
  office_excel:{name:'Excel 整理',brief:'先 excel_read 读取工作表及数据区域，检查类型、缺失与口径，用 excel_create/excel_update 另存真实 XLSX。先预览，再按批准规则提交，然后读取关键区域验证；程序不计算公式，缓存值可能过期，不能编造结果。',criteria:'XLSX 实际存在，原文件保留，字段与数据正确，已读回核对，公式计算限制明确。'},
  office_bundle:{name:'办公交付套件',brief:'先读取共同资料并统一数据、提纲与配色，再用 word_create/ppt_create/excel_create 制作真实三件套；依赖任务用 dependsOn 串联。每个写入先预览、按批准规则提交，再用对应读取工具核对。各子项目只写自己的交付目录，协调模型核对整合真实文件；不能只交文字方案。',criteria:'DOCX/PPTX/XLSX 三份真实文件存在并读回，共同数据一致，交付路径与未完成项清楚。'},
  general:{name:'通用任务',brief:'围绕目标交付可用结果，明确输入输出和未解决问题。',criteria:'交付完整，事实与假设区分清楚，未完成项明确。'},
  coding:{name:'开发与修复',brief:'先检查现有目录与代码，再设计接口、实现模块、整合和验证。依赖共享接口的模块应串联。执行模式下使用文件工具交付真实文件，保留已有代码。',criteria:'文件实际存在，接口匹配，说明验证方式、已运行检查及未验证风险；没有执行的测试不能声称通过。'},
  research:{name:'调研与分析',brief:'拆分待回答的问题、证据收集、相互核验和结论。仅使用用户材料或真正读取的来源；没有网络检索工具时明确资料限制，不编造链接。',criteria:'结论有证据和来源说明，区分已核实信息与推断，包含分歧与局限。'},
  writing:{name:'写作与文案',brief:'先确定读者、目的、风格和提纲，再写初稿，最后检查结构、语气和冗余。各章节依赖同一提纲。',criteria:'符合受众和语气，结构连贯，无占位符、重复段落或虚构引用。'},
  data:{name:'数据与表格',brief:'先读取实际数据和字段，检查缺失值与口径，再计算、核对和输出结论。不得虚构数据或仅凭提示猜测统计结果。',criteria:'字段与计算口径清楚，结果能从数据复查，异常和缺失已说明。'},
  creative:{name:'多媒体创作',brief:'先形成一致的创意简报、色彩与角色说明，再将简报传递到绘图、配音或视频任务，保持素材一致。语音输入应为可直接朗读的文稿。',criteria:'素材围绕同一主题，角色与风格一致，实际生成文件可用，未生成素材明确列出。'},
};
export function resolveScene(scene,prompt){
  if(SCENES[scene])return scene;
  if(/PDF|\.pdf\b/i.test(prompt))return 'office_pdf';
  if(/模板.{0,8}(?:批量|填充)|批量.{0,8}(?:通知|证明|套印)/.test(prompt))return 'office_templates';
  if(/表格.{0,8}(?:清洗|去重)|(?:Excel|xlsx).{0,10}(?:清洗|去重)/i.test(prompt))return 'office_clean';
  if(/办公.{0,5}(?:套件|三件套)|(?:word|报告).{0,20}(?:ppt|演示).{0,20}(?:excel|表格)/i.test(prompt))return 'office_bundle';
  if(/\.pptx\b|制作.{0,10}PPT|PPT.{0,10}(?:制作|汇报)/i.test(prompt))return 'office_ppt';
  if(/\.docx\b|Word.{0,10}(?:文档|报告)|制作.{0,10}Word/i.test(prompt))return 'office_word';
  if(/\.xlsx\b|Excel.{0,10}(?:整理|制作|表格)/i.test(prompt))return 'office_excel';
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
