"use strict";
window.CupboxOfficeLocal=(()=>{
 const field=(k,label,type='text',value='')=>({k,label,type,value});
 const pathField=field('path','工作目录内的文件路径');
 const theme=field('theme','配色','select','sakura');theme.options=['sakura','ink','minimal'];
 const create=[pathField,field('title','标题'),theme,field('content','正文（无需 JSON）','textarea'),field('overwrite','允许覆盖已有文件','checkbox')];
 const tools=[
  {id:'word_read',name:'读取 Word',fields:[pathField,field('start','起始段落','text','1'),field('count','读取段数','text','20')]},
  {id:'word_create',name:'制作 Word',fields:create},
  {id:'ppt_read',name:'读取 PPT',fields:[pathField,field('start','起始页','text','1'),field('count','读取页数','text','10')]},
  {id:'ppt_create',name:'制作 PPT',fields:create.map(f=>f.k==='content'?{...f,label:'每页用 --- 分隔；第一行是标题，后续每行是要点'}:f)},
  {id:'excel_read',name:'读取 Excel',fields:[pathField,field('sheet','工作表名称（可留空）'),field('range','读取区域','text','A1:J30')]},
  {id:'excel_create',name:'制作 Excel',fields:[pathField,field('sheet','工作表名称','text','Sheet1'),theme,field('content','粘贴表格（Tab 分列，第一行作表头）','textarea'),field('overwrite','允许覆盖已有文件','checkbox')]},
  {id:'excel_update',name:'修改 Excel',fields:[field('source','源表格路径'),pathField,field('sheet','工作表名称','text','Sheet1'),field('content','每行一项：单元格=值，例如 A1=标题、B2=120','textarea'),field('overwrite','允许覆盖已有文件','checkbox')]}
 ,...(window.CupboxOfficeExtraLocal?.tools||[])].map(t=>({...t,group:'办公',hint:t.id.endsWith('_read')?'读取本机新版 Office 文件；支持分页或指定区域。':'生成可编辑文件，先预览再批准；默认不覆盖。使用当前工作目录，沙箱中仅可操作隔离目录。'}));
 for(const extra of window.CupboxOfficeExtraLocal?.tools||[])tools.find(t=>t.id===extra.id).hint=extra.hint;
 const samples={word_create:{path:'工作报告.docx',title:'工作报告',content:'# 本周进展\n完成需求梳理。\n- 下一步核对交付'},ppt_create:{path:'项目汇报.pptx',title:'项目汇报',content:'项目概览\n目标与范围\n当前进展\n---\n下一步\n确认需求\n安排交付'},excel_create:{path:'任务清单.xlsx',sheet:'Sheet1',content:'事项\t负责人\t状态\n示例任务\t待指定\t待开始'},word_read:{path:'工作报告.docx',start:'1',count:'20'},ppt_read:{path:'项目汇报.pptx',start:'1',count:'10'},excel_read:{path:'任务清单.xlsx',sheet:'Sheet1',range:'A1:C10'},excel_update:{source:'任务清单.xlsx',path:'任务清单-修改.xlsx',sheet:'Sheet1',content:'C2=已完成'}};
 Object.assign(samples,window.CupboxOfficeExtraLocal?.samples||{});
 let hooks;const plans=new Map();
 const handles=id=>tools.some(t=>t.id===id),write=id=>handles(id)&&!id.endsWith('_read')&&id!=='excel_analyze';
 function compile(id,input){if(window.CupboxOfficeExtraLocal?.tools.some(t=>t.id===id))return CupboxOfficeExtraLocal.compile(id,input);const a={path:input.path};if(id.endsWith('_read')){if(id==='excel_read'){if(input.sheet)a.sheet=input.sheet;a.range=input.range||'A1:J30';}else{a.start=Number(input.start||1);a.count=Number(input.count||10);}return a;}
  a.overwrite=input.overwrite===true;if(id!=='excel_update')a.theme=input.theme||'sakura';
  const lines=String(input.content||'').split(/\r?\n/);if(id==='word_create'){a.title=input.title;a.blocks=lines.filter(s=>s.trim()).map(s=>/^#{1,3} /.test(s)?{type:'heading',level:s.match(/^#+/)[0].length,text:s.replace(/^#+ /,'')}:/^[-*] /.test(s)?{type:'bullet',text:s.slice(2)}:{type:'paragraph',text:s});}
  if(id==='ppt_create'){a.title=input.title;a.slides=String(input.content||'').split(/\r?\n\s*---\s*\r?\n/).map(s=>{const rows=s.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);return{title:rows.shift()||'未命名',bullets:rows.map(x=>x.replace(/^[-*] /,''))};});}
  if(id==='excel_create'){const rows=lines.filter(s=>s.trim()).map(s=>s.split('\t'));a.sheets=[{name:input.sheet||'Sheet1',headers:rows.shift()||[],rows:rows.map(r=>r.map(value))}];}
  if(id==='excel_update'){a.source=input.source;a.sheet=input.sheet;a.changes=lines.filter(s=>s.trim()).map(s=>{const cut=s.indexOf('=');if(cut<1)throw Error('请按“单元格=值”填写修改，每行一项。');return{cell:s.slice(0,cut).trim(),value:value(s.slice(cut+1))};});}return a;
 }
 function value(s){return /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(s)&&Number.isFinite(Number(s))&&(s.includes('.')||Number.isSafeInteger(Number(s)))?Number(s):s;}
 function request(id,raw,commit){if(!commit)return compile(id,raw);const p=plans.get(id);if(!p||p.raw!==JSON.stringify(raw))throw Error('内容已变化，请重新预览。');plans.delete(id);return{...p.args,dryRun:false,confirmToken:p.token};}
 function remember(id,raw,result){if(!handles(id))return;if(result?.confirmToken)plans.set(id,{raw:JSON.stringify(raw),args:compile(id,raw),token:result.confirmToken});else plans.delete(id);}
 function result(r,body){if(!hooks||!handles(hooks.current()))return false;const n=(tag,v)=>{const e=document.createElement(tag);e.textContent=v;return e;};
  const table=rows=>{const t=document.createElement('table');t.className='visual-result-table';for(const row of rows.slice(0,100)){const tr=document.createElement('tr');for(const value of row)tr.append(n('td',value&&typeof value==='object'?JSON.stringify(value):String(value??'')));t.append(tr);}body.append(t);};
  const d=r.data||{};
  if(d.items)for(const item of d.items){body.append(n('b','第 '+item.index+' 项'),n('pre',item.text||''));if(item.notes)body.append(n('pre','演讲备注：'+item.notes));}
  else if(Array.isArray(d.rows)){body.append(n('b',d.sheet+' · '+d.range));table(d.rows.map(row=>[row.row,...row.cells.map(c=>c.value)]));}
  else if(d.columns&&Array.isArray(d.columns)){table([['字段','有效数值','空值','公式','合计','平均','最小','最大'],...d.columns.map(c=>[c.name,c.numericCount,c.missing,c.formulaCells,c.sum,c.average,c.min,c.max])]);body.append(n('p',`数据行：${d.rows} · 重复行：${d.duplicateRows}`));if(d.groups)table([['分组','数量','合计'],...d.groups.map(g=>[g.group,g.count,g.sum])]);}
  else if(d.format){body.append(n('h3',d.format+(d.title?' · '+d.title:'')));if(typeof d.preview==='string')body.append(n('pre',d.preview));if(Array.isArray(d.preview))for(const b of d.preview){if(Array.isArray(b)){table(d.preview);break;}if(b.type==='table')table(b.rows);else body.append(n(b.type==='heading'?'h4':'p',(b.type==='bullet'?'• ':'')+(b.text||'')));}if(d.slides)for(const [i,slide]of d.slides.entries()){body.append(n('h4',`${i+1}. ${slide.title}`));if(slide.body)body.append(n('p',slide.body));for(const point of [...(slide.bullets||[]),...(slide.rightBullets||[])])body.append(n('p','• '+point));if(slide.table)table(slide.table);if(slide.notes)body.append(n('p','备注：'+slide.notes));}if(d.sheets)for(const sheet of d.sheets){body.append(n('h4',`${sheet.name} · ${sheet.rows} 行 · ${sheet.columns} 列`));table(sheet.previewRows||[]);if(sheet.previewOnly)body.append(n('p','仅显示前10行，请读取文件核对后续内容。'));}if(d.replacements)table([['原文字','替换为','命中次数'],...d.replacements.map(p=>[p.find,p.replace,p.matches])]);if(d.outputs)d.outputs.forEach(file=>body.append(n('p',file)));if(d.pages)body.append(n('p','页面：'+(Array.isArray(d.pages)?d.pages.join(', '):d.pages)));if(d.rowsAfter!==undefined)body.append(n('p',`数据行：${d.rowsBefore} → ${d.rowsAfter}`));if(d.changes)table([['单元格','新内容'],...d.changes.map(c=>[c.cell,c.value])]);if(d.truncated)body.append(n('p','内容摘要较长，请在技术详情中核对，或分批制作。'));}
  else body.append(n('pre',JSON.stringify(d,null,2)));if(d.notice)body.append(n('p',d.notice));if(d.nextStart)body.append(n('p','还有内容，下次起始位置填 '+d.nextStart));
  const details=document.createElement('details');details.className='raw-result';details.append(n('summary','查看技术详情'),n('pre',JSON.stringify(r,null,2)));body.append(details);
  if(r.confirmToken){const b=n('button','执行这次预览');b.type='button';b.id='office-local-commit';b.className='btn-run';b.onclick=()=>hooks.run({officeCommit:true});body.append(b);document.getElementById('result-status').textContent='预览 · 尚未写入';}
  if(r.operationId)body.append(n('p','已保存 · 可回滚操作：'+r.operationId));return true;
 }
 function invalidate(id){plans.delete(id);document.getElementById('office-local-commit')?.remove();}
 return{tools,samples,handles,write,request,remember,result,invalidate,init(value){hooks=value;document.getElementById('tool-form').addEventListener('input',()=>invalidate(hooks.current()));document.getElementById('tool-form').addEventListener('change',()=>invalidate(hooks.current()));}};
})();
