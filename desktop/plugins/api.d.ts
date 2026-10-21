/** Cupbox plugin API v1: JSON declarations only; no JS entrypoints are executed. */
export type PluginPermission='response.read'|'response.block'|'response.replace';
export interface PluginManifest {
  apiVersion:1; id:string; name:string; version:string; description:string;
  kind:'output-rules'; hook:'reply.beforeSend'; entry:'rules.json';
  permissions:PluginPermission[];
}
export interface OutputRules {blockWords:string[];maskWords:string[];replacement:string;maxChars:number;}
export type OutputDecision={action:'pass'|'replace';text:string;code:string}|{action:'block';code:string};
export interface OutputHookContext {surface:'qq'|'desktop';signal?:AbortSignal;}
export interface OutputHookResult {allowed:boolean;text:string;checks:{id:string;action:'pass'|'replace'|'block';code:string}[];}
