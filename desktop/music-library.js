import path from 'node:path';
import {mkdir,readFile,open,copyFile,rm,stat} from 'node:fs/promises';
import {createHash,randomUUID,randomInt} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const SYSTEM_MUSIC=Object.freeze([
  {id:'petal-drift',title:'Petal Drift',file:'petal-drift.mp3'},
  {id:'where-the-light-rests',title:'Where the Light Rests',file:'where-the-light-rests.mp3'},
  {id:'morning-sync',title:'Morning Sync',file:'morning-sync.mp3'},
  {id:'petals-on-the-glass',title:'Petals on the Glass',file:'petals-on-the-glass.mp3'},
  {id:'petals-on-the-surface',title:'Petals on the Surface',file:'petals-on-the-surface.mp3'},
  {id:'petal-drift-2',title:'Petal Drift 2',file:'petal-drift-2.mp3'},
  {id:'sunlight-through-glass',title:'Sunlight Through Glass',file:'sunlight-through-glass.mp3'},
  {id:'the-petals-at-daybreak',title:'The Petals at Daybreak',file:'the-petals-at-daybreak.mp3'}
]);
export const MUSIC_FORMATS=['mp3','wav','ogg','m4a','flac','aac','webm'];
const LIMIT=80*1024*1024,MAX_TRACKS=200;
const customId=/^custom-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const modes=new Set(['single','sequence','random']);

export async function validateMusicFile(file){
  const ext=path.extname(file).slice(1).toLowerCase(),info=await stat(file);
  if(!MUSIC_FORMATS.includes(ext))throw Error('不支持的音乐格式');
  if(!info.isFile()||info.size<16||info.size>LIMIT)throw Error('请选择有效音频文件，每首最大 80 MB');
  const handle=await open(file,'r'),header=Buffer.alloc(256);let bytesRead;
  try{({bytesRead}=await handle.read(header,0,header.length,0));}finally{await handle.close();}
  const b=header.subarray(0,bytesRead),text=(a,n)=>b.toString('ascii',a,a+n);
  const valid=ext==='mp3'?(text(0,3)==='ID3'||b[0]===255&&(b[1]&224)===224):
    ext==='wav'?text(0,4)==='RIFF'&&text(8,4)==='WAVE':
    ext==='ogg'?text(0,4)==='OggS':ext==='flac'?text(0,4)==='fLaC':
    ext==='m4a'?text(4,4)==='ftyp':ext==='aac'?b[0]===255&&(b[1]&246)===240:
    b.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  if(!valid)throw Error('文件内容与音频格式不符');
  return {ext,size:info.size};
}

export function nextMusicId(tracks,current,mode,direction=1,pick=n=>randomInt(n)){
  const available=tracks.filter(t=>!t.disabled);if(!available.length)return null;
  if(mode==='random'&&available.length>1){const choices=available.filter(t=>t.id!==current);return choices[pick(choices.length)].id;}
  const index=available.findIndex(t=>t.id===current);return available[index<0?0:(index+direction+available.length)%available.length].id;
}

