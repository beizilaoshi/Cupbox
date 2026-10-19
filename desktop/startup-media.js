import path from 'node:path';
import { stat, readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { nativeImage } from 'electron';

export async function importStartupMedia(source, home) {
  const ext = path.extname(source).toLowerCase();
  if (!['.png','.jpg','.jpeg','.webp','.gif','.mp4','.webm'].includes(ext)) throw new Error('请选择图片、GIF、MP4 或 WebM 文件');
  const info = await stat(source);
  if (!info.isFile() || info.size > 40 * 1024 * 1024) throw new Error('请选择小于 40 MB 的素材文件');
  const data = await readFile(source);
  const video = ext === '.mp4' || ext === '.webm';
  if (ext === '.mp4' && data.toString('ascii',4,8) !== 'ftyp') throw new Error('无法识别这个 MP4 文件');
  if (ext === '.webm' && data.subarray(0,4).toString('hex') !== '1a45dfa3') throw new Error('无法识别这个 WebM 文件');
  if (ext === '.gif' && !/^GIF8[79]a/.test(data.toString('ascii',0,6))) throw new Error('无法识别这个 GIF 文件');
  if (!video && ext !== '.gif' && nativeImage.createFromBuffer(data).isEmpty()) throw new Error('无法读取这张图片');
  await mkdir(home, {recursive:true});
  const dest = path.join(home,`startup${ext}`);
  await writeFile(dest,data);
  return { url:`${pathToFileURL(dest).href}?v=${Date.now()}`, name:path.basename(source), kind:video ? 'video' : 'image' };
}
