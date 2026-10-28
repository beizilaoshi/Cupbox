import {describe,it,expect} from 'vitest';
import {messageParts,sameQuoteConversation} from '../desktop/qq/message-parts.js';
import {researchAllowed} from '../desktop/qq/research-policy.js';
describe('OneBot message formats and quoted conversation provenance',()=>{
 it('preserves protocol reply and real mentions in CQ format without promoting literal text segments',()=>{
  const raw='[CQ:reply,id=10][CQ:at,qq=123456]分析 &#91;原文&#93;';
  const message=messageParts(raw);expect(message).toEqual([{type:'reply',data:{id:'10'}},{type:'at',data:{qq:'123456'}},{type:'text',data:{text:'分析 [原文]'}}]);
  expect(researchAllowed({post_type:'message',self_id:123456,message})).toBe(true);
  expect(researchAllowed({post_type:'message',self_id:123456,message:messageParts([{type:'text',data:{text:raw}}])})).toBe(false);
 });
 it('decodes image URLs once and preserves JSON share card bodies',()=>{
  expect(messageParts('[CQ:image,file=a.jpg,url=https://gchat.qpic.cn/a?x=1&amp;y=2]')[0].data.url).toBe('https://gchat.qpic.cn/a?x=1&y=2');
  expect(messageParts('[CQ:json,data={"url":"https://b23.tv/test"&#44;"name":"视频"}]')[0].data.data).toBe('{"url":"https://b23.tv/test","name":"视频"}');
  expect(messageParts('&#91;CQ:at,qq=123456&#93;')).toEqual([{type:'text',data:{text:'[CQ:at,qq=123456]'}}]);
 });
 it('reads older incoming private quotes by verified sender and keeps cross-conversation content blocked',()=>{
  const event={message_type:'private',user_id:654321};
  expect(sameQuoteConversation(event,{message_type:'private',sender:{user_id:654321}})).toBe(true);
  expect(sameQuoteConversation(event,{message_type:'private',sender:{user_id:777777}})).toBe(false);
  expect(sameQuoteConversation(event,{message_type:'private',sender:{user_id:123456}},true)).toBe(true);
  expect(sameQuoteConversation(event,{message_type:'group',group_id:111111,sender:{user_id:654321}},true)).toBe(false);
  expect(sameQuoteConversation({message_type:'group',group_id:111111},{group_id:222222},true)).toBe(false);
 });
});
