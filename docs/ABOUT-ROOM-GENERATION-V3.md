# 筑梦喵房间 V3：场景融合与动作

本轮继续使用内置 image_gen，不使用外部 API 密钥。将工作、吃饭、睡觉改为角色与家具一起生成的完整场景；不再把这三个状态的透明角色贴到空房间上。

## 新素材

- `desktop/ui/assets/about-room/work-scene-v3.png`：角色侧身朝向显示器，手在桌面键盘上，坐在原蓝色椅子里。
- `desktop/ui/assets/about-room/eat-scene-v3.png`：角色坐在餐桌旁，桌沿、桌布与椅子形成遮挡。
- `desktop/ui/assets/about-room/sleep-scene-v3.png`：头枕枕头，身体在星纹被子下。
- `desktop/ui/assets/about-room/walk-cycle-v3.png`：左右各八帧的透明步态图集。

## 播放实现
- `desktop/ui/assets/about-room/work-night-scene-v3.png`：工作专用夜景。
- `desktop/ui/assets/about-room/eat-night-scene-v3.png`：用餐专用夜景。
- `desktop/ui/assets/about-room/sleep-night-scene-v3.png`：睡觉专用夜景。

夜间活动使用独立绘制的完整场景，人物与家具共享真实灯光；不是仅给白天场景叠加深色。睡衣与学院服行走也接入现有六帧动作素材。


- 局部三角网格让手指、手臂、发梢、头部和被褥连续小幅变化；不依赖两张不同立绘反复切换。吃饭的手部有靠近／离开嘴部的小幅动作，眼睛定期短暂压合；睡觉的被褥随呼吸起伏。保留静止画面的脸和服饰细节。
- 步态按实际行走距离推进，共16帧。途中有起步加速、接近终点时减速，先经过地板路径点再接近家具；停下来不继续原地踏步。转向、到达和活动切换使用短过渡。
- 自由活动用柔和接触阴影、透视比例和桌沿、床、椅子、绿植前景遮挡；昼夜光照在人物和房间合成后统一处理。
- 固定工作／用餐／睡觉场景使用配套蓝缎造型，自由活动仍可换装；界面已写明范围。
- 减少动态效果、关闭动画和离开页面继续生效。

## 验证与实机动画

`desktop/verify-about-room.mjs` 验证设置、六时段、点击家具、路径到达、持久化、暂停和布局。

`desktop/verify-about-room-motion.mjs` 验证三种场景的局部像素随时间变化、固定家具不变、动作范围有限、静止开关、16帧步态和椅子遮挡，且直接录制渲染器输出：

- `output/about-room-motion-review/work-motion.gif`
- `output/about-room-motion-review/eat-motion.gif`
- `output/about-room-motion-review/sleep-motion.gif`

这些 GIF 记录实际软件渲染，不是另做的概念视频。

## 最终提示词
## 夜景生成提示词

### work night

Use case: lighting-weather, identity-preserve. Edit target is input 1, the finished room WITH ZhuMengMiao naturally seated side-on at the computer typing. Input 2 is the same room's empty NIGHT lighting reference. Change ONLY the lighting and window view of input 1 to match input 2: deep blue starry sky and crescent moon through window, warm glowing desk lamp, wall lanterns, pools of candlelight, dim blue-violet shadows. REMOVE daytime sunshine and sunbeams from floor. Preserve EVERY pixel composition and furniture placement as closely as possible; preserve the girl's exact pose, identity, scale, silver-white hair, white cat ears, blue bows, white flowers, bells, blue-and-white floral outfit, eye color when visible, chair/table/blanket occlusion and contact shadows. Character should receive the same local warm lamp light as nearby furniture. All room objects remain where they are. Do NOT add characters, do not remove the existing girl, do not zoom or shift. Beautiful fine textured pixel-illustration style, SAME original landscape 8:5 aspect ratio. No text or UI.

### eat night

