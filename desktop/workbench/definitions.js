import {OFFICE_DEFINITIONS} from './office-definitions.js';
const string={type:'string'},number={type:'number'},bool={type:'boolean'},strings={type:'array',items:string};
const fs={encoding:{type:'string',enum:['utf8','utf8bom','gbk','utf16le','binary']},eol:{type:'string',enum:['preserve','lf','crlf']},dryRun:bool,confirmToken:string};
const schema=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const d=(name,description,properties,required=[],risk='read')=>({name,description,parameters:schema(properties,required),risk,readOnly:risk==='read'});
const writeHint=' 默认仅预览；真正执行必须使用 dryRun:false 和上一次同参数预览返回的 confirmToken。';
export const DEFINITIONS=[
 d('fs_read','分页读取文件，默认带行号、最多256KB；编码不确定明确报错。',{...fs,path:string,startLine:number,endLine:number,maxBytes:number,withLineNumbers:bool,pattern:string,context:number},['path']),
 d('fs_write','原子写入，保留编码/EOL/BOM，备份并检查冲突。'+writeHint,{...fs,path:string,content:string,mode:{type:'string',enum:['overwrite','append','prepend','createOnly']},createParents:bool,backup:bool},['path','content'],'write'),
 d('fs_edit','精确编辑，零处或多处匹配报 E_AMBIGUOUS_MATCH。'+writeHint,{...fs,path:string,oldText:string,newText:string,replaceAll:bool,fuzzy:bool},['path','oldText','newText'],'write'),
 d('fs_patch','应用多文件 unified diff，失败则全部回滚。'+writeHint,{...fs,patch:string,reverse:bool,fuzz:number,allowPartial:bool},['patch'],'write'),
 d('fs_mkdir','创建目录。'+writeHint,{...fs,path:string,recursive:bool},['path'],'write'),
 d('fs_mv','移动文件或目录；不覆盖目标，除非 overwrite:true。'+writeHint,{...fs,from:string,to:string,recursive:bool,overwrite:bool},['from','to'],'write'),
 d('fs_cp','复制文件或目录。'+writeHint,{...fs,from:string,to:string,recursive:bool,overwrite:bool},['from','to'],'write'),
 d('fs_rm','可恢复删除，默认移入回收站/隔离区并保存备份，拒绝永久删除。'+writeHint,{...fs,path:string,recursive:bool,toRecycleBin:bool},['path'],'write'),
 d('fs_stat','查看文件信息、编码、EOL、SHA256、真实路径。',{path:string,encoding:fs.encoding},['path']),
 d('fs_rollback','按操作 ID 回滚；之后再次修改过的文件会拒绝回滚。'+writeHint,{...fs,operationId:string},['operationId'],'write'),
 d('http','出网请求，DNS 解析及连接固定均拒绝私网；域名须授权；不继承 Cookie/环境密钥。',{url:string,method:{type:'string',enum:['GET','POST','PUT','PATCH','DELETE','HEAD']},headers:{type:'object',additionalProperties:string},body:{oneOf:[string,{type:'object',properties:{json:{},form:{type:'object',additionalProperties:string}}}]},timeoutMs:number,redirect:{type:'string',enum:['follow','manual','error']},maxBytes:number,saveTo:string,responseType:{type:'string',enum:['auto','text','json','binary']},...fs},['url'],'network'),
 d('diff','两文件或两目录 unified diff 与增删统计。',{left:string,right:string,ignoreWhitespace:bool,context:number,encoding:fs.encoding},['left','right']),
 d('grep','结构化搜索：行号、列、上下文、多行，尊重 .gitignore。',{root:string,pattern:string,regex:bool,multiline:bool,caseSensitive:bool,glob:{oneOf:[string,strings]},contextBefore:number,contextAfter:number,maxMatchesPerFile:number,maxFiles:number,groupByFile:bool,encoding:fs.encoding},['pattern']),
 d('replace','跨文件批量替换，逐文件预览，默认跳过二进制和大文件。'+writeHint,{...fs,root:string,pattern:string,replacement:string,regex:bool,glob:{oneOf:[string,strings]},ignore:strings},['pattern','replacement'],'write'),
 d('pty_spawn','启动真实持久终端，命令完整展示且每次人工批准，仅本机运行。',{command:string,cwd:string,env:{type:'object',additionalProperties:string},cols:number,rows:number},['command'],'shell'),
 d('pty_write','向当前会话终端发送输入；非 Ctrl-C 输入始终人工批准。',{sessionId:string,input:string},['sessionId','input'],'shell'),
 d('pty_read','增量读取终端输出，传 since 或使用上次游标，防止重复。',{sessionId:string,since:number,maxBytes:number},['sessionId']),
 d('pty_kill','只终止当前项目会话拥有的终端及子进程。',{sessionId:string},['sessionId'],'system'),
 d('pty_list','列出当前项目会话拥有的终端。',{}),
 d('run','白名单执行或每次人工批准的 shell 逃生舱；allowPrefixes 从已批准项目策略取得。',{command:string,mode:{type:'string',enum:['whitelist','shell']},cwd:string,timeoutMs:number,maxOutputChars:number,allowPrefixes:string},['command'],'shell'),
 d('proc','列出进程/端口；kill 保留 PID+名称校验；守护进程使用会话 PTY。',{action:{type:'string',enum:['list','kill','start','stop','list-daemons']},query:string,withPort:bool,pid:number,name:string,port:number,command:string,sessionId:string,cwd:string},[],'system'),
 ...['convert','resize','crop','diff','info','sample'].map(op=>d('image_'+op,'图片'+op+( ['info','sample'].includes(op)?'。':'。'+writeHint),{...fs,input:string,output:string,a:string,b:string,format:{type:'string',enum:['png','jpeg','webp','avif']},quality:number,stripMetadata:bool,width:number,height:number,fit:{type:'string',enum:['cover','contain','fill']},maxSide:number,x:number,y:number,w:number,h:number,threshold:number,ignoreAntiAlias:bool},[],['info','sample'].includes(op)?'read':'write')),
 d('git','参数数组调用 Git；写操作默认预览，commit/checkout/stash 需确认。禁止 push、强制清理及任意子命令。',{...fs,action:{type:'string',enum:['status','diff','log','branch','add','commit','checkout','stash']},paths:strings,message:string,staged:bool,maxCount:number,branch:string},['action'],'system'),
 d('pkg','检测锁文件、脚本或运行指定脚本；运行始终人工批准，不使用字符串拼接。',{action:{type:'string',enum:['detect','run']},script:string,args:strings,cwd:string},['action'],'shell'),
 d('test','执行测试并解析 Jest/Vitest JSON 或 Node TAP；返回结构化失败。不支持任意 shell 字符。',{command:string,runner:{type:'string',enum:['vitest','jest','node:test','auto']},file:string,args:strings,cwd:string},[],'shell'),
 d('memory_remember','保存明确的全局/项目记忆；默认 project，项目隔离并支持 TTL 秒。',{text:string,source:string,scope:{type:'string',enum:['global','project']},projectKey:string,ttl:number},['text'],'write'),
 d('memory_recall','检索指定命名空间，默认只检索当前项目。',{query:string,scope:{type:'string',enum:['global','project']},projectKey:string,limit:number}),
 d('memory_manage','列出/遗忘指定命名空间的事实。导出只生成 fs_write 预览。',{...fs,list:bool,forget:string,scope:{type:'string',enum:['global','project']},exportTo:string},[],'write'),
 d('task','当前项目跨会话待办。清除需人工批准。',{action:{type:'string',enum:['add','list','done','clear']},workspaceKey:string,text:string,id:string},['action'],'write'),
 d('context_stats','本次项目会话按文件与工具归因的 token 近似开销。',{byFile:bool,byTool:bool}),
 ...OFFICE_DEFINITIONS,
 d('clipboard_image','读写图片剪贴板，仅本机运行，访问始终人工批准。写入需项目内图片路径。',{action:{type:'string',enum:['read','write']},path:string},['action'],'system'),
];
