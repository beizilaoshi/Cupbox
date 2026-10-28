import {app,BrowserWindow} from 'electron';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const out=path.resolve('output/office-ui-review'),home=path.join(out,'run-'+Date.now()),root=path.join(home,'project');
await mkdir(path.join(home,'.cupbox'),{recursive:true});await mkdir(root,{recursive:true});
process.env.CUPBOX_HOME=home;process.env.CUPBOX_UPDATE_DISABLE='1';process.env.CUPBOX_ANNOUNCEMENT_DISABLE='1';
await writeFile(path.join(home,'.cupbox/desktop.json'),JSON.stringify({startupEnabled:false,musicEnabled:false}));
app.setPath('userData',path.join(home,'profile'));app.disableHardwareAcceleration();
const pause=ms=>new Promise(r=>setTimeout(r,ms)),errors=[];
async function wait(fn){for(let i=0;i<240;i++){if(await fn())return;await pause(50);}throw Error('等待办公界面超时');}
const check=(ok,label)=>{if(!ok)throw Error(label);console.log('PASS '+label);};
app.on('browser-window-created',(_,w)=>{w.show=()=>{};w.showInactive=()=>{};w.webContents.setBackgroundThrottling(false);w.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});});
void(async()=>{try{
 await import(process.argv.includes('--portable')?pathToFileURL(path.resolve('release/Cupbox可视化/resources/app/desktop/main.js')).href:'./main.js');
 await wait(()=>BrowserWindow.getAllWindows().length>0);const win=BrowserWindow.getAllWindows()[0],js=s=>win.webContents.executeJavaScript(s);
 await wait(()=>js('Boolean(window.cupboxReady)').catch(()=>false));await js(`savePrefs({workspace:${JSON.stringify(root)},executionEnvironment:'native',approvalMode:'smart'});openModal('workbench')`);
 check(await js(`cupbox.workbenchList().then(ds=>['word_read','word_create','ppt_read','ppt_create','excel_read','excel_create','excel_update'].every(n=>ds.some(d=>d.name===n)))`),'Office definitions available through IPC');
 check(await js(`document.querySelectorAll('#tab-workbench .office-tool-buttons button').length===23`),'visible Office shortcuts with editable examples');
 for(const id of ['word_create','ppt_create','excel_create']){
  await js(`document.querySelector('#tab-workbench [data-office-tool="${id}"]').click();document.querySelector('#wb-run').click()`);
  await wait(()=>js(`!document.querySelector('#wb-commit').hidden&&!document.querySelector('#wb-run').disabled`));
  check(await js(`document.querySelector('#wb-state').textContent.includes('尚未执行')&&document.querySelector('#wb-output').textContent.includes('办公文件变更预览')`),id+' previews readable content without writing');
  await js(`document.querySelector('#wb-commit').click()`);await wait(()=>js(`!document.querySelector('#approval-screen').hidden`));
  check(await js(`document.querySelector('#approval-title').textContent.includes('办公文件')&&document.querySelector('#approval-diff').textContent.includes('办公文件变更预览')`),id+' uses themed approval with content summary');
  await js(`document.querySelector('#approval-allow').click()`);await wait(()=>js(`document.querySelector('#wb-state').textContent==='完成'&&!document.querySelector('#wb-run').disabled`));
 }
 for(const [tool,file]of [['word_read','工作报告.docx'],['ppt_read','项目汇报.pptx'],['excel_read','任务清单.xlsx']]){
  const r=await js(`cupbox.workbenchRun({name:${JSON.stringify(tool)},args:{path:${JSON.stringify(file)}}})`);check(r.ok&&Boolean(r.data.items?.length||r.data.rows?.length),tool+' reads the actual generated file in Electron');
  const bytes=await readFile(path.join(root,file));check(bytes.subarray(0,2).toString()==='PK',file+' is an actual Office package');
 }
 await js(`document.querySelector('#wb-tool').value='word_read';document.querySelector('#wb-tool').dispatchEvent(new Event('change'));document.querySelector('#wb-fields [data-key=path]').value='工作报告.docx';document.querySelector('#wb-fields [data-key=start]').value='2';document.querySelector('#wb-fields [data-key=count]').value='1';document.querySelector('#wb-run').click()`);
 await wait(()=>js(`!document.querySelector('#wb-run').disabled&&document.querySelector('#wb-state').textContent==='完成'`));
 check(await js(`document.querySelectorAll('.office-read-block').length===1`),'numeric paging controls produce rendered text rather than raw JSON only');
 await js(`closeModal();CupboxToolWorkspace.library();openDrawer();[...document.querySelectorAll('#tool-categories button')].find(b=>b.textContent==='办公').click()`);
 check(await js(`document.querySelectorAll('#tool-cards [data-tool]').length===23`),'outside local-tool library exposes 23 Office cards in its own category');
 await pause(450);await js(`document.querySelectorAll('#toast .notice-dismiss').forEach(n=>n.click())`);await writeFile(path.join(out,'office-library.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 for(const id of ['word_create','ppt_create','excel_create','excel_update']){
  await js(`selectTool('${id}',true);document.querySelector('#tool-example').click();if('${id}'==='excel_update')document.querySelector('#tool-form [data-key=source]').value='local-excel_create.xlsx';document.querySelector('#tool-form [data-key=path]').value='local-${id}.${id.startsWith('word')?'docx':id.startsWith('ppt')?'pptx':'xlsx'}';document.querySelector('#btn-run').click()`);
  await wait(()=>js(`Boolean(document.querySelector('#office-local-commit'))&&!toolRunning`));
  check(await js(`document.querySelector('#result-status').textContent.includes('尚未写入')&&!document.querySelector('#tool-form textarea')?.value.trim().startsWith('[')`),id+' external form accepts plain content and offers explicit preview commit');
  await js(`document.querySelector('#office-local-commit').click()`);await wait(()=>js(`!document.querySelector('#approval-screen').hidden`));await js(`document.querySelector('#approval-allow').click()`);await wait(()=>js(`!toolRunning&&document.querySelector('#result-body').textContent.includes('可回滚操作')`));
 }
 check(await js(`cupbox.run('excel_read',{path:'local-excel_update.xlsx',sheet:'Sheet1',range:'C2'}).then(r=>r.ok&&r.result.data.rows[0].cells[0].value==='已完成')`),'external update form writes the requested actual cell value');
 const JSZip=(await import('jszip')).default,z=await JSZip.loadAsync(await readFile(path.join(root,'local-word_create.docx')));z.file('word/document.xml',(await z.file('word/document.xml').async('string')).replace('完成需求梳理。','{{姓名}}，欢迎加入。'));await writeFile(path.join(root,'模板.docx'),await z.generateAsync({type:'nodebuffer'}));
 await writeFile(path.join(root,'数据.csv'),'编号,金额\n001,12\n002,18');
 const extras={word_replace:{source:'local-word_create.docx',path:'extra-replaced.docx',content:'本周进展 → 今日进展'},word_template:{source:'模板.docx',path:'extra-template.docx',content:'姓名=小明'},word_mailmerge:{source:'模板.docx',content:'path\t姓名\nextra-a.docx\t甲\nextra-b.docx\t乙'},ppt_replace:{source:'local-ppt_create.pptx',path:'extra-replaced.pptx',content:'下一步 → 后续安排'},ppt_reorder:{source:'local-ppt_create.pptx',path:'extra-ordered.pptx',content:'2,1'},excel_analyze:{source:'local-excel_create.xlsx',sheet:'Sheet1',range:'A1:C2',groupBy:'',valueColumn:''},excel_transform:{source:'local-excel_create.xlsx',path:'extra-clean.xlsx',range:'A1:C2',sortBy:'事项',dedupeBy:'事项'},excel_format:{source:'local-excel_create.xlsx',path:'extra-style.xlsx',sheet:'Sheet1',range:'A1:C2'},excel_merge:{path:'extra-merged.xlsx',content:'local-excel_create.xlsx\tSheet1\tA1:C2\nlocal-excel_create.xlsx\tSheet1\tA1:C2'},office_import_csv:{source:'数据.csv',path:'extra-csv.xlsx'},office_export:{source:'local-word_create.docx',path:'extra-report.txt',format:'txt'},pdf_create:{path:'extra-report.pdf',title:'中文报告',content:'这是外部表单生成的中文 PDF。'},pdf_read:{path:'extra-report.pdf'},pdf_merge:{path:'extra-merged.pdf',content:'extra-report.pdf\nextra-report.pdf'},pdf_extract:{source:'extra-merged.pdf',path:'extra-page.pdf',content:'2'},pdf_stamp:{source:'extra-page.pdf',path:'extra-stamped.pdf',text:'内部资料'}};
 for(const [id,args]of Object.entries(extras)){
  await js(`selectTool(${JSON.stringify(id)},true);document.querySelector('#tool-example').click();for(const [key,value]of Object.entries(${JSON.stringify(args)})){const field=document.querySelector('#tool-form [data-key="'+key+'"]');if(field)field.value=value;}document.querySelector('#btn-run').click()`);
  if(['pdf_read','excel_analyze'].includes(id)){await wait(()=>js(`!toolRunning&&document.querySelector('#result-status').textContent==='完成'`));console.log('PASS external '+id+' renders a real local read result');continue;}
  await wait(()=>js(`Boolean(document.querySelector('#office-local-commit'))&&!toolRunning`));await js(`document.querySelector('#office-local-commit').click()`);await wait(()=>js(`!document.querySelector('#approval-screen').hidden`));await js(`document.querySelector('#approval-allow').click()`);await wait(()=>js(`!toolRunning&&document.querySelector('#result-body').textContent.includes('可回滚操作')`));console.log('PASS external '+id+' previews, approves and commits real files');
 }
 check(await js(`cupbox.run('pdf_read',{path:'extra-stamped.pdf'}).then(r=>r.ok&&r.result.data.items[0].text.includes('中文'))`),'Electron PDF reader loads its bundled worker and reads the generated Chinese content');
 await js(`selectTool('word_create',true);document.querySelector('#tool-example').click();document.querySelector('#tool-form [data-key=path]').value='invalidated.docx';document.querySelector('#btn-run').click()`);await wait(()=>js(`Boolean(document.querySelector('#office-local-commit'))&&!toolRunning`));
 await js(`document.querySelector('#tool-form [data-key=content]').value+='修改';document.querySelector('#tool-form [data-key=content]').dispatchEvent(new Event('input',{bubbles:true}))`);
 check(await js(`!document.querySelector('#office-local-commit')`),'editing external form invalidates previous confirmation');
 await js(`closeDrawer();document.querySelector('.composer-capabilities').open=true;document.querySelector('#chat-text').value='';document.querySelector('[data-office-workflow=office_bundle]').click()`);
 await wait(()=>js(`document.querySelector('#workflow-scene').value==='office_bundle'`));
 check(await js(`prefs.mode==='agent'&&document.querySelector('#chat-text').value.includes('Word 报告')&&document.querySelector('#workflow-criteria').value.includes('三份')&&!sending`),'office workflow template fills editable Agent draft without sending');
 await js(`document.querySelectorAll('#toast .notice-dismiss').forEach(n=>n.click())`);await pause(450);await writeFile(path.join(out,'office-workflows.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 await js(`document.querySelector('#chat-text').value='保留我的草稿';document.querySelector('[data-office-workflow=office_word]').click()`);
 check(await js(`document.querySelector('#chat-text').value==='保留我的草稿'`),'workflow template does not overwrite existing user draft');
 await js(`document.querySelector('.composer-capabilities').open=false;openModal('workbench')`);
 for(const width of [1000,1280])for(const theme of ['light','dark']){win.setSize(width,800);await js(`document.documentElement.dataset.theme='${theme}'`);await pause(100);check(await js(`(()=>{const e=document.querySelector('#tab-workbench');return e.scrollWidth<=e.clientWidth+1})()`),'Office page has no horizontal overflow '+width+' '+theme);}
 await js(`window.CupboxUX?.closeNotices?.();document.querySelectorAll('#toast .notice-dismiss').forEach(n=>n.click());document.activeElement?.blur()`);
 await writeFile(path.join(out,'office-tools.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 check(!errors.length,'no renderer errors '+errors.join(';'));console.log('OFFICE_UI_OK');app.exit(0);
}catch(e){console.error(e);app.exit(1);}})();
