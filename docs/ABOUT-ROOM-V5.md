# 房间 V5：通行、步态和光照

保持应用版本 1.1.1，只更新测试软件，不生成安装包。

## 实现

- `about-room-motion.js`：为书桌、电脑椅、餐桌椅、花盆、床、床尾凳及猫窝建立地面占用区域，步行区域为独立地板边界，使用带角色落脚半径的寻路。闲逛目标投影到可达地板；圆角后的路径再次检查碰撞，必要时回退安全折线路径。调整活动停靠位置，坐姿点仅用于家具动作，不用于自由行走。
- `about-room-art-v4.js`：采用按落脚点深度排序的家具前景蒙版，替代过去按人物中心横坐标决定遮挡的条件。人物在家具前不会被背景擦除，在后方则由家具轮廓遮住。使用刚性完整帧，不恢复此前导致诡异拉伸的网格动画。
- 三套新步态均由内置 imagegen 生成，四向各四阶段，存储为 `walk-poses-v5.png`、`cozy-walk-v5.png`、`academy-walk-v5.png`。对齐脚底基线和头部横向中心，避免用摆动的头发边界定位人物。原始输出保留在 Codex generated_images 目录。
- `about-room-lighting.js`：在原图 RGB 上逐像素应用空间光照倍率，严格保留 alpha，不再叠加会泛白的角色色罩。环境光、窗光、可关闭的台灯和固定床边暖灯按位置衰减；六个时段各有参数，雨雪降低窗光。夜间保留屋内暖灯的基础亮度，避免将人物统一压成蓝灰色。

这是二维插画场景，家具轮廓和地面占用通过手工标注建立，步态采用四阶段绘制帧；并非三维骨骼或物理光照。

## 验证

- `test/about-room-motion.test.ts`：遍历 12×12 个活动组合，验证所有行走帧落脚点避开家具，测试非法闲逛点投影、打断、排队和减弱动态效果。
- `test/about-room-lighting.test.ts`：原始透明度精确保留、灯光局部影响、移动时照度连续。两组共 12 项测试通过。
- `desktop/verify-about-room-navigation.mjs`：实际 Electron 渲染三套服装、四向各四帧；比对椅子前后的实际像素和背景，验证餐椅遮挡，播放跨家具区域的路线。
- `desktop/verify-about-room-lighting.mjs`：六时段开关台灯、近处人物亮度、远处背景保持一致、三个固定场景和渲染错误检查。
- `desktop/verify-about-room.mjs`：家具入口、持久化、页面重开、时钟、最小窗口、交互和后台暂停。修正测试脚本 reload 未等待新文档加载的竞态。

预览：`output/about-room-navigation-v5/window-to-cat-night.gif`。录制时设置 `CUPBOX_RECORD_ROOM_PATH=1` 运行 navigation 验证器。另有三套服装各方向的步态 GIF 和截图。

## 素材来源与完整提示词

默认通过内置工具生成，无额外 API 密钥。参考图为项目现有角色视图及工作场景，服装变体额外参考已生成的蓝缎裙步态结构。原图：

- `exec-5311b435-35a8-4f4a-afd9-38fb35bb48a6.png` → `walk-poses-v5.png`
- `exec-fc0e7c1d-7ea0-460e-8519-b3fca22f5f1c.png` → `cozy-walk-v5.png`
- `exec-e5a05e0d-7efa-4a2e-8e4c-2887ebfe7373.png` → `academy-walk-v5.png`

### 蓝缎裙步态

```text
Create a production animation sprite atlas: EXACTLY 16 full-body figures, 4 equal columns by 4 equal rows, true alpha transparent, no furniture, text, borders, shadows or grids. Reference 1 is the exact character design and proportions, reference 2 sets the room painting style. Silver-white long wavy hair, fluffy white cat ears, blue bows, white flowers, small golden bells; blue-white floral kimono dress, short white socks and blue shoes; front view gold eye on image left and blue eye on image right. Keep the reference1 small face/head-to-body proportion, 3.5 heads tall, slender small girl, no chibi enlargement. Fine detailed soft painted pixel illustration, crisp colored edges, warm muted palette without white glow. GENUINE SMALL WALKING STEPS, not standing mannequin poses. Four phases across each row: (1) left leg forward in ground contact and right leg behind, (2) right knee passing forward beside planted straight left leg, (3) right leg forward in ground contact and left leg behind, (4) left knee passing forward beside planted straight right leg. BOTH feet and legs visible; modest short relaxed strides, no skipping or high knees. Legs swap their roles visibly between columns 1 and 3. Arms swing opposite legs, no bowing. Row1 walking facing LEFT in a full side three-quarter view; row2 walking facing RIGHT in full side three-quarter view; row3 walking TOWARD camera; row4 walking AWAY from camera showing back of head, no face. All figures identical head shape and scale, every row same camera view across 4 phases. Every sole baseline is at 90% of its equal cell height, top of hair at 12%, 12% empty gutters left/right. Keep the head and torso nearly identical within each row, only actual legs and arms alternate. Her expression is calm and eyes open. No squashing, no rubber bending. Essential: a left-contact, right-passing, right-contact, left-passing anatomical walking cycle usable in a 2D game. Exact 4x4 grid. Keep entire body, hair and feet within each cell.
```

