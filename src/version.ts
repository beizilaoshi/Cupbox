import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);
let pkgVersion = '0.0.0';
try {
  pkgVersion = (require_('../package.json') as { version?: string }).version ?? '0.0.0';
} catch {
  /* dist 打包后找不到 package.json 时忽略 */
}
export const VERSION = pkgVersion;
