import {loadAiConfig} from '../dist/core/ai.js';
import {listFreeModels,loadFreeStore,isModelEnabled,saveFreeStore,probeFreeModel} from '../dist/core/freemodel.js';
import {reasoningCapabilities,reasoningParameters} from '../dist/core/reasoning.js';

export const freeRouteId=m=>`free:${m.lane}:${encodeURIComponent(m.id)}`;
export function createChatModels(library){
  async function records(){
    const [legacy,custom,store,directory]=await Promise.all([loadAiConfig(),library.list(),loadFreeStore(),listFreeModels({offline:true})]);
    const free=directory.models.map(m=>({id:freeRouteId(m),model:m.id,name:m.name,provider:'free',preset:'free',baseUrl:'',apiKey:'',capabilities:['text'],enabled:isModelEnabled(store,m.id)&&!m.blocked,blocked:Boolean(m.blocked),stale:Boolean(m.stale),source:'free',lane:m.lane,freeLane:m.lane,reasoningMode:m.reasoningEfforts?.length?'openrouter':'disabled',reasoningLevels:m.reasoningEfforts}));
    const defaultFree=legacy.provider==='free'?free.find(m=>m.model===legacy.model):null;
    const fallback=legacy.model?{...legacy,...(defaultFree?{reasoningMode:defaultFree.reasoningMode,reasoningLevels:defaultFree.reasoningLevels,freeLane:defaultFree.freeLane}:{}),id:'default',name:'默认 · '+legacy.model,source:'default',capabilities:['text'],enabled:legacy.provider!=='free'||Boolean(defaultFree?.enabled)}:null;
    return {legacy:fallback||legacy,models:[...custom.map(m=>({...m,source:'library'})),...free],all:[...(fallback?[fallback]:[]),...custom.map(m=>({...m,source:'library'})),...free],store,directory};
  }
  async function catalog(){const r=await records();return{models:r.all.map(({apiKey,...m})=>({...m,hasApiKey:Boolean(apiKey),effort:reasoningCapabilities(m)})),freeEnabled:r.store.enabled,cachedAt:r.directory.cachedAt};}
  async function select(routes={},efforts={}){
    const r=await records();
    const apply=model=>{if(!model)throw Error('所选模型不存在，请重新选择');if(model.enabled===false)throw Error('所选模型已停用或通道不可用，请重新选择');const effort=efforts[model.id]||'auto';reasoningParameters(model,effort);return{...model,reasoningEffort:effort};};
    const models=r.models,legacy=r.legacy;
    for(const id of Object.values(routes)){const found=r.all.find(m=>m.id===id);if(!found||!found.enabled)throw Error('所选模型已删除、停用或免费通道关闭，请重新选择');}
    return{models,legacy,apply};
  }
  async function toggleModel(id,enabled){const r=await records(),m=r.directory.models.find(m=>m.id===id);if(!m)throw Error('模型目录已变化，请刷新');const off={[id]:!enabled};await saveFreeStore({off});return catalog();}
  async function probe(id){const r=await records(),m=r.all.find(m=>m.id===id&&m.source==='free');if(!m?.enabled)throw Error('先启用可用的免费模型，再检测连接');return probeFreeModel(m.model);}
  return{records,catalog,select,toggleModel,probe};
}
