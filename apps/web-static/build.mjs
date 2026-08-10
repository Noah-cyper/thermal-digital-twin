// Build bản web tĩnh IDTP → apps/web-static/dist (Cloudflare Pages phục vụ thư mục này).
//  1) esbuild bundle src/entry.ts → dist/idtp-local.js (LocalBus + runtime, chạy trong trình duyệt);
//  2) esbuild bundle src/dump.ts (platform node) rồi chạy → dump định nghĩa màn hình ra dist/screen/<id>;
//  3) sinh dist/hmi.html từ FILE HMI DÙNG CHUNG (apps/thermal-runtime/public/index.html) — chèn <base> + <script>;
//  4) sinh dist/index.html (landing tiếng Việt) + copy asset tĩnh.
// Base path = /digital-twin-factory/ (subpath dưới hoantrantdh.com, qua Cloudflare Worker route).
// Lưu ý: build.mjs KHÔNG import trực tiếp @idtp/* (Node loader vướng import thiếu .js trong dist) — đi qua esbuild.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const DIST = join(HERE, 'dist');
const PUBLIC = join(HERE, 'public');
const SHARED_HMI = join(ROOT, 'apps', 'thermal-runtime', 'public', 'index.html');
const BASE = '/digital-twin-factory/';

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'screen'), { recursive: true });

// ── 1) Bundle LocalBus + runtime cho trình duyệt ────────────────────────────────
// Tên có BĂM NỘI DUNG (idtp-local-<hash>.js) → mỗi lần đổi bundle là tên đổi ⇒ KHÔNG bao giờ nạp bản cache cũ.
import { createHash } from 'node:crypto';
const bundleTmp = join(DIST, 'idtp-local.tmp.js');
await build({
  entryPoints: [join(HERE, 'src', 'entry.ts')],
  outfile: bundleTmp,
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
});
const bundleSrc = readFileSync(bundleTmp);
const bundleHash = createHash('sha256').update(bundleSrc).digest('hex').slice(0, 10);
const bundleName = `idtp-local-${bundleHash}.js`;
writeFileSync(join(DIST, bundleName), bundleSrc);
rmSync(bundleTmp, { force: true });

// ── 2) Dump màn hình: bundle src/dump.ts (node) → chạy (esbuild inline hết → không lỗi extensionless) ──
const dumpJs = join(DIST, '.dump.mjs');
await build({
  entryPoints: [join(HERE, 'src', 'dump.ts')],
  outfile: dumpJs,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  logLevel: 'info',
});
process.env.IDTP_DIST = DIST;
await import(pathToFileURL(dumpJs).href);
rmSync(dumpJs, { force: true });

// ── 3) Sinh dist/hmi.html từ file HMI dùng chung (không sửa nguồn, chỉ chèn lúc build) ──
const injectBase = (html) => html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n<base href="${BASE}">`);
let hmi = injectBase(readFileSync(SHARED_HMI, 'utf8'));
// nạp LocalBus TRƯỚC script trang (đặt trong <head>, blocking) → window.IDTPLocal sẵn khi connect() chạy.
hmi = hmi.replace(/<\/head>/i, `  <script src="${bundleName}"></script>\n</head>`);
writeFileSync(join(DIST, 'hmi.html'), hmi);

// ── 4) Landing + asset tĩnh ─────────────────────────────────────────────────────
for (const name of readdirSync(PUBLIC)) {
  const src = join(PUBLIC, name);
  if (statSync(src).isDirectory()) continue;
  if (name === 'landing.html') writeFileSync(join(DIST, 'index.html'), injectBase(readFileSync(src, 'utf8')));
  else copyFileSync(src, join(DIST, name));
}

// ── 5) _headers (Cloudflare Pages): content-type cho /screen/<id> (không đuôi) + cache asset ──
writeFileSync(join(DIST, '_headers'), [
  // Bundle có băm hash trong tên → an toàn cache vĩnh viễn (immutable).
  '/idtp-local-*.js',
  '  Cache-Control: public, max-age=31536000, immutable',
  // HTML: LUÔN revalidate để mỗi lần deploy nạp ngay bản mới (tránh stale như lỗi cache đã gặp).
  '/index.html',
  '  Cache-Control: no-cache',
  '/hmi.html',
  '  Cache-Control: no-cache',
  // Định nghĩa màn hình: content-type JSON + cache ngắn (revalidate sau 60 s).
  '/screen/*',
  '  Content-Type: application/json; charset=utf-8',
  '  Cache-Control: public, max-age=60',
  '',
].join('\n'));

console.log(`[web-static] build OK → ${DIST}`);
