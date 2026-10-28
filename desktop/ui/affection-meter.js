window.CupboxAffectionMeter=(()=>{
  const svgNS='http://www.w3.org/2000/svg';
  function shape(tag,attributes){
    const node=document.createElementNS(svgNS,tag);
    for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));
    return node;
  }
  function update(root,value,label='好感度'){
    const score=Math.max(-100,Math.min(100,Number.isFinite(Number(value))?Number(value):0));
    root.classList.add('affection-meter');root.dataset.direction=score<0?'negative':score>0?'positive':'zero';
    for(const [key,text]of Object.entries({role:'meter','aria-label':label,'aria-valuemin':-100,'aria-valuemax':100,'aria-valuenow':score,'aria-valuetext':`${score>0?'+':''}${score}，范围负100到正100`}))root.setAttribute(key,String(text));
    root.title=label+'：'+score+'（−100～100，中间为0）';
    const graph=shape('svg',{viewBox:'0 0 200 4',preserveAspectRatio:'none','aria-hidden':'true',focusable:'false'});
    graph.append(shape('rect',{x:0,y:0,width:200,height:4,rx:2,class:'affection-meter-track'}));
    graph.append(shape('rect',{x:score<0?100+score:100,y:0,width:Math.abs(score),height:4,rx:2,class:'affection-meter-fill'}));
    graph.append(shape('line',{x1:100,y1:0,x2:100,y2:4,class:'affection-meter-zero'}));
    root.replaceChildren(graph);return root;
  }
  function create(value,label){return update(document.createElement('div'),value,label);}
  return {create,update};
})();
