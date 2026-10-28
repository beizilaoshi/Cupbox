# 筑梦喵吃饭图集

版本保持 1.1.0。使用内置 imagegen 工具生成，每套皮肤单独引用自己的 `desktop/ui/assets/pet/<outfit>-expressions.png`，没有通过重新着色或切割身体替代绘制。

最终资源保存于 `desktop/ui/assets/pet/<outfit>-eating.png`；每张为透明背景的 4×4 图集，按行播放 16 帧。来源、尺寸及校验值见同目录文档中的 `PET-EATING-IMAGEGEN.json`。

## 最终提示词

Use case: illustration-story. Asset type: transparent desktop pet sequential animation sprite atlas. Reference image: preserve this exact character, exact costume and head accessories, rendering style, white/silver hair, cat ears, amber left eye and blue right eye. Draw a NEW 4 by 4 equally spaced sprite atlas of 16 sequential eating animation frames read left-to-right top-to-bottom. Every cell: the same full-body chibi girl standing at the exact same scale, position and feet baseline. She holds a little white rice bowl in her left hand; right hand slowly lifts a spoon from bowl to mouth, takes a bite, closes eyes briefly happily chewing, lowers spoon back toward bowl. Smooth small changes between frames, last frame returns to first. Preserve costume embroidery, colors, shoes and hair details in EVERY frame. Character fills only central 80% of each cell, leave transparent gutters on all four sides, no hair or shoes touching adjacent cells, no panel outlines, no labels or numbers, no shadows outside figure, truly transparent background. Keep whole body visible in every frame. Anatomically correct hands. Draw actual changing spoon/arm/mouth/eyes across 16 frames, not identical duplicates. No costume changes, no mesh distortions.

## 播放与存档

- 实绘帧以每秒 8 帧播放；渲染调度最高 60fps，关闭动画时显示静止端碗图。
- 图集逐格隔离相邻动作的边缘，使用整套统一缩放和脚部基线，不进行肢体剪切或网格形变。
- 设置内动作预览不产生好感奖励；真正喂食由本机后端确认并保存后触发动画。
- 小鱼饭与点心共用 30 分钟冷却，已有好感不回退；新好感奖励保留两位小数。

## 剩余服装小批次使用的提示词

Use case: illustration-story. NEW transparent 4x4 animation sprite atlas, 16 sequential eating drawings. Reference is identity and costume guide: preserve exactly this silver-haired chibi catgirl and her outfit, ribbons, embroidery, shoes, heterochromia (amber left, blue right), pastel anime watercolor style. Each equal cell shows the full body at identical scale and feet baseline. Small white rice bowl held at chest with one hand, other hand slowly scoops with spoon, raises spoon to mouth, takes bite, cheeks subtly chew, happy blink, lowers spoon; last frame loops to first. Smooth small sequential changes, no unrelated poses. Leave 10% genuinely transparent gutter around every complete figure; no crossing into neighbouring cells, no labels or borders. No costume changes, limb distortion or cropped ears/shoes. Draw real mouth, eyes and spoon movement across all 16 frames.
