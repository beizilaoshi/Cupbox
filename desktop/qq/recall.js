const qqId=value=>/^\d{5,16}$/.test(String(value));
const messageId=value=>/^-?\d{1,24}$/.test(String(value))&&Number(value)!==0;

// OneBot recall notices carry the original speaker and message id. Keep that
// provenance separate from ordinary text, which must never forge a notice.
export function recallTarget(event){
 if(event?.post_type!=='notice'||!['group_recall','friend_recall'].includes(event.notice_type)||!qqId(event.self_id)||!qqId(event.user_id)||!messageId(event.message_id))return null;
 const group=event.notice_type==='group_recall';if(group&&!qqId(event.group_id))return null;
 return{self_id:event.self_id,user_id:event.user_id,message_id:String(event.message_id),message_type:group?'group':'private',...(group?{group_id:event.group_id}:{})};
}
