import {createRequire} from 'node:module';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
export function createNativeDriver(excluded=()=>[]){
 let lib;
 function load(){if(process.platform!=='win32'||process.arch!=='x64')throw Error('桌面操控目前只支持 Windows x64');try{return lib??=require('@nut-tree-fork/libnut-win32');}catch{throw Error('原生桌面驱动不可用，请重新安装完整版 Cupbox');}}
 const allowed=id=>{if(!Number.isSafeInteger(id)||id<=0||excluded().includes(id))throw Error('不能操控 Cupbox 自身或批准窗口');return id;};
 const window=id=>{const n=load();allowed(id);if(!n.getWindows().includes(id))throw Error('目标窗口已关闭，请重新选择');const title=n.getWindowTitle(id),raw=n.getWindowRect(id),screen=n.getScreenSize();const x=Math.max(0,raw.x),y=Math.max(0,raw.y),right=Math.min(screen.width,raw.x+raw.width),bottom=Math.min(screen.height,raw.y+raw.height);if(right-x<40||bottom-y<40)throw Error('窗口没有足够的主屏可见区域；请还原并移动到主屏');return{id,title,region:{x,y,width:right-x,height:bottom-y},geometry:JSON.stringify(raw)};};
 return{
  async available(){load();return true;},
  async list(){const n=load(),rows=[];for(const id of n.getWindows()){try{const item=window(id);if(item.title&&rows.length<100)rows.push(item);}catch{}}return rows;},
  async window(id){return window(id);},
  async focus(id){const n=load();window(id);n.focusWindow(id);await new Promise(r=>setTimeout(r,120));if(n.getActiveWindow()!==id)throw Error('目标窗口无法获得焦点，已停止；不会向其他窗口输入');},
  async foreground(id){if(load().getActiveWindow()!==allowed(id))throw Error('前台窗口已变化，本次输入已取消');},
  async capture(id){const n=load(),w=window(id);if(n.getActiveWindow()!==id)throw Error('截图目标没有位于前台');const r=w.region;if(r.width*r.height>20_000_000)throw Error('窗口区域过大，请缩小窗口');const bitmap=n.screen.capture(r.x,r.y,r.width,r.height);if(bitmap.bytesPerPixel!==4||bitmap.byteWidth<bitmap.width*4)throw Error('不支持的截图像素格式');const pixels=Buffer.alloc(bitmap.width*bitmap.height*4);for(let row=0;row<bitmap.height;row++)bitmap.image.copy(pixels,row*bitmap.width*4,row*bitmap.byteWidth,row*bitmap.byteWidth+bitmap.width*4);const data=await sharp(pixels,{raw:{width:bitmap.width,height:bitmap.height,channels:4}}).recomb([[0,0,1],[0,1,0],[1,0,0]]).removeAlpha().resize({width:1600,height:1000,fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true});return{png:data.data,width:data.info.width,height:data.info.height};},
  async input(id,action){const n=load();allowed(id);if(n.getActiveWindow()!==id)throw Error('前台窗口已变化');n.setMouseDelay(0);n.setKeyboardDelay(0);if(action.kind==='mouse'){n.moveMouse(action.x,action.y);if(n.getActiveWindow()!==id)throw Error('移动后前台窗口已变化，未点击');if(action.action==='scroll')n.scrollMouse(0,action.direction==='up'?action.steps:-action.steps);else if(action.action!=='move')n.mouseClick(action.action==='right_click'?'right':'left',action.action==='double_click');}else if(action.kind==='type')n.typeString(action.text);else{const parts=action.key.split('+'),key=parts.pop();n.keyTap(key,parts.map(p=>p==='ctrl'?'control':p));}},
 };
}
