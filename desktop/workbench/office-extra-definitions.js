const s={type:'string'},n={type:'integer'},b={type:'boolean'},arr=(items,maxItems=1000)=>({type:'array',items,maxItems});
const obj=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const output={path:s,overwrite:b,dryRun:b,confirmToken:s};
const source={source:s,...output};
const replacements=arr(obj({find:s,replace:s},['find','replace']),50);
const variables=arr(obj({key:s,value:s},['key','value']),100);
const hint=' 默认只预览；同参数加 dryRun:false、confirmToken 才提交。默认不覆盖，覆盖须 overwrite:true。';
const d=(name,description,p,required,risk='write')=>({name,description:description+(risk==='write'?hint:''),parameters:obj(p,required),risk,readOnly:risk==='read'});
export const EXTRA_OFFICE_DEFINITIONS=[
 d('word_replace','修改已有 DOCX 的正文、表格、页眉页脚文字，支持跨文字片段匹配；保留其余原文件资源，不处理文本框/域代码等全部高级对象。精确文字替换，重叠匹配或找不到时报错；优先另存。',{...source,replacements},['source','path','replacements']),
 d('word_template','填写 DOCX 模板中的 {{变量名}}，支持占位符跨文字片段；所有指定变量须命中。',{...source,variables},['source','path','variables']),
 d('word_mailmerge','批量套用 DOCX 模板，每项指定输出路径与变量，最多20份；全部预览并整体提交，任一目标冲突不写入。',{source:s,outputs:arr(obj({path:s,variables},['path','variables']),20),overwrite:b,dryRun:b,confirmToken:s},['source','outputs']),
 d('ppt_replace','替换已有 PPTX 页面和备注中的文字；保留图像、版式等现有包资源。必须命中，不替换图片内文字。',{...source,replacements},['source','path','replacements']),
 d('ppt_reorder','调整现有 PPTX 放映页序，order 为从1开始、包含全部页面且不重复的序号数组；不删除页面。',{...source,order:arr(n,100)},['source','path','order']),
 d('excel_analyze','对指定 XLSX 区域做本地计算：行数、缺失、重复、数值列合计/均值/最小/最大，可按表头分组汇总。不计算公式，不把缓存当本次计算。',{source:s,sheet:s,range:s,groupBy:s,valueColumn:s},['source','range'],'read'),
 d('excel_transform','对带表头的 XLSX 区域排序、筛选、按列去重，生成新表格，保留源文件。操作使用精确表头名称。',{...source,sheet:s,range:s,sortBy:s,descending:b,dedupeBy:arr(s,20),filters:arr(obj({column:s,op:{type:'string',enum:['eq','contains','gt','gte','lt','lte','notEmpty']},value:{oneOf:[s,{type:'number'}]}},['column','op']),20)},['source','path','range']),
 d('excel_format','格式化既有工作表指定区域：数字格式、字体、填充、对齐、边框、列宽和冻结首行；可能无法保留复杂图表等高级对象，建议另存。',{...source,sheet:s,range:s,bold:b,fill:s,fontColor:s,numFmt:s,align:{type:'string',enum:['left','center','right']},border:b,columnWidth:{type:'number'},freezeHeader:b},['source','path','sheet','range']),
 d('excel_merge','将多个 XLSX 中指定表的带表头区域，按完全相同的表头追加合并为新工作表；不猜测列对应，不读取未指定区域。',{...output,inputs:arr(obj({source:s,sheet:s,range:s},['source','range']),10)},['path','inputs']),
 d('office_export','导出 DOCX/PPTX 文字为 TXT/Markdown，或指定 XLSX 区域为 CSV/Markdown。仅文字结构导出，不是保真排版转换；CSV 防公式注入。',{...source,sheet:s,range:s,format:{type:'string',enum:['txt','md','csv']}},['source','path','format']),
 d('office_import_csv','将本地 UTF-8 CSV/TSV 转成 XLSX，支持引号/换行，数字默认保留为文字以免损坏编号；显式开关可转换安全数字。',{...source,sheet:s,delimiter:{type:'string',enum:[',',';','\t']},convertNumbers:b},['source','path']),
 d('pdf_read','分页读取 PDF 文字层与页数；不执行脚本、外部链接或 OCR。扫描件无文字会明确说明，不把它当空白文档。',{path:s,start:n,count:n,maxChars:n},['path'],'read'),
 d('pdf_create','生成 A4 文字 PDF 报告，支持中文、自动换行分页与页码。仅文字排版，不是 Word/PPT 保真转 PDF；中文使用本机系统字体。',{...output,title:s,text:s},['path','text']),
 d('pdf_merge','按顺序合并最多10个本地 PDF 的页面为新文件；数字签名会失效，不保留全部表单/书签结构。',{...output,sources:arr(s,10)},['path','sources']),
 d('pdf_extract','从本地 PDF 抽取或重排指定页面为新 PDF，pages 为从1开始的序号；不修改源文件。数字签名、部分书签与交互表单不保留。',{...source,pages:arr(n,200)},['source','path','pages']),
 d('pdf_stamp','给每页加可见的文字水印；这是水印，不是安全脱敏，不会删除下层文字。签名会失效，优先另存。',{...source,text:s,opacity:{type:'number'},angle:{type:'number'}},['source','path','text'])
];