Use case: lighting-weather, identity-preserve. Edit target is input 1, the finished room WITH ZhuMengMiao naturally seated at the dining table eating rice. Input 2 is the same room's empty NIGHT lighting reference. Change ONLY the lighting and window view of input 1 to match input 2: deep blue starry sky and crescent moon through window, warm glowing desk lamp, wall lanterns, pools of candlelight, dim blue-violet shadows. REMOVE daytime sunshine and sunbeams from floor. Preserve EVERY pixel composition and furniture placement as closely as possible; preserve the girl's exact pose, identity, scale, silver-white hair, white cat ears, blue bows, white flowers, bells, blue-and-white floral outfit, eye color when visible, chair/table/blanket occlusion and contact shadows. Character should receive the same local warm lamp light as nearby furniture. All room objects remain where they are. Do NOT add characters, do not remove the existing girl, do not zoom or shift. Beautiful fine textured pixel-illustration style, SAME original landscape 8:5 aspect ratio. No text or UI.

### sleep night

Use case: lighting-weather, identity-preserve. Edit target is input 1, the finished room WITH ZhuMengMiao naturally sleeping under the existing star blanket. Input 2 is the same room's empty NIGHT lighting reference. Change ONLY the lighting and window view of input 1 to match input 2: deep blue starry sky and crescent moon through window, warm glowing desk lamp, wall lanterns, pools of candlelight, dim blue-violet shadows. REMOVE daytime sunshine and sunbeams from floor. Preserve EVERY pixel composition and furniture placement as closely as possible; preserve the girl's exact pose, identity, scale, silver-white hair, white cat ears, blue bows, white flowers, bells, blue-and-white floral outfit, eye color when visible, chair/table/blanket occlusion and contact shadows. Character should receive the same local warm lamp light as nearby furniture. All room objects remain where they are. Do NOT add characters, do not remove the existing girl, do not zoom or shift. Beautiful fine textured pixel-illustration style, SAME original landscape 8:5 aspect ratio. No text or UI.



### work

Use case: identity-preserve / compositing. Production integrated activity illustration for interactive app, same premium finely textured high-resolution pixel illustration style as supplied room. Input 1 is the EXACT empty room to edit. Input 2 is ZhuMengMiao identity reference, NOT a sprite to paste. Preserve room camera, perspective, all furniture sizes and locations, decorations and lighting, edge-to-edge 8:5 scene. ONLY insert this character naturally in the specified activity with physically correct furniture occlusion, contact shadows, same warm lighting, and matched fine pixel texture. Identity: silver-white long wavy hair, white fluffy cat ears pink inside, gold left eye/blue right eye where visible, blue ribbons, white flowers, gold bells, blue-white floral dress. She should be proportionate to the furniture, a small girl who fits the chair/bed, not an oversized front-facing mascot pasted in front of it. Render her IN THE SAME IMAGE as room: integrated shadows, reflected light, perspective, partially occluded by furniture. No added text, no speech bubbles, no UI, no labels, no watermarks. Background MUST remain registered: do not change window, chair, desk, table, cat basket, bed, floor, or camera. Working: seat her correctly inside the existing blue cushioned COMPUTER CHAIR in the LEFT third. Torso turned to her LEFT toward the EXISTING monitor and keyboard, three-quarter BACK/SIDE view, not looking at viewer. Cat ears and silver hair with blue bow seen from behind; small bit of cheek visible. Forearms rest forward across the EXISTING desk surface, fingers on the EXISTING keyboard, NOT a new keyboard on her lap. Lower body naturally behind desk and chair seat, chair wheels below her feet. Match her size so head is around the monitor's upper half. Dress and long hair drape around chair seat, NOT covering entire chair. Everything in room unchanged. One finished continuous frame.

### eat

