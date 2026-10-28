import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {EventEmitter} from 'node:events';
const ipc=vi.hoisted(()=>({answer:null as null|((event:any,p:any)=>void)}));
vi.mock('electron',()=>({ipcMain:{on:(_name:string,fn:any)=>{ipc.answer=fn;}}}));
// @ts-ignore Desktop module is JavaScript.
import {uiMessageBox} from '../desktop/ui-prompts.js';
function fixture(){const sender=Object.assign(new EventEmitter(),{send:vi.fn(),isDestroyed:()=>false});const window={webContents:sender,isDestroyed:()=>false,isMinimized:()=>false,show:vi.fn(),focus:vi.fn()};const result=uiMessageBox(window,{type:'warning',title:'危险操作',buttons:['取消','执行'],cancelId:0});const prompt=sender.send.mock.calls.find(x=>x[0]==='ui:prompt')![1];return{sender,window,result,prompt};}
describe('themed risk confirmation authority',()=>{
  beforeEach(()=>vi.useFakeTimers());afterEach(()=>{vi.runAllTimers();vi.useRealTimers();});
  it('requires matching sender, token and explicit risk acknowledgement',async()=>{const f=fixture();const done=vi.fn();f.result.then(done);ipc.answer!({sender:{}},{id:f.prompt.id,response:1,ack:true});ipc.answer!({sender:f.sender},{id:'unknown',response:1,ack:true});ipc.answer!({sender:f.sender},{id:f.prompt.id,response:1});ipc.answer!({sender:f.sender},{id:f.prompt.id,response:99,ack:true});await Promise.resolve();expect(done).not.toHaveBeenCalled();ipc.answer!({sender:f.sender},{id:f.prompt.id,response:1,ack:true});expect(await f.result).toEqual({response:1});expect(f.sender.listenerCount('destroyed')).toBe(0);});
  it('allows cancellation without acknowledgement and rejects replay',async()=>{const f=fixture();ipc.answer!({sender:f.sender},{id:f.prompt.id,response:0});expect(await f.result).toEqual({response:0});ipc.answer!({sender:f.sender},{id:f.prompt.id,response:1,ack:true});expect(f.sender.send.mock.calls.filter(x=>x[0]==='ui:prompt:closed')).toHaveLength(1);});
  it('cancels expired confirmation rather than granting permission',async()=>{const f=fixture();vi.advanceTimersByTime(120000);expect(await f.result).toEqual({response:0});});
  it('cancels on navigation and removes lifecycle listeners',async()=>{const f=fixture();f.sender.emit('did-start-navigation');expect(await f.result).toEqual({response:0});expect(f.sender.listenerCount('destroyed')).toBe(0);});
  it('cancels when the requesting window is destroyed',async()=>{const f=fixture();f.sender.emit('destroyed');expect(await f.result).toEqual({response:0});});
  it('does not create an approval when no window exists',async()=>{expect(await uiMessageBox(null,{cancelId:2})).toEqual({response:2});});
  it('aborting a pending confirmation cancels it immediately',async()=>{const f=fixture();ipc.answer!({sender:f.sender},{id:f.prompt.id,response:0});await f.result;const controller=new AbortController();const result=uiMessageBox(f.window,{type:'warning',buttons:['取消','执行'],signal:controller.signal});controller.abort();expect(await result).toEqual({response:0});expect(f.sender.listenerCount('destroyed')).toBe(0);});
  it('an already aborted request never displays a prompt',async()=>{const f=fixture();ipc.answer!({sender:f.sender},{id:f.prompt.id,response:0});await f.result;const before=f.sender.send.mock.calls.length;const controller=new AbortController();controller.abort();expect(await uiMessageBox(f.window,{signal:controller.signal})).toEqual({response:0});expect(f.sender.send.mock.calls).toHaveLength(before);});
});
