# 桌宠衣橱与动作扩展提示词

使用内置 image_gen，共四次独立生成；transparent_background=true。参考图：工程内原始 sakura-atlas.png。输出原样保留透明 alpha，未通过脚本重新绘制或抠图。实际生成四张 1254×1254 的 4×4 图集，CSS 按相对比例切换帧。

## 四套素材共用提示词

Create a production desktop pet SPRITE ATLAS of the SAME mascot as the reference: silver-white long hair, white cat ears pink inside, one blue eye and one golden eye, cherry blossom hair ornaments, blue ribbons, chibi 2.5 heads tall, delicate polished pastel anime painterly shading. Keep identity exactly consistent in all cells. Full-body characters only on ACTUAL fully transparent alpha background, no gray/white backdrop, no lettering, no dividers. EXACT square image 2048x2048, FOUR columns and FOUR rows equal 512x512 cells. Each character centered within its own cell, entirely inside a 420x420 box, generous transparent margins all sides; same head scale and foot baseline. Do not let hair, cats, props or feet cross cell edges. Outfit as specified below stays identical across all 16 cells.
EXACT CELL ORDER left-to-right, top-to-bottom:
ROW1: (0) neutral cheerful standing hands together, eyes open; (1) playful WINK with one eye closed; (2) happy laughing celebration both hands raised; (3) SHY blushing face, fingers together looking sideways.
ROW2: (4) THINKING finger at chin curious face; (5) WORKING reading small blue notebook, focused; (6) SAD pout, watery eyes, no huge tears; (7) SURPRISED wide eyes and small open mouth hands near cheeks.
ROW3: (8) SLEEP sitting hugging tiny fluffy white cat, closed eyes; (9) STRETCH both arms up eyes softly closed; (10) cute mildly ANGRY puffed cheeks arms crossed; (11) HEART shape made with both hands, loving gentle smile.
ROW4 is a FOUR-FRAME WAVING ANIMATION of the exact same front-facing standing pose with open friendly eyes: frame12 right upper arm raised and palm tilted left; frame13 right palm upright at shoulder; frame14 right palm tilted right; frame15 right palm upright at shoulder again. Row4 body, face, clothing, feet and left arm are in the EXACT same location in all4 frames; only right forearm and palm rotate progressively. No detached hands. Small wave arc. This row is intended for looping frame animation.
Do not duplicate one pose in all cells. Count exactly16 full characters.

## 分别追加的服装要求

### sakura

OUTFIT: Original cherry blossom blue-and-white layered frilly dress and floral sleeves, lace and blue bows, matching blue shoes. Keep the reference outfit.

工程保存：desktop/ui/assets/pet/sakura-expressions.png

### academy

OUTFIT: Cozy navy-blue ACADEMY uniform: white blouse, navy sailor collar and modest pleated knee-length skirt, small powder-blue neck bow, navy cardigan, white socks and dark Mary Jane shoes. Keep cherry blossom hair clips and blue ribbons. Wholesome fully dressed.

工程保存：desktop/ui/assets/pet/academy-expressions.png

### cozy

OUTFIT: Soft pastel lavender and cream COZY PAJAMAS: loose long-sleeved pajama cardigan with tiny star embroidery, matching full-length pajama pants and fluffy white cat slippers. Hair loose but same hairstyle and blossom clips. No hat covering cat ears. Wholesome fully dressed.

工程保存：desktop/ui/assets/pet/cozy-expressions.png

### starlight

OUTFIT: Elegant midnight blue STAR MAGE outfit: short star-patterned capelet over modest light-blue knee-length dress, gold crescent brooch, small blue star hair ribbon, navy boots. No pointed hat, ears fully visible, no staff so hands remain clear. Silver and gold star embroidery. Wholesome fully dressed.

工程保存：desktop/ui/assets/pet/starlight-expressions.png


## 星夜魔法服最终修订

第四张输出的初版与原始蓝色礼服太接近，因此使用内置 image_gen 再编辑一次（transparent_background=true），最终覆盖本轮新建的 starlight-expressions.png，原有 sakura-atlas.png 保持不变。编辑提示词：

Edit ONLY the CLOTHING of the same silver-haired catgirl in all16 cells of this 4x4 transparent sprite sheet. Current mage outfit is too similar to the blue floral original. Replace it with a clearly distinct fantasy mage ensemble: rich deep PLUM PURPLE capelet with champagne-gold stars and gold crescent clasp, lavender knee-length modest dress with plain violet bodice and broad gold-trim hem, plum purple boots, tiny gold star on blue hair ribbon. NO blue floral pattern on clothes. White hair, cat ears, heterochromatic gold and blue eyes, blossom hair clips, face, tiny cat companion, all16 exact poses and ordered 4x4 grid remain unchanged. All four bottom-row waving frames must have same consistent purple clothing. Keep complete full-body each cell and clear padding, actual transparent alpha background outside characters, no gray/white background or lettering. Do not change identity, add a hat, add a staff, or add additional characters.
