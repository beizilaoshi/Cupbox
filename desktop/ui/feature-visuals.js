"use strict";
window.CupboxVisuals=(()=>{
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),feedbacks=new WeakMap(),pulses=new Set();
  reduced.addEventListener('change',()=>{if(reduced.matches)for(const animation of pulses)animation.cancel();});
  const features={
    files:{image:'feature-files.png',title:'整理文件',description:'文件归类、查找与批量改名'},
    data:{image:'feature-data.svg',title:'处理数据',description:'格式转换、表格与文本处理'},
    vision:{image:'feature-vision.png',title:'读取图片',description:'识别图片文字与处理画面'},
    workflow:{image:'feature-workflow.svg',title:'协作完成',description:'拆分任务，分工制作，再整合结果'}
  };
  function art(key,cls=''){
    const feature=features[key]||features.files,img=document.createElement('img');img.src='assets/'+feature.image;img.alt='';img.className='feature-illustration '+cls;img.width=112;img.height=112;img.draggable=false;img.decoding='async';img.addEventListener('error',()=>img.hidden=true);return img;
  }
  function empty(key,title,description){const box=document.createElement('div');box.className='visual-empty';box.append(art(key));const heading=document.createElement('b'),copy=document.createElement('p');heading.textContent=title;copy.textContent=description;box.append(heading,copy);return box;}
  function buttonIcon(button,name){const span=document.createElement('span');span.innerHTML=CupboxIcons.html(name);span.setAttribute('aria-hidden','true');button.prepend(span);return button;}
  function pulse(element){if(!element||reduced.matches)return;element.getAnimations().forEach(a=>a.cancel());const animation=element.animate([{transform:'scale(1)'},{transform:'scale(1.12)',offset:.4},{transform:'scale(1)'}],{duration:360,easing:'cubic-bezier(.2,.7,.3,1)'});pulses.add(animation);animation.finished.catch(()=>{}).finally(()=>pulses.delete(animation));}
  function feedback(button,label='已复制'){
    let state=feedbacks.get(button);if(!state){state={nodes:[...button.childNodes]};feedbacks.set(button,state);}clearTimeout(state.timer);
    const span=document.createElement('span');span.innerHTML=CupboxIcons.html('check');span.setAttribute('aria-hidden','true');button.replaceChildren(span,document.createTextNode(label));button.dataset.feedback='success';pulse(span);
    state.timer=setTimeout(()=>{button.replaceChildren(...state.nodes);delete button.dataset.feedback;feedbacks.delete(button);},1500);
  }
  return{art,empty,features,pulse,feedback,buttonIcon};
})();
