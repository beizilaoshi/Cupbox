# Cupbox 主题素材

1.0.2 新增的月湖、花庭、极光、沙丘、水墨图片及提示词见 [THEMES-1.0.2.md](THEMES-1.0.2.md)。当前 Logo 已更换为几何折叠盒与 C 形留白标识。

## 绽放壁纸与品牌图标

新增原创 Fluent 风格绽放壁纸，使用内置 image_gen 生成为浅色 `bloom-light.png` 与深色 `bloom-dark.png` 两版，自动跟随应用外观切换。背景可选择樱晴、绽放、纯色或本地图片，支持遮罩、模糊和适配方式。

Cupbox Logo 为原创 SVG「几何折叠盒」，文件 `cupbox-logo.svg`；同时提供 256px PNG 和 ICO，用于窗口图标。`../icons.js` 包含原创 24px 网格、1.65px 圆角描边 SVG 图标，覆盖 14 个本地工具、导航与主题操作。

浅色生成提示词：

Use case: stylized-concept. Asset type: original 16:9 desktop wallpaper for Cupbox app, premium Windows 11 inspired sculptural abstract bloom but an original shape, not a copy. A flowing translucent folded silk ribbon sculpture forming an open flower spiral, powder blue and soft lavender with hints of sakura pink. Matte pearlescent material, exquisite 3D studio rendering, subtle subsurface scattering, luminous airy ice-blue background, balanced composition with sculptural ribbon concentrated right and lower center and quieter upper left, soft ambient light, very clean, sophisticated fluid folds. Landscape 1792x1024. No text, logo, icons, UI, watermark, border.

深色生成提示词（以上述浅色图片作为参考）：

Use case: stylized-concept. Asset type: original dark desktop wallpaper for Cupbox. Use the referenced light wallpaper as compositional reference; recreate the same flowing folded silk bloom sculpture and camera view in a deep midnight navy studio. Sculptural petals glow cobalt blue, periwinkle and subtle violet edges, pearlescent satin soft highlights, dramatic but calm sophisticated soft studio lighting, dark navy negative space at upper left. Original Windows 11 inspired abstract ribbon bloom, premium 3D rendering, landscape 1792x1024. No text, logos, watermark, UI, icons, border.

---

使用内置 image_gen 工具生成，以用户提供的二次元插画为风格参考。图片已保存在项目内并接入首页与主题预览，浅色使用晴空蓝与樱花粉，深色使用低亮度蓝灰。

资源：`sakura-companion.png`

最终生成提示词：

Use case: illustration-story. Asset type: anime illustrated theme hero artwork for Cupbox desktop application. Use the attached image as a STYLE REFERENCE: match its exquisitely detailed pastel anime painting, soft luminous pink sakura petals, airy blue sky, silver-white hair, delicate floral ribbons, warm cheerful mood, sparkling spring sunlight, intricate soft watercolor-like shading and crisp anime eyes. Create an ORIGINAL welcoming scene: a smiling silver-haired cat-eared anime girl with blue and amber heterochromia, wearing a modest powder blue and white dress with floral hair ornaments and blue ribbons, resting her chin on one hand at a wooden desk with a small teacup and a cute white cat. Cherry blossom framing, distant lakeside town, pale sky, soft clouds. Wide cinematic 1792x1024 composition. Character on LEFT 40 percent, right 60 percent peaceful pale blue sky and distant lake with generous unobstructed space for app welcome copy added separately in code. Girl face in upper-middle-left, entire ears visible. Premium richly detailed anime game key visual, soft highlights, no harsh black outlines. No text, no lettering, no numerals, no anniversary cake, no logos, no watermark. This is an illustration asset, do not draw an app UI.
