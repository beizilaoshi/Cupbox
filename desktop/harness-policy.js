import path from 'node:path';
import {checkProtectedStorage} from './protected-storage.js';
import {agentPresetAllowsTool} from './agent-presets.js';
import {inside} from './execution-policy.js';
const aliases={read:'fs_read',read_image:'fs_read',write:'fs_write',edit:'fs_edit',pwsh:'run',bash:'run',apply_patch:'fs_patch'};
export function canAutoApproveWork(payload,prefs,workspace){return prefs.approvalMode==='full'&&['write','edit'].includes(payload.name)&&typeof payload.args?.file_path==='string'&&inside(path.resolve(workspace),path.resolve(workspace,payload.args.file_path));}
export async function nativeWorkGuard({name,args={},workspace,home,prefs,presetId}){
 const alias=aliases[name]||name,disabled=prefs.disabledTools||[];
 if(disabled.includes(name)||disabled.includes(alias)||!agentPresetAllowsTool(presetId,alias,prefs.customAgentPresets,prefs.agentPluginStates))throw Error('当前设置未启用这项工具');
 if(prefs.filesystemTools===false&&/^(?:read|read_image|write|edit|glob|grep|fs_|apply_patch)/.test(name))throw Error('文件工具已关闭');
 if(prefs.executionEnvironment!=='native'&&(/^(?:terminal_|pty_)/.test(name)||['pwsh','bash','terminal','run','proc'].includes(name)))throw Error('当前为沙箱模式，本机命令需要在权限与运行中启用');
 for(const key of ['file_path','path','cwd','directory','root','workdir','from','to','source','destination'])if(typeof args[key]==='string'&&args[key])await checkProtectedStorage(path.resolve(workspace,args[key]),!['read','read_image','glob','grep'].includes(name),[home]);
 return true;
}