/** Files are copied into the user library; delete never touches the source selection. */
export class MusicLibrary{
  constructor({desktopDir,getDirectory,getPrefs,savePrefs}){Object.assign(this,{desktopDir,getDirectory,getPrefs,savePrefs});this.custom=[];this.disabled=[];this.current='petal-drift';this.mode='single';this.volume=.3;this.history=[];}
  async init(){
    const p=await this.getPrefs();
    this.custom=(Array.isArray(p.musicTracks)?p.musicTracks:[]).filter(t=>t&&customId.test(t.id)&&MUSIC_FORMATS.includes(t.ext)&&typeof t.title==='string'&&/^[0-9a-f]{64}$/.test(t.hash)).slice(0,MAX_TRACKS).map(t=>({id:t.id,ext:t.ext,title:t.title.slice(0,100),hash:t.hash,size:Number(t.size)||0}));
    this.custom=this.custom.filter((t,i,a)=>a.findIndex(x=>x.id===t.id)===i);
    const ids=new Set([...SYSTEM_MUSIC,...this.custom].map(t=>t.id));
    this.disabled=[...new Set((Array.isArray(p.musicDisabled)?p.musicDisabled:[]).filter(id=>ids.has(id)))];
    this.mode=modes.has(p.musicMode)?p.musicMode:'single';this.volume=typeof p.musicVolume==='number'&&Number.isFinite(p.musicVolume)?Math.max(0,Math.min(1,p.musicVolume)):.3;
    this.current=ids.has(p.musicCurrent)&&!this.disabled.includes(p.musicCurrent)?p.musicCurrent:nextMusicId(this.tracks,null,'sequence');
    this.history=this.current?[this.current]:[];
  }
  file(track){return track.system?path.join(this.desktopDir,'ui/assets/audio',track.file):path.join(this.getDirectory(),track.id+'.'+track.ext);}
  get tracks(){return [...SYSTEM_MUSIC.map(t=>({...t,system:true})),...this.custom.map(t=>({...t,system:false}))].map(t=>({...t,disabled:this.disabled.includes(t.id)}));}
  snapshot(){return {tracks:this.tracks.map(t=>({id:t.id,title:t.title,system:t.system,disabled:t.disabled,url:pathToFileURL(this.file(t)).href})),currentId:this.current,mode:this.mode,volume:this.volume};}
  async persist(patch={},extra={}){
    // Commit preferences before exposing a new in-memory state, so failed saves do not lie.
    const next={custom:this.custom,disabled:this.disabled,current:this.current,mode:this.mode,volume:this.volume,...patch};
    await this.savePrefs({musicTracks:next.custom,musicDisabled:next.disabled,musicCurrent:next.current,musicMode:next.mode,musicVolume:next.volume,...extra});Object.assign(this,next);
    if(this.current&&this.history.at(-1)!==this.current)this.history=[...this.history.slice(-199),this.current];
  }
  async select(id,enable=false){if(!this.tracks.some(t=>t.id===id&&!t.disabled))throw Error('歌曲不存在或已禁用');await this.persist({current:id},enable?{musicEnabled:true}:{});}
  async next(direction=1){
    if(direction<0){const available=new Set(this.tracks.filter(t=>!t.disabled).map(t=>t.id));for(let i=this.history.length-2;i>=0;i--)if(available.has(this.history[i])&&this.history[i]!==this.current){const history=this.history.slice(0,i+1);await this.persist({current:history[i]});this.history=history;return;}}
    await this.persist({current:nextMusicId(this.tracks,this.current,this.mode,direction)});
  }
  async setMode(mode){if(!modes.has(mode))throw Error('播放模式无效');await this.persist({mode});}
  async setVolume(volume){if(typeof volume!=='number'||!Number.isFinite(volume)||volume<0||volume>1)throw Error('音量无效');await this.persist({volume});}
  async disable(id,disabled){
    if(typeof disabled!=='boolean'||!this.tracks.some(t=>t.id===id))throw Error('歌曲设置无效');
    const list=this.disabled.filter(x=>x!==id);if(disabled)list.push(id);
    const tracks=this.tracks.map(t=>({...t,disabled:list.includes(t.id)}));
    const current=tracks.some(t=>t.id===this.current&&!t.disabled)?this.current:nextMusicId(tracks,this.current,'sequence');await this.persist({disabled:list,current});
  }
  async remove(id){
    const track=this.tracks.find(t=>t.id===id);if(!track)throw Error('歌曲不存在');if(track.system)throw Error('系统歌曲无法删除，只能禁用');
    const remaining=this.tracks.filter(t=>t.id!==id),current=id===this.current?nextMusicId(remaining,id,'sequence'):this.current;
    await this.persist({custom:this.custom.filter(t=>t.id!==id),disabled:this.disabled.filter(x=>x!==id),current});
    // Only the generated, validated managed filename is eligible for removal.
    await rm(this.file(track),{force:true}).catch(()=>{});
  }
  async importFiles(files){
    const added=[],skipped=[];if(files.length>20)throw Error('一次最多导入 20 首歌曲');
    await mkdir(this.getDirectory(),{recursive:true});
    const hashes=new Set(this.custom.map(t=>t.hash));
    for(const track of SYSTEM_MUSIC){try{hashes.add(createHash('sha256').update(await readFile(this.file({...track,system:true}))).digest('hex'));}catch{}}
    try{
      for(const source of files){
        const title=path.basename(source,path.extname(source)).replace(/[\u0000-\u001f]/g,'').slice(0,100)||'未命名音乐';
        let destination;
        try{
          if(this.custom.length+added.length>=MAX_TRACKS)throw Error('自定义歌单最多 200 首');
          const {ext}=await validateMusicFile(source),id='custom-'+randomUUID();destination=path.join(this.getDirectory(),id+'.'+ext);
          await copyFile(source,destination);const {size}=await validateMusicFile(destination),hash=createHash('sha256').update(await readFile(destination)).digest('hex');
          if(hashes.has(hash)){await rm(destination,{force:true});destination=null;skipped.push(title+'：已在歌单中');continue;}
          added.push({id,title,ext,hash,size});hashes.add(hash);
        }catch(error){if(destination)await rm(destination,{force:true}).catch(()=>{});skipped.push(title+'：'+error.message);}
      }
      if(added.length)await this.persist({custom:[...this.custom,...added],current:this.current||added[0].id});
    }catch(error){await Promise.all(added.map(t=>rm(path.join(this.getDirectory(),t.id+'.'+t.ext),{force:true}).catch(()=>{})));throw error;}
    return {added:added.length,skipped};
  }
}
