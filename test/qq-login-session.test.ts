import {describe,it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {LoginSession} from '../desktop/qq/login-session.js';
import {NapCatManager} from '../desktop/qq/napcat.js';
import {QQService} from '../desktop/qq/service.js';
import {validateSettings} from '../desktop/qq/store.js';

const cleanups:(()=>any)[]=[];afterEach(async()=>{for(const fn of cleanups.splice(0))await fn();});
async function home(){const dir=await mkdtemp(path.join(os.tmpdir(),'qq-login-'));cleanups.push(()=>rm(dir,{recursive:true,force:true}));return dir;}
async function manager(){const m=new NapCatManager(await home());await m.savedLogin.save('123456');m.remembered=await m.rememberedLogin();m.quickLoginChecks=0;m.restorePolls=0;m.restoreState='restoring';return m;}

describe('QQ 本机记住登录与自动恢复',()=>{
  it('仅持久化已验证账号，重启可读，不额外写入密码或票据',async()=>{
    const dir=await home(),session=new LoginSession(dir);await session.save('123456');expect(await new LoginSession(dir).read()).toMatchObject({account:'123456'});
    expect(Object.keys(JSON.parse(await readFile(session.file,'utf8'))).sort()).toEqual(['account','savedAt','version']);await expect(session.save('../secret')).rejects.toThrow();await writeFile(session.file,'{bad json');expect(await session.read()).toBeNull();
  });
  it('仅恢复明确记住的账号，不误选其他可登录账号，且每次启动最多尝试一次',async()=>{
    const m=await manager();let online=false;
    m.api=vi.fn(async(route:string,args:any)=>{if(route.endsWith('CheckLoginStatus'))return{isLogin:online};if(route.endsWith('GetQuickLoginList'))return['777777','123456'];if(route.endsWith('SetQuickLogin')){expect(args).toEqual({uin:'123456'});online=true;return null;}if(route.endsWith('GetQQLoginInfo'))return{uin:'123456',Credential:'must-not-expose'};});
    const state=await m.status();expect(state).toMatchObject({loggedIn:true,rememberedAccount:'123456',loginRestore:'remembered'});expect(JSON.stringify(state)).not.toContain('must-not-expose');await m.status();expect(m.api.mock.calls.filter(([route])=>route.endsWith('SetQuickLogin'))).toHaveLength(1);
  });
  it('首次扫码成功后记录实际账号，而非把快速登录请求当成登录成功',async()=>{
    const m=new NapCatManager(await home());m.api=vi.fn(async(route:string)=>route.endsWith('GetQQLoginInfo')?{uin:'654321'}:{isLogin:true});expect((await m.status()).loggedIn).toBe(true);expect(await new LoginSession(m.root).read()).toMatchObject({account:'654321'});
    const waiting=await manager();waiting.api=vi.fn(async(route:string)=>route.endsWith('GetQuickLoginList')?['123456']:route.endsWith('SetQuickLogin')?null:{isLogin:false});expect((await waiting.status()).loggedIn).toBe(false);for(let i=0;i<5;i++)await waiting.status();expect(waiting.restoreState).toBe('scan_required');
  });
  it('失效时回到二维码，不循环重试、不切换到其他账号',async()=>{
    const m=await manager();m.api=vi.fn(async(route:string)=>{if(route.endsWith('CheckLoginStatus'))return{isLogin:false,qrcodeurl:'https://example.com/qr'};if(route.endsWith('GetQuickLoginList'))return['123456'];throw Error('credential expired');});
    const state=await m.status();expect(state).toMatchObject({loggedIn:false,loginRestore:'scan_required'});expect(state.qr).toContain('data:image/png');await m.status();expect(m.api.mock.calls.filter(([route])=>route.endsWith('SetQuickLogin'))).toHaveLength(1);
    const other=await manager();other.api=vi.fn(async(route:string)=>route.endsWith('GetQuickLoginList')?['777777']:{isLogin:false});for(let i=0;i<5;i++)await other.status();expect(other.restoreState).toBe('scan_required');expect(other.api.mock.calls.some(([route])=>route.endsWith('SetQuickLogin'))).toBe(false);
  });
  it('扫码已被接受时不抢占登录，手动刷新二维码会终止本次自动恢复',async()=>{
    const m=await manager();m.api=vi.fn(async()=>({isLogin:false,qrLoginAccepted:true,loginPhase:'qrcode_scanned'}));await m.status();expect(m.api).toHaveBeenCalledTimes(1);await m.refreshQR();expect(m.quickLoginTried).toBe(true);expect(m.restoreState).toBe('scan_required');
  });
  it('停止不会清除原生登录数据，控制台凭据仍从内存清除',async()=>{
    const m=await manager(),profile=path.join(m.root,'qq-profile');await mkdir(profile,{recursive:true});await writeFile(path.join(profile,'fixture-session'),'fake-native-cache');m.credential='temporary-webui-credential';m.stop();expect(m.credential).toBe('');expect(await readFile(path.join(profile,'fixture-session'),'utf8')).toBe('fake-native-cache');expect(await m.rememberedLogin()).toMatchObject({account:'123456'});
  });
  it('仅在有记住的账号且运行时已安装时自动启动，并遵守关闭开关',async()=>{
    const dir=await home(),napcat={installed:vi.fn(async()=>true),rememberedLogin:vi.fn(async()=>({account:'123456'})),stop:vi.fn()},s=await new QQService({home:dir,choices:{},napcat}).init();cleanups.unshift(async()=>{s.background?.dispose();await s.stop();});s.start=vi.fn(async()=>({}));
    expect(validateSettings({}).restoreLoginOnOpen).toBe(true);expect(await s.restoreLoginOnOpen()).toBe(true);expect(s.start).toHaveBeenCalledOnce();s.start.mockClear();s.config.restoreLoginOnOpen=false;expect(await s.restoreLoginOnOpen()).toBe(false);s.config.restoreLoginOnOpen=true;napcat.rememberedLogin.mockResolvedValue(null);expect(await s.restoreLoginOnOpen()).toBe(false);napcat.rememberedLogin.mockResolvedValue({account:'123456'});napcat.installed.mockResolvedValue(false);expect(await s.restoreLoginOnOpen()).toBe(false);expect(s.start).not.toHaveBeenCalled();
  });
});
