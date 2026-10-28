// Internal marker: normal QQ text cannot opt itself into interaction triggers.
const pokeEvent=Symbol('cupbox.qq.poke');
const validId=value=>/^\d{5,16}$/.test(String(value));
export function isPokeNotice(event){return event?.post_type==='notice'&&(event.notice_type==='notify'&&event.sub_type==='poke'||event.notice_type==='poke');}
export function normalizePoke(event){
 if(!isPokeNotice(event)||!validId(event.self_id)||String(event.target_id)!==String(event.self_id))return null;
 const group=event.group_id!==undefined&&event.group_id!==null&&String(event.group_id)!=='0'&&String(event.group_id)!=='';
 if(group&&!validId(event.group_id))return null;
 // NapCat friend notices have a conversation user_id and a separate sender_id.
 const user=!group&&event.sender_id!==undefined?event.sender_id:event.user_id;
 if(!validId(user)||String(user)===String(event.self_id)||event.sender?.is_bot)return null;
 return{post_type:'message',message_type:group?'group':'private',self_id:String(event.self_id),user_id:String(user),target_id:String(event.self_id),...(group?{group_id:String(event.group_id)}:{}),time:event.time,sender:{user_id:String(user),nickname:String(event.sender?.nickname||'').slice(0,80)},message:[{type:'text',data:{text:'[轻轻戳了戳你]'}}],[pokeEvent]:true};
}
export function isPokeMessage(event,config){return event?.[pokeEvent]===true&&config.pokeEnabled===true&&String(event.target_id)===String(event.self_id);}
