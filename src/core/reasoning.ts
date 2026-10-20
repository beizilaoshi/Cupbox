/** Provider-specific request parameters. UI intensity is never simulated with prompts. */
export type ReasoningMode = 'auto' | 'disabled' | 'openai' | 'deepseek' | 'openrouter';
export type ReasoningEffort = 'auto' | 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export interface ReasoningModel {provider?: string;model: string;baseUrl?: string;preset?: string;reasoningMode?: ReasoningMode;reasoningLevels?: string[]}
export function reasoningCapabilities(model: ReasoningModel): {adapter: string;levels: ReasoningEffort[];note: string} {
  const id=model.model.toLowerCase(),mode=model.reasoningMode||'auto';let host='';try{host=new URL(model.baseUrl||'').hostname;}catch{}
  const spec=(adapter:string,levels:ReasoningEffort[],note='深度越高，耗时和用量通常越大；以提供方实际能力为准。')=>({adapter,levels:['auto' as const,...levels],note});
  if(mode==='disabled'||model.provider==='anthropic')return spec('none',[],'此连接未启用可调思考深度，使用模型默认行为。');
  if(mode==='deepseek'||mode==='auto'&&(host==='api.deepseek.com'||model.preset==='deepseek')&&/deepseek-(?:flash|v4)/.test(id))return spec('deepseek',['none','low','high','max']);
  if(mode==='openrouter'||mode==='auto'&&host==='openrouter.ai'&&/(?:^|\/)(?:gpt-[56]|o[134](?:-|$)|deepseek-(?:r1|v4))/.test(id))return spec('openrouter',(model.reasoningLevels?.filter(v=>['none','low','medium','high','xhigh','max'].includes(v))||['none','low','medium','high']) as ReasoningEffort[]);
  if(mode==='openai')return spec('openai',['low','medium','high']);
  if(mode==='auto'&&model.provider!=='free'){
    if(/chat-latest|gpt-.*-pro(?:-|$)/.test(id))return spec('none',[],'此型号未配置深度适配，使用模型默认行为。');
    if(/^gpt-6(?:[.-]|$)/.test(id))return spec('openai',['low','medium','high','xhigh','max']);
    if(/^gpt-5\.[2345](?:[.-]|$)/.test(id))return spec('openai',['none','low','medium','high','xhigh']);
    if(/^gpt-5\.1(?:[.-]|$)/.test(id))return spec('openai',['none','low','medium','high']);
    if(/^gpt-5(?:-|$)|^o[134](?:-|$)/.test(id))return spec('openai',['low','medium','high']);
  }
  return spec('none',[],'未确认此模型支持深度参数。可在连接的高级参数中指定适配方式。');
}
export function reasoningParameters(model: ReasoningModel, effort?: string): Record<string,unknown> {
  if(effort===undefined||effort==='auto')return {};
  const cap=reasoningCapabilities(model);if(!cap.levels.includes(effort as ReasoningEffort))throw Error(`模型 ${model.model} 不支持思考深度 ${effort}，请选择默认或受支持档位`);
  if(cap.adapter==='deepseek')return effort==='none'?{thinking:{type:'disabled'}}:{thinking:{type:'enabled'},reasoning_effort:effort};
  if(cap.adapter==='openrouter')return effort==='none'?{reasoning:{enabled:false}}:{reasoning:{effort}};
  return{reasoning_effort:effort};
}
