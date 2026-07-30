// E2E smoke test (Playwright + Chromium headless) — cổng kiểm giao diện cho CI.
// Kiểm các BẤT BIẾN mà unit test không bắt được (đã từng lọt bug modal che màn hình + banner áp 0.00):
//   1) modal display:none lúc tải  2) mimic (home) render  3) banner áp suất stream
//   4) click thiết bị → drill D3  5) Trend viewer vẽ  6) SLD render  7) sparkline vẽ  8) 0 lỗi JS.
// Server tự spawn (node dist/server.mjs). Chromium: executablePath = $PW_CHROMIUM nếu có, else mặc định (CI).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;
const fails = [];
const ok = (cond, msg) => { if (cond) console.log('  ✓', msg); else { fails.push(msg); console.log('  ✗', msg); } };

const srv = spawn('node', ['dist/server.mjs'], { cwd: APP, env: { ...process.env, PORT: String(PORT) } });
srv.stderr.on('data', (d) => process.stderr.write(d));
let ready = false;
srv.stdout.on('data', (d) => { if (String(d).includes('http://localhost')) ready = true; });
for (let t = 0; !ready && t < 75; t++) await new Promise((r) => setTimeout(r, 200));
if (!ready) { console.error('E2E: server không khởi động'); srv.kill(); process.exit(1); }

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage();
const jsErrors = [];
page.on('pageerror', (e) => jsErrors.push(e.message));
try {
  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#openTrend', { timeout: 10000 });

  const modalDisp = await page.evaluate(() =>
    ['builderModal', 'journalModal', 'reportModal', 'diagModal', 'trendModal'].map((id) => {
      const e = document.getElementById(id);
      return e ? getComputedStyle(e).display : 'MISSING';
    }));
  ok(modalDisp.every((d) => d === 'none'), 'modal display:none lúc tải (không overlay che click) — ' + modalDisp.join(','));

  await page.waitForTimeout(1500);
  const eqN = await page.evaluate(() => document.querySelectorAll('.mimic-eq').length);
  ok(eqN >= 9, `mimic (home) render ≥ 9 thiết bị (thấy ${eqN})`);

  const press = await page.evaluate(() => parseFloat(document.getElementById('kPress').textContent));
  ok(press > 0, `banner áp suất stream, > 0 (thấy ${press})`);

  // Trend viewer — mở TỪ MÀN CHỦ (mimic, không có ô tile chồng lên nút điều khiển). Chờ Historian tích luỹ.
  await page.waitForTimeout(6000);
  await page.click('#openTrend');
  await page.waitForTimeout(1500);
  const trendPx = await page.evaluate(() => {
    const c = document.getElementById('trendCanvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) n++;
    return n;
  });
  ok(trendPx > 500, `Trend viewer vẽ dữ liệu (px ${trendPx})`);
  await page.click('#trendX');

  // Click thiết bị mimic → drill sang màn hệ thống (dispatchEvent, không lệ thuộc actionability).
  const title0 = await page.evaluate(() => document.getElementById('scrTitle').textContent);
  await page.evaluate(() => {
    const g = [...document.querySelectorAll('.mimic-eq')].find((x) => /Máy phát/.test(x.textContent));
    if (g) g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1000);
  const title1 = await page.evaluate(() => document.getElementById('scrTitle').textContent);
  ok(title1 !== title0 && /D3/.test(title1), `click thiết bị → drill màn D3 (${title1})`);

  await page.click('#navList button[data-id="D1-electrical-sld"]');
  await page.waitForTimeout(1500);
  ok((await page.evaluate(() => document.querySelectorAll('.mimic-eq').length)) >= 5, 'SLD điện render ≥ 5 thiết bị');

  await page.click('#navList button[data-id="D1-plant-overview"]');
  await page.waitForTimeout(4000);
  const spark = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('.tile canvas.spark')];
    let drawn = 0;
    for (const c of cs) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) { if (d[i] !== 0) { drawn++; break; } } }
    return { total: cs.length, drawn };
  });
  ok(spark.total > 0 && spark.drawn === spark.total, `sparkline vẽ trên mọi ô overview (${spark.drawn}/${spark.total})`);

  ok(jsErrors.length === 0, 'không có lỗi JS trên trang — ' + (jsErrors.join(' | ') || 'none'));
} catch (e) {
  fails.push('EXCEPTION: ' + (e && e.message ? e.message : String(e)));
}
await browser.close();
srv.kill();
if (fails.length) { console.error(`\nE2E FAIL (${fails.length}):`); for (const f of fails) console.error('  ✗', f); process.exit(1); }
console.log('\nE2E PASS — tất cả smoke check xanh.');
process.exit(0);
