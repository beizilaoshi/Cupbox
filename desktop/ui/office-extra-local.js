"use strict";
window.CupboxOfficeExtraLocal=(()=>{
 const f=(k,label,type='text',value='')=>({k,label,type,value}),source=f('source','源文件（工作目录内路径）'),output=f('path','另存为（工作目录内路径）'),overwrite=f('overwrite','允许覆盖已有文件','checkbox'),content=label=>f('content',label,'textarea'),range=f('range','数据区域（首行为表头）','text','A1:C20'),sheet=f('sheet','工作表名称（留空用首表）');
 const def=(id,name,fields,hint,readOnly=false)=>({id,name,fields,group:'办公',hint,readOnly});
 const base=[source,output],end=[overwrite];
 const tools=[
  def('word_replace','Word 文字替换',[...base,content('每行：查找文字 → 新文字'),...end],'修改原文档文字，保留其余资源；先预览并另存。'),
  def('word_template','Word 模板填充',[...base,content('每行：变量名=值；模板内使用 {{变量名}}'),...end],'替换正文和表格中的占位符，保留模板版式。'),
  def('word_mailmerge','Word 批量套印',[source,content('Tab 分列：首行为 path、变量名…，每个后续行是一份输出'),...end],'批量生成通知、证明或个性化文档，最多20份，整体预览提交。'),
  def('ppt_replace','PPT 文字替换',[...base,content('每行：查找文字 → 新文字'),...end],'替换幻灯片和演讲备注文字，不修改图片内文字。'),
  def('ppt_reorder','PPT 页面调序',[...base,content('全部页面顺序，例如：3,1,2'),...end],'调整真实放映顺序，需包含所有页面，不删除内容。'),
  def('excel_analyze','Excel 数据统计',[source,sheet,range,f('groupBy','按哪列表头分组（可留空）'),f('valueColumn','分组汇总的数值列表头')],'本地计算合计、均值、极值、缺失和重复，可分组汇总；不调用模型。',true),
  def('excel_transform','Excel 清洗排序',[...base,sheet,range,f('sortBy','排序列表头'),f('descending','倒序','checkbox'),f('dedupeBy','去重列表头（逗号分隔）'),f('filterColumn','筛选列表头'),f('filterValue','筛选值（精确匹配）'),...end],'筛选、排序和按列去重，输出新数据表，原文件保留。'),
  def('excel_format','Excel 格式美化',[...base,sheet,range,f('fill','背景色（6位十六进制）','text','F0EDFC'),f('numFmt','数字格式（可留空，如 0.00）'),f('bold','文字加粗','checkbox'),f('border','细边框','checkbox'),f('freezeHeader','冻结首行','checkbox'),...end],'设置颜色、数字格式、字体和边框；建议另存，复杂高级对象可能丢失。'),
  def('excel_merge','Excel 多表合并',[output,content('每行 Tab 分列：源文件、工作表名称、区域；所有来源表头须相同'),...end],'按相同表头追加合并多个工作簿的指定区域。'),
  def('office_import_csv','CSV / TSV 导入',[...base,f('convertNumbers','转换安全数值（默认保留文本）','checkbox'),...end],'UTF-8 CSV/TSV 转 Excel，支持引号、逗号和换行，保留前导零编号。'),
  def('office_export','办公文字导出',[...base,{...f('format','导出格式','select','txt'),options:['txt','md','csv']},sheet,range,...end],'Word/PPT 提取文字，Excel 指定区域导出 CSV 或 Markdown，不保留原视觉排版。'),
  def('pdf_read','读取 PDF',[f('path','PDF 文件路径'),f('start','起始页','text','1'),f('count','读取页数','text','5')],'分页读取 PDF 文字层；扫描件需另行 OCR，不会假装已经识别。',true),
  def('pdf_create','制作 PDF 报告',[output,f('title','报告标题'),content('正文（自动换行分页）'),...end],'中文 A4 文字报告，含页码；不是 Word/PPT 保真转换。'),
  def('pdf_merge','PDF 多份合并',[output,content('每行一个 PDF 路径，按填写顺序合并'),...end],'最多10份本地 PDF，签名和部分交互结构不保留。'),
  def('pdf_extract','PDF 抽页重排',[...base,content('页面，如 1,3-5,2（从1开始）'),...end],'抽取指定页面并按顺序输出到新文件，原件保留。'),
  def('pdf_stamp','PDF 添加水印',[...base,f('text','水印文字','text','内部资料'),...end],'每页叠加可见水印；不删除下层文字，不是安全脱敏，数字签名可能失效。')
 ];
 const samples={word_replace:{source:'工作报告.docx',path:'工作报告-修改.docx',content:'本周进展 → 本月进展'},word_template:{source:'模板.docx',path:'通知.docx',content:'姓名=小明\n日期=2026-10-24'},word_mailmerge:{source:'模板.docx',content:'path\t姓名\t日期\n通知-小明.docx\t小明\t2026-10-24\n通知-小红.docx\t小红\t2026-10-24'},ppt_replace:{source:'项目汇报.pptx',path:'汇报-修改.pptx',content:'下一步 → 下月计划'},ppt_reorder:{source:'项目汇报.pptx',path:'汇报-调序.pptx',content:'2,1'},excel_analyze:{source:'明细.xlsx',sheet:'Sheet1',range:'A1:C5',groupBy:'部门',valueColumn:'金额'},excel_transform:{source:'明细.xlsx',path:'整理结果.xlsx',range:'A1:C5',sortBy:'金额',dedupeBy:'姓名'},excel_format:{source:'明细.xlsx',path:'美化结果.xlsx',sheet:'Sheet1',range:'A1:C5',fill:'F0EDFC',numFmt:'0.00'},excel_merge:{path:'合并结果.xlsx',content:'一月.xlsx\tSheet1\tA1:C20\n二月.xlsx\tSheet1\tA1:C20'},office_import_csv:{source:'数据.csv',path:'数据.xlsx'},office_export:{source:'工作报告.docx',path:'工作报告.txt',format:'txt'},pdf_read:{path:'报告.pdf',start:'1',count:'5'},pdf_create:{path:'报告.pdf',title:'项目进展',content:'这是项目进展报告。\n一、当前进展\n二、下一步安排'},pdf_merge:{path:'合并.pdf',content:'报告.pdf\n附件.pdf'},pdf_extract:{source:'合并.pdf',path:'抽页.pdf',content:'1,3-5'},pdf_stamp:{source:'报告.pdf',path:'报告-水印.pdf',text:'内部资料'}};
 const lines=s=>String(s||'').split(/\r?\n/).filter(s=>s.trim()),value=s=>/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(s)&&Number.isFinite(Number(s))?Number(s):s;
 function compile(id,v){const a={};for(const f of tools.find(t=>t.id===id).fields){if(['content','filterColumn','filterValue'].includes(f.k)||v[f.k]===''||v[f.k]===undefined)continue;a[f.k]=v[f.k];}
  if(id==='word_replace'||id==='ppt_replace')a.replacements=lines(v.content).map(s=>{const i=s.indexOf('→');if(i<1)throw Error('请使用“查找文字 → 新文字”，每行一项。');return{find:s.slice(0,i).trim(),replace:s.slice(i+1).trim()};});
  if(id==='word_template')a.variables=lines(v.content).map(s=>{const i=s.indexOf('=');if(i<1)throw Error('变量需按“变量名=值”填写。');return{key:s.slice(0,i).trim(),value:s.slice(i+1)};});
  if(id==='word_mailmerge'){const rows=lines(v.content).map(s=>s.split('\t')),headers=rows.shift();if(!headers||headers[0]!=='path')throw Error('第一列标题须为 path，后续列为模板变量名。');a.outputs=rows.map(row=>({path:row[0],variables:headers.slice(1).map((key,i)=>({key,value:row[i+1]??''}))}));}
  if(id==='ppt_reorder')a.order=String(v.content).split(/[,，\s]+/).filter(Boolean).map(Number);
  if(id==='excel_transform'){if(v.dedupeBy)a.dedupeBy=v.dedupeBy.split(/[,，]+/).map(s=>s.trim()).filter(Boolean);if(v.filterColumn)a.filters=[{column:v.filterColumn,op:'eq',value:value(v.filterValue||'')}];}
  if(id==='excel_merge')a.inputs=lines(v.content).map(s=>{const [source,sheet,range]=s.split('\t');if(!range)throw Error('每行请填写源文件、工作表、区域，用 Tab 分隔。');return{source,...(sheet?{sheet}:{}),range};});
  if(id==='pdf_read'){a.start=Number(v.start||1);a.count=Number(v.count||5);}
  if(id==='pdf_create')a.text=String(v.content||'');if(id==='pdf_merge')a.sources=lines(v.content);
  if(id==='pdf_extract'){a.pages=[];for(const part of String(v.content||'').split(/[,，\s]+/).filter(Boolean)){const m=/^(\d+)(?:-(\d+))?$/.exec(part);if(!m)throw Error('页面需填写序号或范围，如 1,3-5。');const from=Number(m[1]),to=Number(m[2]||m[1]);if(to<from||to-from>199)throw Error('范围需从小到大，每次最多200页。');for(let i=from;i<=to;i++){a.pages.push(i);if(a.pages.length>200)throw Error('每次最多200页。');}}}
  return a;
 }
 return{tools,samples,compile};
})();