Use case: identity-preserve / compositing. Production integrated activity illustration for interactive app, same premium finely textured high-resolution pixel illustration style as supplied room. Input 1 is the EXACT empty room to edit. Input 2 is ZhuMengMiao identity reference, NOT a sprite to paste. Preserve room camera, perspective, all furniture sizes and locations, decorations and lighting, edge-to-edge 8:5 scene. ONLY insert this character naturally in the specified activity with physically correct furniture occlusion, contact shadows, same warm lighting, and matched fine pixel texture. Identity: silver-white long wavy hair, white fluffy cat ears pink inside, gold left eye/blue right eye where visible, blue ribbons, white flowers, gold bells, blue-white floral dress. She should be proportionate to the furniture, a small girl who fits the chair/bed, not an oversized front-facing mascot pasted in front of it. Render her IN THE SAME IMAGE as room: integrated shadows, reflected light, perspective, partially occluded by furniture. No added text, no speech bubbles, no UI, no labels, no watermarks. Background MUST remain registered: do not change window, chair, desk, table, cat basket, bed, floor, or camera. Eating: seat her naturally in the EXISTING dining chair at the RIGHT side of the small DINING TABLE in the foreground LEFT, around x30%, y80%. Body faces LEFT toward rice balls on the existing table; gentle three-quarter side view, not looking at viewer. One hand holds the existing little bowl just over table, the other hand raises a tiny piece of rice ball toward mouth. Table edge and lace tablecloth OCCLUDE her lower torso and lap naturally. Existing dining chair supports her. Same proportion to chair and table as a small girl. Do not add new table or chair or food props elsewhere; existing computer chair remains empty. All other room contents unchanged. One finished continuous frame.

### sleep

Use case: identity-preserve / compositing. Production integrated activity illustration for interactive app, same premium finely textured high-resolution pixel illustration style as supplied room. Input 1 is the EXACT empty room to edit. Input 2 is ZhuMengMiao identity reference, NOT a sprite to paste. Preserve room camera, perspective, all furniture sizes and locations, decorations and lighting, edge-to-edge 8:5 scene. ONLY insert this character naturally in the specified activity with physically correct furniture occlusion, contact shadows, same warm lighting, and matched fine pixel texture. Identity: silver-white long wavy hair, white fluffy cat ears pink inside, gold left eye/blue right eye where visible, blue ribbons, white flowers, gold bells, blue-white floral dress. She should be proportionate to the furniture, a small girl who fits the chair/bed, not an oversized front-facing mascot pasted in front of it. Render her IN THE SAME IMAGE as room: integrated shadows, reflected light, perspective, partially occluded by furniture. No added text, no speech bubbles, no UI, no labels, no watermarks. Background MUST remain registered: do not change window, chair, desk, table, cat basket, bed, floor, or camera. Sleeping: she is lying naturally INSIDE the EXISTING BED at the RIGHT, head on existing white pillow at LEFT end of bed around x81%,y45%, body extends toward RIGHT and down along mattress. Eyes gently closed, relaxed little hand by cheek, silver hair spread softly on pillow, one white cat ear and blue bow visible. The EXISTING blue star-pattern blanket is pulled up to shoulders, so most torso and legs are UNDER blanket, NOT a complete curled girl sitting on TOP of it. Pillow, quilt and mattress indent subtly around her. Warm bedside light falls on hair, soft occlusion/contact shadows. Keep bed dimensions and placement unchanged and computer and dining chairs EMPTY. Entire rest of room unchanged. One finished continuous frame.

### walk

Use case: identity-preserve. Transparent production WALK CYCLE sprite atlas for a finely textured pixel-illustration room game. EXACT same silver-white long-haired chibi cat-eared girl as supplied reference: blue and white floral layered kimono dress, white flowers, gold bells, blue side bows, white cat ears, gold/blue heterochromia. A true smooth 8-phase side-walking cycle, NEVER a set of different emotes. Strict 4 columns x 4 rows, 16 equal cells, transparent alpha, no backgrounds, no text. Rows1-2: 8 consecutive frames walking to LEFT in reading order: left leg forward contact, down, passing, up, right leg forward contact, down, passing, up. Rows3-4: same 8 phases walking RIGHT. Body in SIDE PROFILE oriented toward walking direction, not front view. SAME head, face, outfit, proportions, lighting and character scale across ALL cells, identical ground line baseline, no arbitrary pose changes, no waving, no dancing, no jumping. Subtle arm counter-swing, continuous modest leg steps, hair and ribbons lag gently with the walk. One foot always on ground, no skates, no big hops. Character fully isolated inside each cell with 12% transparent margins, all hair fully contained, consistent small delicate detailed pixel clusters and soft room lighting. Keep head size and torso size fixed across cells. 1536x1536 high resolution atlas. Do not attach neighboring sprites.

