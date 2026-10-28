# 筑梦喵三阶段眨眼素材

## 筑梦学院重做

学院皮肤现在由 `desktop/ui/pet-academy-eyes.js` 提供逐姿态标定的眼睑。全部 16 个源姿态分别记录两眼位置、大小、角度与原本闭眼状态；以本姿态原画的鼻侧/眼下肤色绘制半闭和全闭眼睑，不再使用跨姿态贴片或颜色启发式定位。单眼眨眼的另一只眼睛保持原样；睡觉、伸懒腰和闭眼笑使用本姿态原画的小幅眼睑变化。原生 canvas 动画不修改原 PNG。

`academy-blink.png` 仅保留为旧版生成素材，不再参与学院皮肤的眨眼显示。其余三套皮肤沿用下述生成资源。验证除了阶段数量，还逐个检查学院闭眼时的瞳孔残留和原画嘴/眉毛区域，结果见 `output/pet-blink-review/academy-eyelid-audit.json`。

使用内置 `image_gen`，不是 CLI/API fallback。以现有四套表情图集为编辑目标，分别生成对应的半闭眼、闭眼图集；每张 887×1774 RGBA、4 列 × 8 行，上半 16 格是半闭阶段，下半 16 格是闭眼阶段。原本的 4×4 图集提供睁眼阶段。

项目内最终资源：

- `desktop/ui/assets/pet/sakura-blink.png`
- `desktop/ui/assets/pet/academy-blink.png`
- `desktop/ui/assets/pet/cozy-blink.png`
- `desktop/ui/assets/pet/starlight-blink.png`

输入分别为 `desktop/ui/assets/pet/{outfit}-expressions.png`，outfit 取 sakura、academy、cozy、starlight。原始资源保留。播放器 `desktop/ui/pet-blink.js` 仅合成局部眼睛，衣服与身体不参与逐帧替换，避免整个人跳动；从同皮肤标准眼部样本提取两个生成阶段，以眼部色块与睫毛定位后逐个配准到各姿态原画，避免生成图中局部脸部位置漂移。单眼眨眼神态保持已经闭上的那只眼睛；睡觉、闭眼微笑与伸展姿态使用原画眼睑的三阶段微小形变，避免睁眼破坏原神态。

## 最终提示词模板

以下模板分别替换 `{outfit}` 执行四次，输入为该 outfit 的原图，transparent_background=true。

```text
Use case: precise-object-edit. Asset type: transparent blink animation sprite atlas for an existing desktop mascot. The attached image is the EDIT TARGET, a 4 columns by 4 rows atlas of 16 different poses. Create ONE tall 4 columns by 8 rows sprite sheet (aspect ratio 1:2), exactly 32 equal square cells, no borders, no text, transparent background.
TOP HALF (rows 1-4): reproduce all original 16 poses in the exact same order and exact same normalized placement and size inside each cell, but change ONLY EYES to a HALF-CLOSED blink phase, upper lids halfway over irises.
BOTTOM HALF (rows 5-8): the exact same 16 poses in the exact same order, eyes FULLY CLOSED with natural delicate curved eyelash lines.
Every pose, head angle, face proportions, hair, clothing, hand, accessory and body must stay locked to its matching original cell. No redrawing costumes, no changing mouth, no moving heads or camera, no zoom, no padding changes. This sheet will overlay ONLY the tiny eye regions of the original atlas; precise eye alignment is critical.
Keep original silver-white hair, gold/blue heterochromia where iris remains visible, cat ears, detailed pastel anime rendering and the exact {outfit} outfit.
For originally one-eye winking poses: keep the already closed eye closed, animate only the open eye. For already closed-eye smiling, stretching, and sleeping poses: preserve closed eyes, make subtle relaxed eyelid lines in top half and tighter closed eyelids in bottom half; NEVER wake the sleeping pose or open its eyes.
Preserve all 16 distinct original actions in each half. No new poses. Genuine alpha transparency.
```

## 验证

`desktop/verify-pet-blink.mjs` 在独立数据目录加载四套皮肤的全部 23 种动作，记录各阶段真实 canvas 输出，确认三个阶段不同、身体帧不变，检查动效关闭、预览暂停以及自然定时眨眼。三阶段对照保存在 `output/pet-blink-review/*-three-phases.png`；录音的复制与 2× 实际播放另外由 `desktop/verify-pet-interaction.mjs` 验证。
