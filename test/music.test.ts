import {describe,it,expect,vi,beforeEach} from 'vitest';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const mock=vi.hoisted(()=>({handlers:new Map(),windows:[]}));
vi.mock('electron',()=>({ipcMain:{handle:(name,fn)=>mock.handlers.set(name,fn)},BrowserWindow:{getAllWindows:()=>mock.windows,fromWebContents:()=>({})},dialog:{showOpenDialog:vi.fn()}}));
import {installMusic} from '../desktop/music.js';
beforeEach(()=>{mock.handlers.clear();mock.windows=[];});
const desktopDir=path.resolve('desktop');
function event(file='index.html'){const frame={},url=pathToFileURL(path.join(desktopDir,'ui',file)).href;return{senderFrame:frame,sender:{mainFrame:frame,getURL:()=>url}};}
describe('shared local music controls',()=>{
  it('starts enabled, persists disabling and restores the choice next launch',async()=>{
    let prefs:any={};const savePrefs=vi.fn(async p=>{prefs={...prefs,...p};});installMusic({desktopDir,getPrefs:async()=>prefs,savePrefs});
    expect(await mock.handlers.get('music:state')(event())).toMatchObject({enabled:true,playing:false});
    expect(await mock.handlers.get('music:set')(event('qq-bot.html'),false)).toMatchObject({enabled:false,playing:false,revision:1});expect(prefs.musicEnabled).toBe(false);
    installMusic({desktopDir,getPrefs:async()=>prefs,savePrefs});expect((await mock.handlers.get('music:state')(event())).enabled).toBe(false);
  });
  it('broadcasts one shared state while only the main window can report actual playback',async()=>{
    const send=vi.fn();mock.windows=[{isDestroyed:()=>false,webContents:{getURL:()=>event('qq-bot.html').sender.getURL(),send}}];installMusic({desktopDir,getPrefs:async()=>({}),savePrefs:async()=>{}});
    await mock.handlers.get('music:state')(event());await mock.handlers.get('music:report')(event(),{revision:0,playing:true});expect(send).toHaveBeenCalledWith('music:changed',expect.objectContaining({playing:true}));
    await expect(mock.handlers.get('music:report')(event('qq-bot.html'),{revision:0,playing:true})).rejects.toThrow();
    const paused=await mock.handlers.get('music:set')(event(),false);expect(paused.playing).toBe(false);await mock.handlers.get('music:report')(event(),{revision:0,playing:true});expect((await mock.handlers.get('music:state')(event())).playing).toBe(false);
  });
  it('rejects foreign windows, subframes and invalid settings',async()=>{
    installMusic({desktopDir,getPrefs:async()=>({}),savePrefs:async()=>{}});
    await expect(mock.handlers.get('music:state')(event('pet.html'))).rejects.toThrow();
    const sub=event();sub.senderFrame={};await expect(mock.handlers.get('music:state')(sub)).rejects.toThrow();
    expect(()=>mock.handlers.get('music:set')(event(),'yes')).toThrow();
  });
  it('advances automatically only from the owner with a current revision and skips disabled songs',async()=>{
    let prefs:any={};installMusic({desktopDir,getPrefs:async()=>prefs,savePrefs:async p=>{prefs={...prefs,...p};}});
    const command=p=>mock.handlers.get('music:command')(event(),p);
    const initial=await mock.handlers.get('music:state')(event());expect(initial.tracks).toHaveLength(8);
    await command({action:'mode',mode:'sequence'});await command({action:'disable',id:'where-the-light-rests',disabled:true});
    const before=await mock.handlers.get('music:state')(event());
    await mock.handlers.get('music:advance')(event(),before.revision-1);expect((await mock.handlers.get('music:state')(event())).currentId).toBe('petal-drift');
    const after=await mock.handlers.get('music:advance')(event(),before.revision);expect(after.currentId).toBe('morning-sync');
    expect(()=>mock.handlers.get('music:advance')(event('qq-bot.html'),after.revision)).toThrow();
    await expect(command({action:'remove',id:'petal-drift'})).rejects.toThrow('系统歌曲');
    await expect(command({action:'volume',volume:Infinity})).rejects.toThrow();
  });
});