### 睡衣步态

```text
Create a production animation sprite atlas: EXACTLY 16 full-body figures, 4 equal columns by 4 equal rows, true alpha transparent, no furniture, text, borders, shadows or grids. Reference 1 is the exact character design and proportions, reference 2 sets the room painting style. Silver-white long wavy hair, fluffy white cat ears, blue bows, white flowers, small golden bells; lilac star-pattern pajamas with ruffles, fluffy cat slippers, holding her small cat plush in both hands; front view gold eye on image left and blue eye on image right. Keep the reference1 small face/head-to-body proportion, 3.5 heads tall, slender small girl, no chibi enlargement. Fine detailed soft painted pixel illustration, crisp colored edges, warm muted palette without white glow. GENUINE SMALL WALKING STEPS, not standing mannequin poses. Four phases across each row: (1) left leg forward in ground contact and right leg behind, (2) right knee passing forward beside planted straight left leg, (3) right leg forward in ground contact and left leg behind, (4) left knee passing forward beside planted straight right leg. BOTH feet and legs visible; modest short relaxed strides, no skipping or high knees. Legs swap their roles visibly between columns 1 and 3. Arms swing opposite legs, no bowing. Row1 walking facing LEFT in a full side three-quarter view; row2 walking facing RIGHT in full side three-quarter view; row3 walking TOWARD camera; row4 walking AWAY from camera showing back of head, no face. All figures identical head shape and scale, every row same camera view across 4 phases. Every sole baseline is at 90% of its equal cell height, top of hair at 12%, 12% empty gutters left/right. Keep the head and torso nearly identical within each row, only actual legs and arms alternate. Her expression is calm and eyes open. No squashing, no rubber bending. Essential: a left-contact, right-passing, right-contact, left-passing anatomical walking cycle usable in a 2D game. Exact 4x4 grid. Keep entire body, hair and feet within each cell. OUTFIT MUST exactly match input1 in ALL 16 cells. Input2 is the desired WALKING PHASE STRUCTURE only; do not use input2's clothes. No changing outfit in later rows.
```

### 学院服步态

```text
Create a production animation sprite atlas: EXACTLY 16 full-body figures, 4 equal columns by 4 equal rows, true alpha transparent, no furniture, text, borders, shadows or grids. Reference 1 is the exact character design and proportions, reference 2 sets the room painting style. Silver-white long wavy hair, fluffy white cat ears, blue bows, white flowers, small golden bells; navy and white academy sailor dress, pleated floral skirt, white socks and blue shoes; front view gold eye on image left and blue eye on image right. Keep the reference1 small face/head-to-body proportion, 3.5 heads tall, slender small girl, no chibi enlargement. Fine detailed soft painted pixel illustration, crisp colored edges, warm muted palette without white glow. GENUINE SMALL WALKING STEPS, not standing mannequin poses. Four phases across each row: (1) left leg forward in ground contact and right leg behind, (2) right knee passing forward beside planted straight left leg, (3) right leg forward in ground contact and left leg behind, (4) left knee passing forward beside planted straight right leg. BOTH feet and legs visible; modest short relaxed strides, no skipping or high knees. Legs swap their roles visibly between columns 1 and 3. Arms swing opposite legs, no bowing. Row1 walking facing LEFT in a full side three-quarter view; row2 walking facing RIGHT in full side three-quarter view; row3 walking TOWARD camera; row4 walking AWAY from camera showing back of head, no face. All figures identical head shape and scale, every row same camera view across 4 phases. Every sole baseline is at 90% of its equal cell height, top of hair at 12%, 12% empty gutters left/right. Keep the head and torso nearly identical within each row, only actual legs and arms alternate. Her expression is calm and eyes open. No squashing, no rubber bending. Essential: a left-contact, right-passing, right-contact, left-passing anatomical walking cycle usable in a 2D game. Exact 4x4 grid. Keep entire body, hair and feet within each cell. OUTFIT MUST exactly match input1 in ALL 16 cells. Input2 is the desired WALKING PHASE STRUCTURE only; do not use input2's clothes. No changing outfit in later rows.
```

