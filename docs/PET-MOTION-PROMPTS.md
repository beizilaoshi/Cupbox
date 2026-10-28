# 筑梦喵走路、提起与落地资源

## 当前连续动作升级（1.1.0）

目前使用60关键姿态、最高60fps插值和30帧眨眼。眼皮与角色使用同一连续骨架，新增八个互动动作；原图作为稳定绘画基底，不反复跳换整张人物。后续六帧、三档眨眼说明为历史记录。最新规则见 [节日衣橱与连续动作](./PET-FESTIVAL-WARDROBE.md)。


## 1.1.0 最终资源与运行方式

按用户反馈重新使用内置 image_gen 编辑四套 `*-motion.png`，项目最终路径仍是下列四张图；使用对应 1.0.3 运动图作编辑目标，未使用 CLI/API。academy、sakura 使用以下第一轮提示词；cozy、starlight 首轮格子不规则，使用第二轮提示词修订后才接入，弃稿未用于项目。

- `desktop/ui/assets/pet/academy-motion.png`
- `desktop/ui/assets/pet/sakura-motion.png`
- `desktop/ui/assets/pet/cozy-motion.png`
- `desktop/ui/assets/pet/starlight-motion.png`

实际渲染：提起和悬空统一固定第 6 格，四套皮肤分别校准眼睛，只做三阶段眨眼，不再播放挣扎。走路使用第 15 格作稳定基底，在运行时 Canvas 对膝下小幅连续形变，产生六个不同步态，脸、头发和躯干像素保持固定，避免生成图逐格抖动。速度为 size×0.14 px/s，完整步态对应 size×0.20 px 的实际位移。按姿态裁掉邻格溢出的极少量顶边。原有重力、落地恢复和关闭动效行为保留。

第一轮最终提示词（末尾附 `Outfit identity: academy/sakura/cozy/starlight.`）：

```text
+Use case: identity-preserve. Edit this production transparent 4x4 desktop mascot sprite atlas. Keep this EXACT silver-haired catgirl, gold left eye blue right eye, same outfit and accessories and chibi proportions. Replace the exaggerated poses with restrained elegant LADYLIKE movement. 16 equal square cells, transparent background, no text, grid or cast shadow. Fixed front three-quarter camera, identical head size and center, feet baseline, expression and silhouette across walk cycle. Generous clear transparent gutters.
Cells 0-5: SIX phases of a small graceful walking cycle. Knees close together, skirt stays modest and down, shoe lifts VERY slightly, tiny alternating steps, arms resting neatly near waist, closed-mouth gentle smile, both eyes open unchanged, head level. NOT marching/running/kicking/high knees, no winks. Each frame almost identical except subtle foot placement and minimal hem sway. Two-feet stride only 12 percent of body height.
Cells 6,7,8,9: EXACT SAME SINGLE STILL POSE repeated four times: gently suspended from the BACK OF THE COLLAR at nape like a kitten being lifted by its scruff. Shoulders slightly raised, arms naturally dangling DOWN close to torso, legs straight down together and feet hanging, hair pulled subtly up at nape but head remains front. Calm slightly bemused closed mouth, BOTH EYES OPEN for all 4 cells. No struggling, raised hands, bent knees, sitting, flailing, crying. No drawn hand or object.
Cells10,11: restrained feet-down descent with hands close to sides, legs together, tiny ankle difference.
Cells12,13,14: very slight knees-softened landing, recovery then standing, head stable no big squat.
Cell15: neutral graceful standing with hands neatly in front.
Preserve fine painterly anime aesthetic and exact outfit, bright clear face. The restrained first six poses MUST be visually consistent enough for smooth six-frame playback, no character zoom/rotation/camera change.
```

cozy、starlight 修订提示词（末尾附对应服装名称）：

```text
+Edit target is this sprite sheet. Output a STRICT REGULAR 4-COLUMN 4-ROW sprite sheet, 16 drawings, one drawing centered in EACH equal 313.5px square cell, NO EXTRA DRAWINGS, no shifted rows, every cell filled. Transparent background, no text. Same silver-haired catgirl, same exact outfit, gold left eye blue right eye. All heads same size, fixed camera, no cell overlap, generous margins.
ROW 1: 4 consecutive tiny elegant walking poses, hands gently together at waist, calm closed smile. Frame0 left shoe 5px forward right shoe 5px back; frame1 both shoes together; frame2 right shoe5pxforward left5pxback; frame3 both shoes together. Tiny steps, knees together, skirt down, no lifting knees.
ROW 2: first 2 drawings finish walk: frame4 left shoe3pxforward, frame5 both together. Last2 drawings show gently lifted by back of collar: shoulders gently raised, arms limp straight down, feet dangling down together. Quiet expression, both eyes open.
ROW 3: 4 identical drawings of the same lifted back-of-collar pose, feet together, arms down. Both eyes open. No struggling or jumping.
ROW4: 4 standing poses with feet together and hands neatly together: slightly soften knees in first, then upright neutral in last3.
Maintain identical head position and body scale, same original costume all16 cells. Gentle, dignified, no big expression changes. No hand or grabber drawn.
```

