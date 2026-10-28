# 1.1.0 樱花幻境开屏

## 参考原画与磨砂玻璃修订（当前最终）

最终背景为 `desktop/ui/assets/startup-sakura-frost.png`，以内置 image_gen 参考用户提供的银发猫耳原画，仅提取其银蓝/樱粉配色、细腻手绘和柔光画风；按之前要求不绘制人物或动物。图片已保存在工程，未使用 CLI/API。旧硬边赛璐璐素材不再用于默认开屏。

保留渐变字标、斜向转场、花瓣聚拢/绽放/散开节奏；将切镜变成柔光扫过，将动态花瓣改成平滑渐变与细脉纹理。字标底板使用 `backdrop-filter: blur(24px) saturate(1.28)` 和低透明度银蓝/樱粉玻璃颜色，配高光边缘与柔和阴影，浅深色均适配。不是不透明白色底板。

默认时长改为 5 秒，启动设置中可继续自定义和关闭。原来的 1.6/2.8 秒内置默认值会跟随变更；用户明确自定义的时长通过 `startupDurationCustomized` 标记保留。恢复默认会重置到 5 秒。

验证覆盖真实偏好读取、旧默认迁移、显式自定义保留、玻璃模糊、渐变文字、三阶段动画、跳过、深浅色和减少动态效果；实际运行预览位于 `output/startup-op-preview/opening-frost.gif`。

当前最终生成提示词：

```text
Use case: style-transfer. Use the attached image ONLY as the STYLE AND COLOR reference. Create a NEW wide 16:9 Japanese anime opening background WITHOUT ANY CHARACTER OR ANIMAL. Match the reference's extremely delicate luminous hand-painted bishoujo-game illustration quality: detailed pearlescent silver highlights, powder-blue ribbons of light, blush-pink sakura, finely brushed painterly clouds and translucent petal shading, dreamy blue-white afternoon lighting. A sweeping spiral current of MANY cherry blossom petals around open pale-blue central sky, with beautifully detailed pink flowering boughs at upper left and right, huge soft-focus pink blossoms and petals rushing past the lower foreground. A few clearly recognizable complete sakura blossoms in the wind. Blue lake and tiny distant town hints at the very bottom only; central half of frame mostly airy sky for app title and glass panel overlay. Dynamic diagonal wind composition and strong foreground/midground/distant depth, cinematic magical spring breeze, rich elegant detail as in reference, bright silver-blue and gentle pink, not washed out. NO GIRL, people, faces, bodies, animals, hands, text, logo, UI or glass panel (added in software). NOT hard flat cel-shading, vector, wedding floral border, jewelry, realistic photograph, 3D or neon galaxy. High-quality anime key art faithful to this reference's soft detailed painterly style, abundant cherry blossoms, scene remains energetic and immersive.
```

以下为此前方案历史记录。

## 日系 OP 修订（当前最终）

最终图片：`desktop/ui/assets/startup-sakura-anime.png`。通过内置 image_gen 生成并保存到工程，未使用 CLI/API。画面不含人物、动物，以赛璐璐蓝天和强透视粉色樱花风暴为主。之前的写实花卉试稿被弃用，未接入项目。

实际开场由斜向色块切镜、花瓣聚拢、绽放速度线、镜头旋转推进、渐变标题斜向入场和后段花雨组成；字标采用真正的 CSS 蓝紫粉渐变并持续流动。560 片带色块阴影的动态花瓣与少量完整樱花叠加在原画上，不再用人物、花环或婚礼花框。浅色使用白色斜向标题底，深色使用蓝色标题底以保证可读性。时长、跳过、自定义素材和减少动态效果兼容保留。

验证脚本 `desktop/verify-sakura-startup.mjs` 检查聚拢/绽放/散开阶段、渐变文字、无角色素材、深浅色、跳过和动效关闭；`desktop/capture-startup-op.mjs` 从实际应用窗口制作 `output/startup-op-preview/opening.gif` 动态预览。

最终生成提示词：

```text
Japanese 2D ANIME OPENING key visual, polished cel animation frame, dynamic Dutch-angle composition and extreme foreshortening. NO CHARACTERS OR PEOPLE. A powerful spiral of clearly recognizable PINK SAKURA PETALS sweeping from lower left toward upper right through brilliant saturated AZURE BLUE sky with dramatic white anime clouds. Enormous sharply drawn pink petals rush past the camera at foreground corners, smaller petals form a twisting wind tunnel in the distance. A few stylized FIVE-PETAL cherry blossoms spin among the petal storm. Bold elegant hand-drawn linework, clean CEL SHADING, crisp graphic pink shadow planes and brilliant white edge light, rich anime blue versus magenta-pink contrast, expressive speed-line wind strokes, high-energy Japanese TV anime OP / game opening visual. Center remains comparatively open pale blue for app wordmark. Wide landscape 16:9. Fully illustrated 2D, absolutely not realistic or 3D rendered. No photographic flowers, no botanical texture, no veins, no flower arrangement border, no wedding invitation, no jewelry, crystal or silk, no scenery buildings or mountains, no lettering or logo, no animals. Stylish, fresh, explosive, high impact motion-design illustration.
```

