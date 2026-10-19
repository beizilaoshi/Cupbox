// Runs only known built-in tools with Node's permission model enabled by the parent.
import { runTool } from '../dist/core/toolkit.js';
let input='';
for await (const chunk of process.stdin) {
  input += chunk;
  if(input.length>4*1024*1024) throw new Error('输入内容超过沙箱限制');
}
try {
  if (!process.permission || process.permission.has('child') || process.permission.has('net')) throw new Error('沙箱限制未成功启用');
  const {tool,args}=JSON.parse(input);
  const result=await runTool(tool,args);
  process.stdout.write(JSON.stringify({ok:true,result}));
} catch(e) { process.stdout.write(JSON.stringify({ok:false,error:e.code==='ERR_ACCESS_DENIED'?'沙箱阻止了越界文件访问或系统操作':e.message})); }
