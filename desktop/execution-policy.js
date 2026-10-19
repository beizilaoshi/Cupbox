import path from 'node:path';
import { realpath, lstat, readdir, mkdir } from 'node:fs/promises';

export const SYSTEM_TOOLS = new Set(['run','proc','clip','shot','ocr','zip']);
export const PURE_TOOLS = new Set(['time','codec','csv']);
export function classifyTool(tool, args = {}) {
  if (PURE_TOOLS.has(tool) || tool === 'hash' || tool === 'search' || (['rename','organize'].includes(tool) && args.dryRun !== false)) return 'read';
  if (['obfuscate','rename','organize'].includes(tool) || (tool === 'zip' && args.action !== 'list')) return 'write';
  return 'system';
}
export function needsApproval(mode, tool, args) {
  return mode === 'full' ? false : mode === 'ask' ? true : classifyTool(tool,args) !== 'read';
}
export function inside(root, target) {
  const relative = path.relative(root,target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
async function checkedPath(root, value) {
  const target = path.resolve(root,String(value));
  if (!inside(root,target)) throw new Error('沙箱不能访问此路径，请先导入文件到沙箱，或切换到本机运行');
  let ancestor = target;
  while (true) {
    try {
      const canonical = await realpath(ancestor);
      if (!inside(root,canonical)) throw new Error('沙箱不允许通过链接访问外部文件');
      break;
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw e;
      ancestor = parent;
    }
  }
  return target;
}
async function rejectLinks(dir, count = {n:0}) {
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    if (++count.n > 20000) throw new Error('沙箱目录过大，请分批处理文件');
    if (entry.isSymbolicLink()) throw new Error('沙箱不支持符号链接或目录联接，请移除链接后重试');
    if (entry.isDirectory()) await rejectLinks(path.join(dir,entry.name),count);
  }
}
export async function sandboxArgs(tool, input, folder) {
  if (SYSTEM_TOOLS.has(tool)) throw new Error('此工具需要系统能力，请切换到「本机运行」后使用');
  await mkdir(folder,{recursive:true});
  const root = await realpath(folder);
  const args = {...input};
  const fields = {hash:['file'],search:['root'],rename:['dir'],organize:['dir'],obfuscate:['input','output']}[tool] || [];
  for (const key of fields) {
    if (!args[key] && ['dir','root'].includes(key)) args[key] = root;
    if (args[key]) args[key] = await checkedPath(root,args[key]);
  }
  if (['search','rename','organize'].includes(tool)) await rejectLinks(args.dir || args.root);
  // Image tools can create a default output next to the validated input.
  if (args.file && (await lstat(args.file)).isSymbolicLink()) throw new Error('请导入原文件，不要使用符号链接');
  return {args,root};
}
