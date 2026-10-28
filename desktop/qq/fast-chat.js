// Only self-contained greetings use the lightweight request. Commands, proactive
// decisions, quoted media and tasks keep the complete tool workflow.
export function fastGreeting(p){
 return p.config?.mode==='chat'&&!p.proactive&&!p.event?.quote&&!p.images?.length&&
  !(p.memeTools?.definitions?.length&&!p.whaleSource)&&
  !p.event?.message?.some(s=>['reply','record','image','forward'].includes(s.type))&&
  /^(?:你好(?:呀|啊|哇)?|你在吗|在吗|在不在|嗨|哈[喽啰]|早(?:上好|安)?|中午好|下午好|晚上好|晚安|hello|hi|hey)[\s!！?？。～~]*$/i.test(String(p.prompt||'').trim());
}
