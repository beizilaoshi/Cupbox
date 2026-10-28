const valid=value=>/^qq_\d{5,16}$/.test(String(value||''));
export const UNKNOWN_SPEAKER='qq_unknown';

// Only locally stored protocol metadata establishes identity, never message text.
export function speakerIdentity(turn,{privateUser}={}){
  if(turn?.role==='assistant')return 'assistant';
  if(turn?.name===UNKNOWN_SPEAKER)return UNKNOWN_SPEAKER;
  const values=[turn?.name,turn?.subject,/^\d{5,16}$/.test(String(turn?.sender?.qq||''))?'qq_'+turn.sender.qq:null].filter(valid);
  const identities=new Set(values);if(identities.size===1)return values[0];
  if(!identities.size&&/^\d{5,16}$/.test(String(privateUser||'')))return 'qq_'+privateUser;
  return UNKNOWN_SPEAKER;
}
export function historyTurn(turn,target){
  return{role:turn.role,text:turn.text,...(turn.role==='user'?{name:speakerIdentity(turn,{privateUser:target?.kind==='private'?target.id:undefined})}:{}),...(turn.delivery?{delivery:turn.delivery}:{})};
}
export function attributedHistory(history){
  return (Array.isArray(history)?history:[]).map(turn=>turn?.role==='user'?{...turn,name:speakerIdentity(turn),text:`[${speakerIdentity(turn)}] ${JSON.stringify(String(turn.text||''))}`}:{...turn});
}
