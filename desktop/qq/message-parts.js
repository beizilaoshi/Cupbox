// Decode CQ strings only at the protocol boundary. Text inside existing text
// segments remains literal and cannot manufacture mentions or reply permission.
const unescape=s=>s.replace(/&#91;/g,'[').replace(/&#93;/g,']').replace(/&#44;/g,',').replace(/&amp;/g,'&');
export function messageParts(value){
 if(Array.isArray(value))return value.filter(s=>s&&typeof s==='object'&&typeof s.type==='string');
 if(typeof value!=='string'||value.length>2*1024*1024)return[];
 const parts=[];let start=0;for(const match of value.matchAll(/\[CQ:([a-z_]+)((?:,[\w-]+=[^\[\]]*)?)\]/g)){
  if(match.index>start)parts.push({type:'text',data:{text:unescape(value.slice(start,match.index))}});
  const data={};for(const attr of match[2].slice(1).split(',')){const at=attr.indexOf('=');if(at>0&&!['__proto__','constructor','prototype'].includes(attr.slice(0,at)))data[attr.slice(0,at)]=unescape(attr.slice(at+1));}
  parts.push({type:match[1],data});start=match.index+match[0].length;
 }if(start<value.length)parts.push({type:'text',data:{text:unescape(value.slice(start))}});return parts;
}
export function sameQuoteConversation(event,data,known=false){
 if(event.message_type==='group')return String(data.group_id)===String(event.group_id);
 if(event.message_type!=='private'||data.group_id)return false;
 // Incoming private messages identify their sender. A bot-authored message
 // still needs provenance from the inbox, since its sender alone is ambiguous.
 return known||data.message_type==='private'&&String(data.sender?.user_id||data.user_id)===String(event.user_id);
}
