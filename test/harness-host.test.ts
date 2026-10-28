import {describe,it,expect} from 'vitest';
import {launchConfiguration,environment,originalToolInventory} from '../desktop/harness-host.js';
import {mkdtemp,readFile,rm,mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {EventEmitter} from 'node:events';
const model={id:'m1',name:'自建模型',model:'test',enabled:true,provider:'openai-compatible',baseUrl:'https://example.com/v1',apiKey:'secret-123456',capabilities:['text','vision']};
describe('original Harness runtime integration boundaries',()=>{
 it('keeps credentials out of profile files and selects the same explicitly configured text model',()=>{
  const r=launchConfiguration({all:[model,{...model,id:'m2',model:'claude',provider:'anthropic'},{...model,id:'off',enabled:false},{...model,id:'free',provider:'free'}]},{modelRoutes:{text:'m2'}});
  expect(r.models.map(m=>m.id)).toEqual(['m1','m2']);expect(JSON.stringify(r.patch)).not.toContain(model.apiKey);expect(r.env.CUPBOX_HARNESS_KEY_0).toBe(model.apiKey);
  expect(r.patch[1]).toMatchObject({id:'agent-default-model',config:{provider:'cupbox-1',model:'claude'}});
  expect(r.patch[0].config.providers['cupbox-1'].api).toBe('anthropic-messages');
 });
 it('passes only intended host environment and opts out of telemetry without elevating permissions',()=>{
  const env=environment({PATH:'safe',USERPROFILE:'profile',NODE_OPTIONS:'--require malicious.js',OPENAI_API_KEY:'unrelated',ELECTRON_RUN_AS_NODE:'1'},'home',{CUPBOX_HARNESS_KEY_0:'allowed'});
  expect(env).toMatchObject({PATH:'safe',DSH_HOME:'home',DSH_TELEMETRY_DISABLED:'1',DSH_PERMISSION_MODE:'workspace-write',CUPBOX_HARNESS_KEY_0:'allowed'});for(const k of ['NODE_OPTIONS','OPENAI_API_KEY','ELECTRON_RUN_AS_NODE'])expect(env).not.toHaveProperty(k);
 });
 it('inventories all upstream interfaces while labeling external dependencies and unpublished tools honestly',async()=>{
  const r=await originalToolInventory();expect(r.tools).toHaveLength(70);expect(new Set(r.tools.map(t=>t.name)).size).toBe(70);
  for(const name of ['pwsh','read','write','edit','glob','grep','job_output','subagent','todo_write','schedule_create','run_code','web_search'])expect(r.tools.some(t=>t.name===name)).toBe(true);
  expect(r.tools.find(t=>t.name==='stagehand_act').availability).toContain('需');expect(r.tools.find(t=>t.name==='propose_action').availability).toContain('未发布');
 });
});
