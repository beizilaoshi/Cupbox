import {ipcMain,BrowserWindow,dialog,safeStorage} from 'electron';
import {EchoMusicSession} from './qq/echo-music-session.js';
import {BackgroundMusicOnline} from './background-music-online.js';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {MusicLibrary,MUSIC_FORMATS} from './music-library.js';

/** One renderer owns the audio; both local windows control the same track. */
export function installMusic({desktopDir,getDirectory=()=>path.join(desktopDir,'music'),getPrefs,savePrefs,confirmRemove=async()=>false}){
  const host=pathToFileURL(path.join(desktopDir,'ui/index.html')).href;
  const allowed=new Set([host,pathToFileURL(path.join(desktopDir,'ui/qq-bot.html')).href]);
  const library=new MusicLibrary({desktopDir,getDirectory,getPrefs,savePrefs});
  const session=new EchoMusicSession(path.dirname(getDirectory()),{encrypt:text=>{if(!safeStorage.isEncryptionAvailable())throw Error('本机加密不可用，不能保存音乐登录');return safeStorage.encryptString(text);},decrypt:bytes=>safeStorage.decryptString(bytes)}),online=new BackgroundMusicOnline({session,library});
  let state={enabled:true,playing:false,error:false,revision:0},ready,pending=Promise.resolve();
  const snapshot=()=>{const list=library.snapshot(),current=list.tracks.find(t=>t.id===list.currentId);return {...state,...list,title:current?.title||'暂无可播放歌曲'};};
  function trust(e,owner=false){if(e.senderFrame!==e.sender.mainFrame||!(owner?e.sender.getURL()===host:allowed.has(e.sender.getURL())))throw Error('音乐控制仅接受本机应用窗口');}
  function emit(){for(const w of BrowserWindow.getAllWindows())if(!w.isDestroyed()&&allowed.has(w.webContents.getURL()))w.webContents.send('music:changed',snapshot());}
  function init(){return ready||=(async()=>{const prefs=await getPrefs();state.enabled=prefs.musicEnabled!==false;await library.init();})();}
  function queue(action){const task=pending.catch(()=>{}).then(async()=>{await init();return action();});pending=task;return task;}
  function changed(previous){state={...state,error:false,playing:previous!==library.current?false:state.playing,revision:state.revision+1};emit();return snapshot();}
  const handleOnline=(name,fn)=>ipcMain.handle('bgmusic:'+name,async(e,p)=>{trust(e,true);try{await init();return{ok:true,value:await fn(p)}}catch(error){return{ok:false,error:error.message||'背景音乐操作失败'}}});
  handleOnline('login:status',()=>session.status());handleOnline('login:method',p=>session.setMethod(p.method));handleOnline('login:begin',p=>session.begin(p?.method||'kugou'));handleOnline('login:poll',()=>session.poll());handleOnline('login:sms',p=>session.sendSms(p));handleOnline('login:form',p=>session.loginForm(p));handleOnline('login:verify',()=>session.verify());handleOnline('login:cancel',()=>{session.cancelLogin();return session.status();});handleOnline('login:logout',()=>{online.results.clear();online.playlists.clear();return session.logout();});handleOnline('search',p=>online.search(p?.query));handleOnline('add',p=>queue(async()=>{const previous=library.current,summary=await online.add(p?.token);return{...changed(previous),importResult:summary};}));
  handleOnline('playlists',()=>online.listPlaylists());
  handleOnline('sync',p=>queue(async()=>{const previous=library.current,summary=await online.syncPlaylist(p?.token);return{...changed(previous),syncResult:summary};}));
  handleOnline('add-network',p=>queue(async()=>{const previous=library.current,summary=await online.addNetwork(p?.token);return{...changed(previous),syncResult:summary};}));
  handleOnline('resolve',p=>online.resolve(p?.id));
  ipcMain.handle('music:state',async e=>{trust(e);await init();return snapshot();});
  ipcMain.handle('music:set',(e,enabled)=>{trust(e);if(typeof enabled!=='boolean')throw Error('音乐开关无效');const task=pending.catch(()=>{}).then(async()=>{await init();await savePrefs({musicEnabled:enabled});state={...state,enabled,playing:enabled?state.playing:false,error:false,revision:state.revision+1};emit();return snapshot();});pending=task;return task;});
  ipcMain.handle('music:report',async(e,value)=>{trust(e,true);await init();if(value?.revision!==state.revision)return snapshot();state={...state,playing:state.enabled&&Boolean(library.current)&&value.playing===true,error:state.enabled&&Boolean(library.current)&&value.error===true};emit();return snapshot();});
  ipcMain.handle('music:advance',(e,revision)=>{trust(e,true);return queue(async()=>{if(revision!==state.revision||!state.enabled||!library.current)return snapshot();const previous=library.current;if(library.mode!=='single')await library.next();return changed(previous);});});
  ipcMain.handle('music:command',async(e,command)=>{
    trust(e);if(!command||typeof command!=='object')throw Error('音乐操作无效');
    const {action,id}=command;
    if(action==='remove'){
      trust(e,true);await init();const track=library.tracks.find(t=>t.id===id);if(!track)throw Error('歌曲不存在');if(track.system)throw Error('系统歌曲无法删除，只能禁用');
      if(!await confirmRemove(BrowserWindow.fromWebContents(e.sender),track))return {...snapshot(),canceled:true};
    }
    return queue(async()=>{
      const previous=library.current;
      if(action==='select'){await library.select(id,true);state.enabled=true;}
      else if(action==='next'||action==='previous')await library.next(action==='next'?1:-1);
      else if(action==='mode')await library.setMode(command.mode);
      else if(action==='volume')await library.setVolume(command.volume);
      else if(action==='disable')await library.disable(id,command.disabled);
      else if(action==='remove'){await library.remove(id);await online.removeCache(id);}
      else throw Error('音乐操作无效');
      return changed(previous);
    });
  });
  ipcMain.handle('music:import',async e=>{
    trust(e,true);await init();const result=await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender),{title:'导入本地音乐',properties:['openFile','multiSelections'],filters:[{name:'音频文件',extensions:MUSIC_FORMATS}]});
    if(result.canceled||!result.filePaths.length)return {...snapshot(),canceled:true};
    return queue(async()=>{const previous=library.current,summary=await library.importFiles(result.filePaths);return {...changed(previous),importResult:summary};});
  });
  return{snapshot};
}
