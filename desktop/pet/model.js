import {FESTIVAL_OUTFITS} from './holidays.js';
export const PET_OUTFITS=Object.freeze(['hanfu-wisteria','sakura','academy','cozy','starlight','hanfu-jade','hanfu-peony','hanfu-indigo','jk-plaid',...FESTIVAL_OUTFITS]);
export const PET_DEFAULTS=Object.freeze({enabled:false,size:140,outfit:'sakura',holidayAuto:true,idleActions:true,alwaysOnTop:true,roam:false,bubbles:true,motion:true,sound:true,breakReminder:true,breakMinutes:45,position:null,edgeSnap:true,dockSide:'none',displayMode:'animated',portraitExpression:'idle',diaryEnabled:false,diaryHour:21,diaryModelId:'default'});
export const PET_EXPRESSIONS=Object.freeze(['idle','success','sad','angry','surprised','shy','thinking']);
export const quietPet=config=>config.displayMode==='portrait'||['left','right'].includes(config.dockSide);
export const PET_POSES=Object.freeze(['idle','greeting','thinking','working','success','sleep','wink','shy','sad','surprised','stretch','angry','heart','dance','hop','listening','reading','waiting','reviewing','error','cancelled','focus','cheer','nod','headtilt','eartwitch','peek','pawwave','thankyou','yawn','proud','eating']);
export const PET_PERSISTENT_POSES=Object.freeze(['idle','thinking','working','sleep','reading','waiting','reviewing']);
export function normalizePet(input={},base=PET_DEFAULTS){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(PET_DEFAULTS,k)))throw Error('桌宠配置无效');
 const out={...base,...input};
 for(const key of ['enabled','alwaysOnTop','roam','bubbles','motion','idleActions','sound','holidayAuto','breakReminder','edgeSnap','diaryEnabled'])if(typeof out[key]!=='boolean')throw Error('桌宠开关必须是布尔值');
 if(!Number.isInteger(out.diaryHour)||out.diaryHour<0||out.diaryHour>23||typeof out.diaryModelId!=='string'||!out.diaryModelId.trim()||out.diaryModelId.length>200)throw Error('日记时间或模型选项无效');
 if(!['none','left','right'].includes(out.dockSide)||!['animated','portrait'].includes(out.displayMode)||!PET_EXPRESSIONS.includes(out.portraitExpression))throw Error('桌宠停驻或立绘选项无效');
 if(![30,45,60,90].includes(out.breakMinutes))throw Error('请选择有效的休息提醒间隔');
 if(!PET_OUTFITS.includes(out.outfit))throw Error('请选择内置服装');
 if(!Number.isInteger(out.size)||out.size<60||out.size>280)throw Error('桌宠大小应为60–280');
 if(out.position!==null){const p=out.position;if(!p||Object.keys(p).length!==2||!Number.isSafeInteger(p.x)||!Number.isSafeInteger(p.y)||Math.abs(p.x)>100000||Math.abs(p.y)>100000)throw Error('桌宠位置无效');out.position={x:p.x,y:p.y};}
 return out;
}
export function petBounds(config,areas){
 const requested=config.position||{x:areas[0].x+areas[0].width-config.size-90,y:areas[0].y+areas[0].height-config.size-150};
 const area=petWorkArea({...requested,width:Math.max(184,config.size+64),height:config.size+144},areas),left=Math.ceil(area.x),top=Math.ceil(area.y),right=Math.floor(area.x+area.width),bottom=Math.floor(area.y+area.height);
 const width=Math.max(1,Math.min(Math.max(184,config.size+64),right-left)),height=Math.max(1,Math.min(config.size+144,bottom-top));
 const x=config.dockSide==='left'?left:config.dockSide==='right'?right-width:Math.max(left,Math.min(Math.round(requested.x),right-width));
 return{x,y:Math.max(top,Math.min(Math.round(requested.y),bottom-height)),width,height};
}
export function petWorkArea(bounds,areas){
 const overlap=a=>Math.max(0,Math.min(bounds.x+bounds.width,a.x+a.width)-Math.max(bounds.x,a.x))*Math.max(0,Math.min(bounds.y+bounds.height,a.y+a.height)-Math.max(bounds.y,a.y));
 const cx=bounds.x+bounds.width/2,cy=bounds.y+bounds.height/2,distance=a=>(cx-Math.max(a.x,Math.min(cx,a.x+a.width)))**2+(cy-Math.max(a.y,Math.min(cy,a.y+a.height)))**2;
 return areas.reduce((best,a)=>overlap(a)>overlap(best)||overlap(a)===overlap(best)&&distance(a)<distance(best)?a:best,areas[0]);
}
export const petGravityEnabled=(config,reducedMotion=false)=>config.motion&&!reducedMotion&&config.dockSide==='none';
export function petDockSide(bounds,area,threshold=24){
 const left=Math.abs(bounds.x-area.x),right=Math.abs(bounds.x+bounds.width-area.x-area.width);
 return left<=threshold&&left<=right?'left':right<=threshold?'right':'none';
}

