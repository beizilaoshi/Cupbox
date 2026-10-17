import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const cleanup: string[] = [];

/** 创建一个临时目录，测试结束后自动删除。 */
export async function mkTmpDir(prefix = 'cupbox-test-'): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  cleanup.push(dir);
  return dir;
}

/** 递归创建文件：{ 'a/b.txt': '内容' } */
export async function seed(dir: string, files: Record<string, string>): Promise<void> {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content, 'utf8');
  }
}

export async function cleanupAll(): Promise<void> {
  while (cleanup.length > 0) {
    const dir = cleanup.pop()!;
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