验证：`desktop/verify-pet-graceful.mjs` 检查四套皮肤悬空眨眼、六个步态画面不同、脸与躯干一致；`desktop/verify-pet-motion.mjs` 验证真实窗口位移和重力。对照板位于 `output/pet-graceful-review/`。以下保留 1.0.3 的历史提示词与实现记录。

本次通过内置 `image_gen` 生成四套独立运动图集，未使用 CLI/API fallback。输入分别是现有对应服装的 `*-expressions.png`，只作为角色与服装参考；原有绘图保留。最终项目资源均为 1254×1254 RGBA、4×4 共 16 格：

- `desktop/ui/assets/pet/sakura-motion.png`
- `desktop/ui/assets/pet/academy-motion.png`
- `desktop/ui/assets/pet/cozy-motion.png`
- `desktop/ui/assets/pet/starlight-motion.png`

格序：0–5 六帧步态，6 提起，7–9 三帧挣扎，10–11 下落，12–14 接触/缓冲/恢复，15 站立。人物服装保持对应皮肤，提起时使用惊讶/略委屈的表情。运动资源不叠加日常眼睛贴片，避免换姿态后眼睛错位。

## 最终提示词模板

用 sakura、academy、cozy、starlight 分别替换 `{outfit}`，以该皮肤现有图集为参考，transparent_background=true。

```text
Use case: identity-preserve. Asset type: production 4 by 4 motion sprite atlas for a small desktop anime mascot. Use the attached existing atlas ONLY as the character and outfit reference. Make a NEW transparent 4 columns by 4 rows sheet of 16 equal square cells, no text, no borders, no shadows beneath feet. Keep identical character scale, head proportions, silver hair, cat ears, gold/blue eyes, exact {outfit} costume, ribbons and accessory placement across every cell. Lock the head center, body center and foot baseline in each animation sequence; fixed camera, no zoom, no cell jitter. Leave a small transparent margin on every side. Distinct real limb poses rather than duplicated images.
READING ORDER CELLS:
0-5: SIX DIFFERENT frames of ONE smooth right-facing walking cycle, gentle three-quarter/front view. 0 right foot forward left foot back; 1 right support passing left foot forward; 2 left knee lifting; 3 left foot forward right foot back; 4 left support passing right foot forward; 5 right knee lifting into frame 0. Small alternating arm swings, visible different feet and knee positions, tiny hem/hair sway; no jumps, no full turns, no roller skating. Keep upper body visually stable and both shoes visible.
6: PICKED UP transition: surprised wide eyes, little open mouth, arms starting to lift outward, legs dangling, as if gently picked up from the top of the head. No hand, hook or grabbing object drawn.
7,8,9: THREE distinct small suspended STRUGGLING frames: 7 arms and feet tilt left, 8 arms spread and knees curl toward tummy, 9 arms and feet tilt right. Cute surprised/pouting embarrassed expression, not pain or fear. Head attachment stays fixed near the same point; torso, arms, shoes and skirt visibly change slightly. Hair and dress hang downward by gravity. Small amplitude, no drastic thrashing.
10,11: TWO FALLING frames: 10 surprised, hands slightly raised and feet downward; 11 knees prepare for landing, arms balance. Keep feet visible, no motion blur, no impact graphics.
12,13,14: THREE landing/recovery frames: 12 soft crouched contact with bent knees and slightly compressed posture; 13 half recovery, knees extending; 14 upright again with relieved expression. Fixed foot baseline; hair/hem settle gently.
15: neutral upright relieved standing, same outfit and scale.
All 16 cells must contain complete character silhouettes on genuine transparent alpha. Maintain polished delicate chibi anime rendering of reference. Do not add extra characters, hands, text, particles or UI. Preserve outfit identity; do not change clothes within sheet.
```

## 同步与物理

`desktop/pet/physics.js` 只计算自身窗口的位置，步态帧按真实整数像素位移推进。重力 1500 px/s²、最大下落速度 1050 px/s，落地回弹不超过角色大小的 3.5%，约 360ms 三帧恢复。多显示器、负坐标、屏幕工作区、减少动态效果均保留边界处理。任务状态独立于运动状态，落地后恢复原任务表现。原生窗口验证记录见 `output/pet-motion-review/native-positions.json`。
