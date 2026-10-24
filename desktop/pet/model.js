import {FESTIVAL_OUTFITS} from './holidays.js';
export const PET_OUTFITS=Object.freeze(['hanfu-wisteria','sakura','academy','cozy','starlight','hanfu-jade','hanfu-peony','hanfu-indigo','jk-plaid',...FESTIVAL_OUTFITS]);
export const PET_DEFAULTS=Object.freeze({enabled:false,size:140,outfit:'sakura',holidayAuto:true,idleActions:true,alwaysOnTop:true,roam:false,bubbles:true,motion:true,sound:true,breakReminder:true,breakMinutes:45,position:null});
export const PET_POSES=Object.freeze(['idle','greeting','thinking','working','success','sleep','wink','shy','sad','surprised','stretch','angry','heart','dance','hop','listening','reading','waiting','reviewing','error','cancelled','focus','cheer','nod','headtilt','eartwitch','peek','pawwave','thankyou','yawn','proud','eating']);
export const PET_PERSISTENT_POSES=Object.freeze(['idle','thinking','working','sleep','reading','waiting','reviewing']);
export function normalizePet(input={},base=PET_DEFAULTS){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(PET_DEFAULTS,k)))throw Error('桌宠配置无效');
 const out={...base,...input};
 for(const key of ['enabled','alwaysOnTop','roam','bubbles','motion','idleActions','sound','holidayAuto','breakReminder'])if(typeof out[key]!=='boolean')throw Error('桌宠开关必须是布尔值');
 if(![30,45,60,90].includes(out.breakMinutes))throw Error('请选择有效的休息提醒间隔');
 if(!PET_OUTFITS.includes(out.outfit))throw Error('请选择内置服装');
 if(!Number.isInteger(out.size)||out.size<60||out.size>280)throw Error('桌宠大小应为60–280');
 if(out.position!==null){const p=out.position;if(!p||Object.keys(p).length!==2||!Number.isSafeInteger(p.x)||!Number.isSafeInteger(p.y)||Math.abs(p.x)>100000||Math.abs(p.y)>100000)throw Error('桌宠位置无效');out.position={x:p.x,y:p.y};}
 return out;
}
export function petBounds(config,areas){
 const requested=config.position||{x:areas[0].x+areas[0].width-config.size-90,y:areas[0].y+areas[0].height-config.size-150};
 const distance=a=>{const cx=Math.max(a.x,Math.min(requested.x,a.x+a.width)),cy=Math.max(a.y,Math.min(requested.y,a.y+a.height));return(requested.x-cx)**2+(requested.y-cy)**2;};
 const area=areas.reduce((best,a)=>distance(a)<distance(best)?a:best,areas[0]);
 const width=Math.min(Math.max(184,config.size+64),area.width),height=Math.min(config.size+144,area.height);
 return{x:Math.round(Math.max(area.x,Math.min(requested.x,area.x+area.width-width))),y:Math.round(Math.max(area.y,Math.min(requested.y,area.y+area.height-height))),width,height};
}

