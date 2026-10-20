"use strict";
window.CupboxProviders=(()=>{
  const presets={
    siliconflow:{name:'硅基流动 · SiliconFlow',provider:'openai-compatible',base:'https://api.siliconflow.cn/v1',model:'deepseek-ai/DeepSeek-V4-Flash',note:'使用硅基流动的 API Key，可获取账号可用模型。'},
    deepseek:{name:'DeepSeek',provider:'openai-compatible',base:'https://api.deepseek.com',model:'deepseek-chat',note:'使用 DeepSeek 开放平台的 API Key。'},
    openai:{name:'OpenAI · GPT',provider:'openai-compatible',base:'https://api.openai.com/v1',model:'gpt-4.1-mini',note:'使用 OpenAI API Key；也可以修改地址连接兼容网关。'},
    anthropic:{name:'Anthropic · Claude',provider:'anthropic',base:'https://api.anthropic.com',model:'',note:'使用 Anthropic API Key，获取模型列表后选择。'},
    openrouter:{name:'OpenRouter',provider:'openai-compatible',base:'https://openrouter.ai/api/v1',model:'',note:'使用 OpenRouter API Key，模型 ID 包含服务商前缀。'},
    ollama:{name:'Ollama · 本地模型',provider:'openai-compatible',base:'http://127.0.0.1:11434/v1',model:'',note:'先启动本机 Ollama，再获取已安装模型；无需 API Key。'},
    lmstudio:{name:'LM Studio · 本地模型',provider:'openai-compatible',base:'http://127.0.0.1:1234/v1',model:'',note:'先在 LM Studio 开启本地服务，再获取模型；无需 API Key。'},
    custom:{name:'自定义服务',provider:'openai-compatible',base:'',model:'',note:'填写兼容 OpenAI 或 Anthropic 协议的服务地址。'},
  };
  let saved='custom',revision=0;
  const $=id=>document.getElementById(id);
  function syncKey(){
    const id=$('api-preset').value;
    $('api-protocol-fields').hidden=id!=='custom';
    $('api-key').placeholder=['ollama','lmstudio'].includes(id)?'本地服务可留空':id===saved?'留空保留已有密钥':'请输入此服务的 API Key';
    $('preset-note').textContent=presets[id].note+(id!==saved?' 更换服务时不会沿用原服务密钥。':'');
  }
  function fill(config){
    saved=Object.hasOwn(presets,config.preset)?config.preset:'custom';
    $('api-preset').value=saved;syncKey();
  }
  function draft(){return{preset:$('api-preset').value,provider:$('api-provider').value,baseUrl:$('api-base').value.trim(),model:$('api-model').value.trim(),...($('api-key').value.trim()?{apiKey:$('api-key').value.trim()}: {})};}
  function init(){
    document.getElementById('tab-api').addEventListener('input',()=>revision++);
    document.getElementById('tab-api').addEventListener('change',()=>revision++);
    for(const [id,p] of Object.entries(presets)){const option=document.createElement('option');option.value=id;option.textContent=p.name;$('api-preset').appendChild(option);}
    $('api-preset').addEventListener('change',()=>{
      const p=presets[$('api-preset').value];$('api-reasoning-mode').value='auto';$('api-provider').value=p.provider;$('api-base').value=p.base;$('api-model').value=p.model;$('api-key').value='';$('api-status').textContent='';$('model-options').replaceChildren();syncKey();
    });
    $('fetch-models').addEventListener('click',async()=>{
      const btn=$('fetch-models');btn.disabled=true;$('models-status').textContent='正在连接并获取模型…';
      try{const r=await cupbox.aiModels(draft());if(!r.ok)throw new Error(r.error);$('model-options').replaceChildren();for(const id of r.models){const option=document.createElement('option');option.value=id;$('model-options').appendChild(option);}if(!$('api-model').value&&r.models[0])$('api-model').value=r.models[0];$('models-status').textContent=`连接成功，可选择 ${r.models.length} 个模型；点击模型输入框查看。`;}
      catch(e){$('models-status').textContent=e.message;}finally{btn.disabled=false;}
    });
  }
  return{init,fill,draft,presets,revision:()=>revision};
})();
