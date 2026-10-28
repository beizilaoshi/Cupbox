// Keep the original CLI lifecycle while allowing Cupbox to request graceful stop.
process.on('message',message=>{if(message?.type==='cupbox:stop')process.emit('SIGTERM');});
process.on('disconnect',()=>process.emit('SIGTERM'));
process.channel?.unref();
const {runCli}=await import('./node_modules/@deepseek-ai/dsh/lib/bin.js');
const {fileURLToPath}=await import('node:url');
await runCli({packageManager:{command:process.execPath,args:[fileURLToPath(new URL('./node_modules/pnpm/bin/pnpm.cjs',import.meta.url))],env:process.env}});
