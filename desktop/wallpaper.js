import path from 'node:path';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { nativeImage } from 'electron';

// Decode the selected image and keep a private, portable copy, independent of its source.
export async function importWallpaper(source, home) {
  if (!/\.(png|jpe?g|webp|bmp)$/i.test(source)) throw new Error('请选择 PNG、JPG、WebP 或 BMP 图片');
  const info = await stat(source);
  if (!info.isFile()) throw new Error('请选择图片文件');
  if (info.size > 20 * 1024 * 1024) throw new Error('请选择小于 20 MB 的图片');
  const data = await readFile(source);
  let picture = nativeImage.createFromBuffer(data);
  if (picture.isEmpty()) throw new Error('无法读取这张图片，请尝试 PNG 或 JPG 格式');
  const size = picture.getSize();
  if (Math.max(size.width, size.height) > 3840) {
    picture = picture.resize(size.width >= size.height ? { width: 3840 } : { height: 3840 });
  }
  await mkdir(home, { recursive: true });
  const dest = path.join(home, 'wallpaper.png');
  await writeFile(dest, picture.toPNG());
  return { url: `${pathToFileURL(dest).href}?v=${Date.now()}`, name: path.basename(source) };
}
