/** Evaluation is persisted alongside the message so changing a vote invalidates old summaries. */
export function ensureMessageIds(session) {
  for(let i=0;i<(session.messages||[]).length;i++)session.messages[i].id ||= `message-${i}`;
  return session;
}
export function feedbackHistory(session) {
  return (session.messages||[]).filter(m=>['user','assistant'].includes(m.role)&&typeof m.text==='string'&&!(m.role==='assistant'&&m.feedback==='down')).map(m=>({role:m.role,text:m.text}));
}
export function preferredContext(session) {
  const accepted=(session.messages||[]).filter(m=>m.role==='assistant'&&m.feedback==='up').slice(-3);
  return accepted.length?'【用户标记有帮助的历史答复，仅作参考，当前指令优先】\n'+accepted.map(m=>m.text.slice(0,1200)).join('\n\n'):'';
}
export function updateFeedback(session,id,value) {
  if(!['up','down','none'].includes(value))throw Error('无效评价');
  ensureMessageIds(session);const message=session.messages.find(m=>m.id===id&&m.role==='assistant');
  if(!message)throw Error('找不到这条回复');
  message.feedback=value==='none'?undefined:value;
  // Summaries may contain the rejected answer: rebuild from the filtered full history.
  session.summary=null;
  return message;
}