以下均为旧版方案历史记录。

## 筑梦喵统一画风修订（当前）

当前最终背景：`desktop/ui/assets/startup-sakura-brand.png`，使用内置 image_gen，以首页现有 `sakura-companion.png` 为角色与画风参考重绘。银白发猫耳、异色眼、蓝白花纹服装、小白猫和蓝粉日光场景保持一致；未使用 CLI/API，已保存到工程。旧 `startup-sakura-dream.png` 仅保留为历史资产，不再用于开屏。

动态部分为 640 片分层花瓣、48 朵五瓣樱花、24 朵 Logo 花环与 90 个花粉光点。前景放大并虚化，中远景旋转飘落，花瓣使用带缺口的樱花造型和细脉纹理；取消宇宙流光与科幻轨道。按实际显示器像素密度绘制，不再以粒子稀疏程度控制开场效果。文字区域减少遮挡；跳过、结束、隐藏和减少动态效果的停止机制保留。

当前最终生成提示词：

```text
Use case: identity-preserve. Input image is the character and visual style reference for our desktop app's OWN mascot, preserve this identity exactly. Create a NEW wide 16:9 premium anime startup illustration matching this exact soft detailed painterly art, silver white hair, white cat ears, left gold eye right blue eye, blue ribbons and cherry blossom hair ornaments, blue-white floral lace dress and the tiny white pet cat. Put the friendly girl on LEFT THIRD with head and ears fully inside frame, waist-up leaning on pale blue balcony, gentle happy smile, pet cat beside her at bottom-left. The RIGHT 45 percent is softly luminous light blue sky and pearly white/pale pink glow, calm enough to overlay dark blue app text. Surround all four edges with EXTREMELY ABUNDANT lush pink and white cherry blossoms: thick flowering branches across the top, large sharply detailed flowers close to lens at corners, translucent softly defocused foreground flower clusters at lower corners, layered smaller blossom canopy beyond. MANY softly floating individual sakura petals throughout the scene, opulent spring flower shower. Background distant charming lakeside European town and blue mountains, silver blue sky, fluffy clouds, warm pearlescent afternoon light. Blue and pink ribbon accents that match the girl's dress. This should feel like a luxurious spring anime character illustration and the SAME product identity as the reference, not a generic fantasy landscape. Airy silver-white, clear powder blue, blush pink, restrained lilac, finely layered, delicate natural flowers, readable character face. Keep right text area unoccupied by character. NO text, logos, UI, watermark, neon aurora, cosmic galaxy, night mountains or futuristic rings. No photorealism, no 3D, no simplified vector cartoon.
```

以下为旧版幻境方案的历史记录。

最终背景：`desktop/ui/assets/startup-sakura-dream.png`。使用内置 image_gen 生成，非 CLI/API；保留原始生成文件，项目已保存独立 PNG，不依赖用户缓存路径。

动态部分由本机 Canvas / CSS 实现：84 片分层花瓣、56 颗闪烁星尘、三层流光、围绕 Logo 的双光环、镜头推进和文字渐变。仅开屏可见期间运行，跳过/结束/页面隐藏/减少动态效果时停止；沿用原先时长、关闭和自定义素材设置。背景加载失败降级为极简开场。

最终生成提示词：

```text
Use case: stylized-concept. Asset type: cinematic wide desktop app opening background, landscape 16:9. A breathtaking luminous sakura dreamscape, premium hand-painted anime background. Luxuriant delicate cherry blossom branches arch in from the upper left and upper right, layered sharp foreground pale-pink blossoms, tiny distant flowering trees beside a glassy reflective lake, aurora-like flowing cyan violet and rose light ribbons in a twilight periwinkle sky. Distant radiant horizon and subtle sparkling stardust, spectacular depth, refined pearlescent lighting, silver blue and soft pink palette with vivid lilac highlights. Keep central 40 percent relatively calm and dark lavender blue, softly graded empty sky for white app wordmark overlay; blossoms and most detail concentrate at edges, reflections and luminous water along bottom. Immersive magical sense of arrival, polished and elegant, high contrast silhouettes, fine painterly detail, tasteful bloom. NO text, logo, symbols, borders, UI, characters or animals. Not flat vector, not photoreal, not oversaturated neon, no central sun glare.
```
