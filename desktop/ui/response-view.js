"use strict";
window.CupboxResponse=(()=>{
  const tags=['p','br','strong','em','del','blockquote','ul','ol','li','h1','h2','h3','h4','h5','h6','pre','code','hr','table','thead','tbody','tr','th','td','a'];
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  let hooks;
  async function copy(text,button){try{await navigator.clipboard.writeText(text);CupboxVisuals.feedback(button);}catch{hooks?.toast('复制失败，可选择文字后按 Ctrl+C');}}
  function render(text){
    const body=el('div',undefined,'response-markdown');
    body.innerHTML=DOMPurify.sanitize(marked.parse(String(text||''),{gfm:true,breaks:true}),{ALLOWED_TAGS:tags,ALLOWED_ATTR:['href','title','class','start','align'],ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false});
    for(const link of body.querySelectorAll('a')){
      const href=link.getAttribute('href')||'';
      if(!/^https:\/\//i.test(href)){link.removeAttribute('href');continue;}
      link.addEventListener('click',e=>{e.preventDefault();void cupbox.openExternal(href);});link.title=href;
    }
    for(const table of body.querySelectorAll('table')){const wrap=el('div',undefined,'response-table');table.replaceWith(wrap);wrap.append(table);}
    for(const code of body.querySelectorAll('pre>code')){
      const pre=code.parentElement,wrap=el('div',undefined,'response-code');pre.replaceWith(wrap);
      const head=el('div',undefined,'response-code-head'),language=(code.className.match(/language-([\w+-]+)/)||[])[1]||'代码';
      const button=el('button','复制代码');button.type='button';CupboxVisuals.buttonIcon(button,'copy');button.addEventListener('click',()=>void copy(code.textContent,button));head.append(el('span',language),button);wrap.append(head,pre);
    }
    return body;
  }
  function attach(container,payload){
    const actions=el('div',undefined,'response-actions'),plain=el('button','复制内容'),source=el('button','复制 Markdown');
    plain.addEventListener('click',()=>{const view=render(payload.text);for(const h of view.querySelectorAll('.response-code-head'))h.remove();for(const b of view.querySelectorAll('br'))b.replaceWith(document.createTextNode('\n'));for(const cell of view.querySelectorAll('th,td'))cell.append(document.createTextNode('\t'));for(const block of view.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,pre,blockquote,tr'))block.append(document.createTextNode('\n'));void copy(view.textContent.replace(/\n{3,}/g,'\n\n').trim(),plain);});
    source.addEventListener('click',()=>void copy(payload.text,source));CupboxVisuals.buttonIcon(plain,'copy');CupboxVisuals.buttonIcon(source,'codec');actions.append(plain,source);
    if(payload.messageId&&payload.sessionId){
      let feedback=payload.feedback,remembered=Boolean(payload.memoryId);
      const up=el('button','有帮助'),down=el('button','不准确'),remember=el('button',remembered?'已记住':'记住…'),note=el('span',undefined,'response-feedback-note');
      const sync=()=>{up.setAttribute('aria-pressed',String(feedback==='up'));down.setAttribute('aria-pressed',String(feedback==='down'));container.classList.toggle('response-excluded',feedback==='down');note.textContent=feedback==='down'?'已排除出后续上下文':feedback==='up'?'后续上下文优先参考':'';remember.disabled=feedback==='down';};
      async function vote(value){up.disabled=down.disabled=true;try{const r=await cupbox.responseFeedback({sessionId:payload.sessionId,messageId:payload.messageId,value:feedback===value?'none':value});if(!r.ok)throw Error(r.error);feedback=r.message.feedback;remembered=Boolean(r.message.memoryId);remember.textContent=remembered?'已记住':'记住…';sync();hooks?.updated?.();}catch(e){hooks?.toast(e.message);}finally{up.disabled=down.disabled=false;}}
      up.title='优先参考这条回答，不会自动保存为长期事实';down.title='排除这条回答，并清除可能包含它的旧摘要';up.addEventListener('click',()=>void vote('up'));down.addEventListener('click',()=>void vote('down'));
      remember.addEventListener('click',()=>{
        if(container.querySelector('.response-memory-editor'))return;
        const panel=el('div',undefined,'response-memory-editor');panel.append(el('b',remembered?'修改或移除这条长期记忆':'确认要记住的内容'));
        const input=el('textarea');input.maxLength=600;input.rows=4;input.value=payload.memoryText||String(window.getSelection()?.toString()||payload.text).slice(0,600);input.setAttribute('aria-label','长期记忆内容');
        const save=el('button','保存到记忆'),cancel=el('button','取消'),remove=el('button','移除记忆');remove.hidden=!remembered;
        const hint=el('small','仅保存你确认的内容，供后续相关任务召回；可随时移除。');
        const commit=async text=>{save.disabled=remove.disabled=true;try{const r=await cupbox.responseRemember({sessionId:payload.sessionId,messageId:payload.messageId,text});if(!r.ok)throw Error(r.error);payload.memoryText=text;payload.memoryId=r.message.memoryId;remembered=Boolean(r.message.memoryId);remember.textContent=remembered?'已记住':'记住…';panel.remove();hooks?.toast(remembered?'已保存为长期记忆':'已移除这条记忆');hooks?.updated?.();}catch(e){hint.textContent=e.message;}finally{save.disabled=remove.disabled=false;}};
        save.addEventListener('click',()=>{if(!input.value.trim()){hint.textContent='请填写要保存的记忆';return;}void commit(input.value.trim());});remove.addEventListener('click',()=>void commit(''));cancel.addEventListener('click',()=>panel.remove());panel.append(input,hint,save,remove,cancel);container.append(panel);input.focus();
      });
      actions.append(up,down,remember,note);sync();
    }
    container.append(actions);
  }
  const toolNames={fs_read:'分页读取文件',fs_write:'预览/写入文件',fs_edit:'精确编辑文件',fs_patch:'应用补丁',fs_mkdir:'创建目录',fs_mv:'移动文件',fs_cp:'复制文件',fs_rm:'可恢复删除',fs_stat:'文件信息',fs_rollback:'回滚文件操作',http:'联网请求',grep:'搜索代码',replace:'批量替换',pty_spawn:'启动终端',pty_read:'读取终端日志',pty_write:'发送终端输入',pty_kill:'停止终端',git:'Git 操作',pkg:'运行项目脚本',test:'运行测试',clipboard_image:'图片剪贴板',fs_read_text_file:'读取文件',fs_read_multiple_files:'读取多个文件',fs_write_file:'写入文件',fs_edit_file:'编辑文件',fs_create_directory:'创建目录',fs_list_directory:'列出目录',fs_list_directory_with_sizes:'查看目录大小',fs_directory_tree:'读取目录树',fs_search_files:'查找文件',fs_get_file_info:'查看文件信息'};
  return{render,attach,toolName:name=>toolNames[name]||name,init:options=>hooks=options};
})();
