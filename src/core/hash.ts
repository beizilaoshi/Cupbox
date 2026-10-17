import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';

export type HashAlgo = 'md5' | 'sha1' | 'sha256' | 'sha512';

const SUPPORTED: HashAlgo[] = ['md5', 'sha1', 'sha256', 'sha512'];

export function isSupportedAlgo(a: string): a is HashAlgo {
  return (SUPPORTED as string[]).includes(a);
}

export function hashText(text: string, algo: HashAlgo): string {
  return createHash(algo).update(text, 'utf8').digest('hex');
}

export async function hashFile(path: string, algo: HashAlgo): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash(algo);
    const s = createReadStream(path);
    s.on('data', (d) => h.update(d));
    s.on('end', () => resolve(h.digest('hex')));
    s.on('error', reject);
  });
}

/** Hash a text string or a file path with one or more algorithms at once. */
export async function hash(
  input: { text?: string; file?: string },
  algos: HashAlgo[] = ['sha256'],
): Promise<Record<string, string>> {
  for (const a of algos) {
    if (!isSupportedAlgo(a)) throw new Error(`不支持的算法: ${a}（支持 ${SUPPORTED.join('/')}）`);
  }
  const out: Record<string, string> = {};
  if (input.text !== undefined) {
    for (const a of algos) out[a] = hashText(input.text, a);
  } else if (input.file !== undefined) {
    await readFile(input.file); // fail fast with a clear ENOENT before streaming
    for (const a of algos) out[a] = await hashFile(input.file, a);
  } else {
    throw new Error('必须提供 text 或 file 之一');
  }
  return out;
}
