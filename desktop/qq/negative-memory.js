import {safeMemoryText} from './security.js';

export const affectionScore=value=>Math.max(-100,Math.min(100,Number.isFinite(Number(value))?Number(value):0));
export const negativeStage=score=>score<=-60?'反感':score<=-20?'戒备':score<0?'疏远':'';

// Evidence stays within the existing per-speaker relationship archive.
export function negativeMemories(value) {
  return (Array.isArray(value)?value:[]).filter(m=>m&&typeof m.id==='string'&&m.kind==='harsh_words'&&typeof m.evidence==='string'&&m.evidence.length<=300&&safeMemoryText(m.evidence)&&Number.isFinite(Date.parse(m.at))).slice(-30).map(m=>({id:m.id,kind:m.kind,evidence:m.evidence,at:m.at,status:['repairing','resolved'].includes(m.status)?m.status:'active',...(m.source==='local-editor'?{source:'local-editor'}:{}),...(typeof m.repairEvidence==='string'&&m.repairEvidence.length<=300&&safeMemoryText(m.repairEvidence)?{repairEvidence:m.repairEvidence}:{}),...(Number.isFinite(Date.parse(m.repairedAt))?{repairedAt:m.repairedAt}:{})}));
}
