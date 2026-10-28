// Use-It Agent 本地引擎（PowerPoint / Word / Excel / AutoCAD / 桌面 GUI）的工具定义。
// 引擎默认监听 127.0.0.1:8324，由 Python 后端提供 /api/v1/{app}/{action} 接口。
const string={type:'string'},number={type:'number'},bool={type:'boolean'};
const jsonActions={oneOf:[string,{type:'array',items:{type:'object',additionalProperties:true}}]};
const schema=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const d=(name,description,properties,required=[],risk='read')=>({name,description,parameters:schema(properties,required),risk,readOnly:risk==='read'});
const engineUrl={type:'string',description:'Use-It 引擎地址，默认 http://127.0.0.1:8324；只允许本机回环地址。'};
const timeoutMs={type:'number',description:'等待引擎响应的毫秒数，默认 60000。'};
const common={engineUrl,timeoutMs};

const PPT_ACTIONS='add_slide、goto_slide、delete_slide、duplicate_slide、move_slide、render_ppt_layout、lint_layout、insert_native_chart、insert_native_table、insert_media、update_element、delete_element、group_elements、ungroup_elements、align_elements、distribute_elements、reorder_elements、add_shape_animation、clear_slide_animations、set_slide_transition';

export const USEIT_DEFINITIONS=[
  d('useit_status','检查 Use-It 本地引擎是否可用，并返回 PowerPoint / Word / Excel / AutoCAD 的连接状态。引擎未启动时会给出安装与启动命令。',{engineUrl}),
  d('useit_catalog','列出 Use-It 引擎各控制器当前支持的动作清单（PowerPoint / Word / Excel / AutoCAD / Computer 等）。编写 useit_ppt 的 actions 或脚本前先查这个清单。',{engineUrl}),
  d('useit_ppt','通过 Use-It 本地引擎实时操作已打开的 PowerPoint（COM，而不是生成新文件）。action=status|open|close|snapshot|actions|code。actions 为结构化动作数组，支持：'+PPT_ACTIONS+'。code 可执行 PowerShell 或 Python 脚本。写入前会请求批准。',{...common,action:{type:'string',enum:['status','open','close','snapshot','actions','code']},filePath:string,readOnly:bool,save:bool,maxSlides:number,currentSlideOnly:bool,includeContent:bool,includeScreenshot:bool,returnScreenshot:bool,actions:jsonActions,code:string,language:{type:'string',enum:['PowerShell','Python']}},['action'],'write'),
  d('useit_word','通过 Use-It 本地引擎实时操作已打开的 Word。action=status|open|close|snapshot|code；结构化 actions 尚未在引擎实现，请使用 code（PowerShell / Python）。写入前会请求批准。',{...common,action:{type:'string',enum:['status','open','close','snapshot','code']},filePath:string,readOnly:bool,save:bool,includeContent:bool,includeScreenshot:bool,returnScreenshot:bool,code:string,language:{type:'string',enum:['PowerShell','Python']}},['action'],'write'),
  d('useit_excel','通过 Use-It 本地引擎实时操作已打开的 Excel。action=status|open|close|snapshot|code；引擎只接受脚本模式（code），可执行 PowerShell 或 Python。写入前会请求批准。',{...common,action:{type:'string',enum:['status','open','close','snapshot','code']},filePath:string,readOnly:bool,save:bool,includeContent:bool,includeScreenshot:bool,returnScreenshot:bool,code:string,language:{type:'string',enum:['PowerShell','Python']}},['action'],'write'),
  d('useit_autocad','通过 Use-It 本地引擎操作 AutoCAD。action=status|launch|open|close|activate|snapshot|step。step 需给 stepAction（draw_from_json 或 execute_python_com）以及 data 或 code。写入前会请求批准。',{...common,action:{type:'string',enum:['status','launch','open','close','activate','snapshot','step']},filePath:string,readOnly:bool,save:bool,drawingName:string,index:number,includeContent:bool,includeScreenshot:bool,onlyVisible:bool,maxEntities:number,returnScreenshot:bool,stepAction:{type:'string',enum:['draw_from_json','execute_python_com']},data:{type:'object',additionalProperties:true},code:string},['action'],'write'),
  d('useit_computer','通过 Use-It 本地引擎做桌面 GUI 自动化：截屏，或执行鼠标/键盘动作数组（如 [{"type":"click","x":100,"y":200}]）。会影响当前桌面，执行前会请求批准。',{...common,action:{type:'string',enum:['screenshot','actions']},actions:{type:'array',items:{type:'object',additionalProperties:true}},resize:bool,returnScreenshot:bool},['action'],'system'),
];

export const USEIT_NAMES=USEIT_DEFINITIONS.map(d=>d.name);
