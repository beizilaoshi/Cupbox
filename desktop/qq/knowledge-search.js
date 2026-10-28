// Local lexical retrieval. Scope filtering belongs to the caller, before indexing.
export function terms(text){
 const result=new Map();
 for(const word of String(text).normalize('NFKC').toLowerCase().match(/[a-z0-9_-]{2,}|[\u4e00-\u9fff]{2,}/g)||[]){
  const add=t=>result.set(t,(result.get(t)||0)+1);
  if(!/[\u4e00-\u9fff]/.test(word)){add(word);continue;}
  if(word.length<=8)add(word);
  for(const n of [2,3])for(let i=0;i<=word.length-n;i++)add(word.slice(i,i+n));
 }
 return result;
}
export function chunkDocument(doc){
 const chunks=[],text=doc.text,headings=[...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m=>({offset:m.index,title:m[1].trim()}));
 for(let offset=0;offset<text.length;){
  let end=Math.min(text.length,offset+850);
  if(end<text.length){const boundary=text.lastIndexOf('\n',end);if(boundary>offset+400)end=boundary+1;}
  const body=text.slice(offset,end),section=headings.filter(h=>h.offset<=offset).at(-1)?.title||headings.find(h=>h.offset<end)?.title||'';
  chunks.push({id:doc.id,title:doc.title,text:body,offset,end,section,line:text.slice(0,offset).split('\n').length,words:terms(body),titleWords:terms(doc.title+' '+section)});
  if(end===text.length)break;
  offset=Math.max(offset+1,end-80);
 }
 return chunks;
}
export function buildKnowledgeIndex(documents){
 const chunks=documents.flatMap(chunkDocument),frequency=new Map();let total=0;
 for(const c of chunks){c.length=[...c.words.values()].reduce((a,b)=>a+b,0);total+=c.length;for(const t of new Set([...c.words.keys(),...c.titleWords.keys()]))frequency.set(t,(frequency.get(t)||0)+1);}
 return{chunks,frequency,average:total/(chunks.length||1)};
}
export function searchKnowledge(index,query,limit=4){
 const q=[...terms(query).keys()],phrase=String(query).trim().toLowerCase(),hits=[];
 if(!q.length)return hits;
 for(const c of index.chunks){
  const matched=q.filter(t=>c.words.has(t)||c.titleWords.has(t));
  const exactShortChinese=/^[\u4e00-\u9fff]{2}$/.test(phrase)&&matched.includes(phrase);
  if(matched.length<2&&!exactShortChinese&&!matched.some(t=>t.length>=3&&(c.title+' '+c.section+' '+c.text).toLowerCase().includes(t)))continue;
  let score=0;
  for(const t of matched){const tf=(c.words.get(t)||0)+(c.titleWords.get(t)||0)*3,idf=Math.log(1+(index.chunks.length-(index.frequency.get(t)||0)+.5)/((index.frequency.get(t)||0)+.5));score+=idf*tf*2.2/(tf+1.2*(.25+.75*c.length/(index.average||1)));}
  if(phrase.length>=3&&(c.title+' '+c.section+' '+c.text).toLowerCase().includes(phrase))score+=2;
  hits.push({...c,score:Math.round(score*1000)/1000,matchedTerms:matched.slice(0,12)});
 }
 const result=[],counts=new Map();
 for(const hit of hits.sort((a,b)=>b.score-a.score||a.offset-b.offset)){
  if((counts.get(hit.id)||0)>=2||result.some(r=>r.text.trim()===hit.text.trim()||r.id===hit.id&&Math.min(r.end,hit.end)-Math.max(r.offset,hit.offset)>Math.min(r.text.length,hit.text.length)*.35))continue;
  const{words,titleWords,length,end,...row}=hit;
  result.push({...row,reference:'《'+hit.title+'》'+(hit.section?' · '+hit.section:'')+' · 第'+hit.line+'行'});counts.set(hit.id,(counts.get(hit.id)||0)+1);
  if(result.length>=Math.max(1,Math.min(6,Number(limit)||4)))break;
 }
 return result;
}
