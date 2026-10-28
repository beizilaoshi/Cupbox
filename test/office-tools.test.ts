import {afterEach,beforeEach,describe,it,expect} from 'vitest';
import {mkdtemp,rm,readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {Workbench} from '../desktop/workbench/runtime.js';
import {OFFICE_NAMES} from '../desktop/workbench/office-definitions.js';
import {officeArchive} from '../desktop/workbench/office.js';
import {agentPresetAllowsTool} from '../desktop/agent-presets.js';

let temp:string,root:string,bench:any,allow:boolean,approvals:any[],prefs:any;
beforeEach(async()=>{temp=await mkdtemp(path.join(os.tmpdir(),'cupbox-office-'));root=path.join(temp,'project');allow=true;approvals=[];prefs={approvalMode:'ask',executionEnvironment:'sandbox'};bench=await new Workbench({root,home:path.join(temp,'home'),session:'office',getPrefs:async()=>prefs,approve:async(p:any)=>{approvals.push(p);return allow;}}).init();});
afterEach(async()=>{bench.dispose();await rm(temp,{recursive:true,force:true,maxRetries:5});});
async function commit(name:string,args:any){const p=await bench.call(name,args);expect(p.ok,p.message).toBe(true);expect(p.diff).toContain('办公文件变更预览');expect(p.confirmToken).toBeTruthy();const r=await bench.call(name,{...args,dryRun:false,confirmToken:p.confirmToken});expect(r.ok,r.message).toBe(true);return r;}
const word={path:'报告.docx',title:'测试报告',subtitle:'完整中文支持',blocks:[{type:'heading',text:'第一章'},{type:'paragraph',text:'普通正文与 <符号> & 内容'},{type:'bullet',text:'一个要点'},{type:'table',rows:[['项目','进展'],['任务A','完成']]}]};
const excel={path:'数据.xlsx',sheets:[{name:'统计',headers:['品名','金额'],rows:[['项目A',10],['项目B',20],['总计',{formula:'SUM(B2:B3)',result:30}],['=HYPERLINK("https://example.com")',null]]}]};
describe('Office agent tools',()=>{
 it('registers all tools and respects preset file-plugin boundaries',()=>{
  expect(OFFICE_NAMES.every(n=>bench.handles(n))).toBe(true);
  for(const n of OFFICE_NAMES)expect(agentPresetAllowsTool('standard',n,[],{standard:{'tool-files':false}})).toBe(false);
  expect(agentPresetAllowsTool('pentest','word_read')).toBe(true);expect(agentPresetAllowsTool('pentest','word_create')).toBe(false);
 });
 it('creates a real DOCX after preview and reads ordered text and table cells',async()=>{
  const p=await bench.call('word_create',word);expect(p.dryRun).toBe(true);await expect(stat(path.join(root,word.path))).rejects.toThrow();
  const r=await bench.call('word_create',{...word,dryRun:false,confirmToken:p.confirmToken});expect(r.ok,r.message).toBe(true);expect(approvals[0].args.diff).toContain('测试报告');
  const bytes=await readFile(path.join(root,word.path));expect(bytes.subarray(0,2).toString()).toBe('PK');const read=await bench.call('word_read',{path:word.path});expect(read.ok,read.message).toBe(true);
  const out=read.data.items.map((x:any)=>x.text).join('\n');expect(out).toContain('普通正文与 <符号> & 内容');expect(out.indexOf('第一章')).toBeLessThan(out.indexOf('任务A'));expect(out).toContain('完成');
  const page=await bench.call('word_read',{path:word.path,start:2,count:1});expect(page.data.items).toHaveLength(1);expect(page.data.nextStart).toBe(3);
 });
 it('creates a real PPTX and reads slides in presentation order with notes',async()=>{
  await commit('ppt_create',{path:'演示.pptx',theme:'ink',title:'测试',slides:[{title:'开始',bullets:['一','二'],notes:'演讲备注'},{title:'对比',bullets:['左边'],rightTitle:'右边',rightBullets:['右侧内容']},{title:'数据',table:[['项','值'],['A',12]]}]});
  const read=await bench.call('ppt_read',{path:'演示.pptx'});expect(read.ok,read.message).toBe(true);expect(read.data.total).toBe(3);expect(read.data.items[0].text).toContain('开始');expect(read.data.items[0].notes).toContain('演讲备注');expect(read.data.items[1].text).toContain('右侧内容');expect(read.data.items[2].text).toContain('12');
 });
 it('creates XLSX with frozen headers, typed cells and inert formula-looking strings',async()=>{
  await commit('excel_create',excel);const r=await bench.call('excel_read',{path:excel.path,sheet:'统计',range:'A1:B5'});expect(r.ok,r.message).toBe(true);expect(r.data.rows[3].cells[1].value).toEqual({formula:'SUM(B2:B3)',result:30});expect(r.data.rows[4].cells[0].value).toBe('=HYPERLINK("https://example.com")');
  const ExcelJS=(await import('exceljs')).default,b=new ExcelJS.Workbook();await b.xlsx.readFile(path.join(root,excel.path));expect(b.getWorksheet('统计')!.views[0]).toMatchObject({state:'frozen',ySplit:1});
 });
 it('updates cells to a separate workbook, keeps original unchanged and supports rollback',async()=>{
  await commit('excel_create',excel);const original=await readFile(path.join(root,excel.path));const r=await commit('excel_update',{source:excel.path,path:'更新.xlsx',sheet:'统计',changes:[{cell:'B2',value:99}]});
  expect(await readFile(path.join(root,excel.path))).toEqual(original);const read=await bench.call('excel_read',{path:'更新.xlsx',sheet:'统计',range:'B2'});expect(read.data.rows[0].cells[0].value).toBe(99);
  const p=await bench.call('fs_rollback',{operationId:r.operationId});expect((await bench.call('fs_rollback',{operationId:r.operationId,dryRun:false,confirmToken:p.confirmToken})).ok).toBe(true);await expect(stat(path.join(root,'更新.xlsx'))).rejects.toThrow();
 });
 it('rejects overwrite unless explicit; detects target, source and parameter changes',async()=>{
  await commit('excel_create',excel);expect((await bench.call('excel_create',excel)).code).toBe('E_CONFLICT');
  const args={source:excel.path,path:'更新.xlsx',sheet:'统计',changes:[{cell:'B2',value:42}]},p=await bench.call('excel_update',args);
  await writeFile(path.join(root,excel.path),Buffer.from('changed'));expect((await bench.call('excel_update',{...args,dryRun:false,confirmToken:p.confirmToken})).code).toBe('E_CONFLICT');
  const wp=await bench.call('word_create',word);expect((await bench.call('word_create',{...word,title:'篡改',dryRun:false,confirmToken:wp.confirmToken})).code).toBe('E_CONFLICT');
  const wp2=await bench.call('word_create',word);await writeFile(path.join(root,word.path),'external');expect((await bench.call('word_create',{...word,dryRun:false,confirmToken:wp2.confirmToken})).code).toBe('E_CONFLICT');
 });
 it('denial, sandbox path boundaries, file settings and cancellation prevent writes',async()=>{
  expect((await bench.call('word_create',{...word,path:'../outside.docx'})).code).toBe('E_PATH_OUTSIDE_ROOT');
  const p=await bench.call('word_create',word);allow=false;expect((await bench.call('word_create',{...word,dryRun:false,confirmToken:p.confirmToken})).code).toBe('E_DENIED');await expect(stat(path.join(root,word.path))).rejects.toThrow();
  prefs.filesystemTools=false;expect((await bench.call('word_read',{path:word.path})).code).toBe('E_DISABLED');prefs.filesystemTools=true;const controller=new AbortController();controller.abort();expect((await bench.call('word_create',word,undefined,controller.signal)).ok).toBe(false);
 });
 it.each(['WEBSERVICE("https://example.com")','HYPERLINK("file:///secret")',"SUM('[book.xlsx]Sheet1'!A1)",'SUM(Sheet2!A1)','cmd|/C calc!A0'])('rejects unsafe formula %s',async(formula)=>{
  expect((await bench.call('excel_create',{path:'unsafe.xlsx',sheets:[{name:'a',rows:[[{formula}]]}]})).code).toBe('E_OFFICE_FORMULA');
 });
 it('caps ranges, rejects old formats and validates cell addresses and duplicate sheets',async()=>{
  await commit('excel_create',excel);expect((await bench.call('excel_read',{path:excel.path,range:'A1:XFD1048576'})).code).toBe('E_TOO_LARGE');
  expect((await bench.call('word_read',{path:'old.doc'})).code).toBe('E_OFFICE_FORMAT');expect((await bench.call('excel_update',{path:'n.xlsx',source:excel.path,sheet:'统计',changes:[{cell:'XFE1',value:1}]})).code).toBe('E_OFFICE_INPUT');
  expect((await bench.call('excel_create',{path:'n.xlsx',sheets:[{name:'A',rows:[]},{name:'a',rows:[]}]})).code).toBe('E_OFFICE_INPUT');
  expect((await bench.call('word_create',{...word,overwrite:'false'})).code).toBe('E_OFFICE_INPUT');
  const scope=path.join(root,'sub');expect((await bench.call('word_create',word,scope)).code).toBe('E_PATH_OUTSIDE_ROOT');
 });
 it('preflights archives and rejects macros, entities and excessive expansion',async()=>{
  const JSZip=(await import('jszip')).default;
  for(const [name,value]of [['word/vbaProject.bin','macro'],['word/document.xml','<!DOCTYPE a [<!ENTITY b "bad">]><a>&b;</a>'],['large.xml','x'.repeat(17*1024*1024)]]){const z=new JSZip();z.file(name,value);const bytes=await z.generateAsync({type:'nodebuffer',compression:'DEFLATE'});await expect(officeArchive(bytes)).rejects.toThrow();}
 });
});
