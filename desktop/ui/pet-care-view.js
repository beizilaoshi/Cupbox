// Shared, bundled SVGs and formatting for the settings card and small pet window.
window.CupboxPetCareView=(()=>{
 const paths={fish:'M7 12C10 5 17 5 22 12C17 19 10 19 7 12ZM7 12L2 7V17ZM17 10H17.01',cake:'M4 11H20V21H4ZM3 11L12 6L21 11ZM12 6V2M10 3H14M4 16H20',yarn:'M21 12A9 9 0 1 1 3 12A9 9 0 1 1 21 12ZM5 7C12 7 15 12 17 19M3 12C10 10 14 16 15 20M9 4C10 10 17 10 21 11',brush:'M8 3H16V11H8ZM10 11V20A2 2 0 0 0 14 20V11M10 3V8M13 3V8M16 3V8',moon:'M20 15A9 9 0 1 1 9 3A7 7 0 0 0 20 15Z',heart:'M12 21L3 12C-2 5 7 0 12 7C17 0 26 5 21 12Z'};
 function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.6');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');path.setAttribute('d',paths[name]||paths.heart);svg.append(path);return svg;}
 const seconds=ms=>{const n=Math.max(0,Math.ceil(ms/1000));return n>=60?Math.ceil(n/60)+'分钟':n+'秒';};
 function actionState(action,care){if(care.busy&&['play','nap'].includes(action.id))return{disabled:true,text:'正在忙任务，稍后再来'};const remaining=Math.max(0,action.retryAt-Date.now());if(remaining)return{disabled:true,text:seconds(remaining)+'后再来'};if(action.reason&&!action.cooling)return{disabled:true,text:action.reason};if(action.id==='play'&&care.play)return{disabled:true,text:'正在玩耍中'};return{disabled:false,text:action.description};}
 const score=value=>Number(value).toFixed(2);
 return{icon,seconds,actionState,score};
})();
