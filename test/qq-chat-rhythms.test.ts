import {describe,it,expect} from 'vitest';
import {CHAT_RHYTHMS,chatRhythmPatch} from '../desktop/qq/chat-rhythms.js';
import {validateSettings} from '../desktop/qq/store.js';
import {conversationStyle,previewParts} from '../desktop/qq/conversation.js';
describe('聊天节奏推荐',()=>{
 it('12种推荐均可保存，零上下文时补足接话必需设置',()=>{expect(Object.keys(CHAT_RHYTHMS)).toHaveLength(12);for(const id of Object.keys(CHAT_RHYTHMS)){const base=validateSettings({contextCount:0}),patch=chatRhythmPatch(id,base),c=validateSettings({...base,...patch});expect(c.mode).toBe('chat');if(patch.listenContext)expect(c.contextCount).toBe(12);expect(CHAT_RHYTHMS[id].description).toBeTruthy();}});
 it('一问一答与夜聊关闭主动插话，原白名单及工具权限不扩张',()=>{for(const id of ['single','night']){const base=validateSettings({allowedGroups:['111111'],ownerIds:['123456'],searchEnabled:false,visionEnabled:false}),c=validateSettings({...base,...chatRhythmPatch(id,base)});expect(c.proactiveEnabled).toBe(false);expect(c.allowedGroups).toEqual(base.allowedGroups);expect(c.ownerIds).toEqual(base.ownerIds);expect(c.allowWorkTools).toBe(false);expect(c.searchEnabled).toBe(false);expect(c.visionEnabled).toBe(false);}expect(chatRhythmPatch('single').listenContext).toBe(false);});
 it('完整回复保留一条，认真讨论改变真实提示，短句与耐心节奏参数各异',()=>{const c=validateSettings(chatRhythmPatch('longform'));expect(previewParts('第一句。'.repeat(80),c)).toHaveLength(1);expect(conversationStyle(c)).toContain('步骤');expect(chatRhythmPatch('quick').mergeDelay).toBeLessThan(chatRhythmPatch('patient').mergeDelay);expect(chatRhythmPatch('concise').maxSegments).toBe(2);expect(()=>chatRhythmPatch('missing')).toThrow();});
});

