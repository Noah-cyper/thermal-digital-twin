// E2E smoke (Playwright headless) cho water-runtime — digital twin thứ 2 (plugin #2) render + WS sống.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8090;
const fails = [];
const ok = (c, m) => { if (c) console.log('  ✓', m); else { fails.push(m); console.log('  ✗', m); } };

const srv = spawn('node', ['dist/server.mjs'], { cwd: APP, env: { ...process.env, PORT: String(PORT) } });
srv.stderr.on('data', (d) => process.stderr.write(d));
let ready = false;
srv.stdout.on('data', (d) => { if (String(d).includes('http://localhost')) ready = true; });
for (let t = 0; !ready && t < 100; t++) await new Promise((r) => setTimeout(r, 200));
if (!ready) { console.error('E2E: server không khởi động'); srv.kill(); process.exit(1); }

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage();
const jsErrors = [];
page.on('pageerror', (e) => jsErrors.push(e.message));
try {
  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#r_perm', { timeout: 10000 });
  await page.waitForTimeout(1500);

  // WS đã cập nhật readout (permeate > 0, thu hồi ~75%).
  const perm = await page.evaluate(() => parseFloat(document.getElementById('r_perm').textContent));
  ok(perm > 0, `RO permeate render > 0 (thấy ${perm})`);
  const rec = await page.evaluate(() => parseFloat(document.getElementById('r_rec').textContent));
  ok(rec > 60, `thu hồi RO render (thấy ${rec}%)`);
  const lvl = await page.evaluate(() => parseFloat(document.getElementById('t_level').textContent));
  ok(lvl > 30 && lvl < 90, `mức bể DM render hợp lý (thấy ${lvl}%)`);
  const link = await page.evaluate(() => document.getElementById('linkTxt').textContent);
  ok(link === 'LINK', `WS link established (${link})`);

  // Tiêm sự cố thủng màng → độ dẫn permeate tăng → alarm hiện trên panel.
  await page.evaluate(() => document.querySelector('button[data-malf="membrane-breach"]').click());
  await page.waitForTimeout(5000); // onDelay alarm 3 s + biên
  const alarmShown = await page.evaluate(() => /WTP-RO-COND-HI/.test(document.getElementById('alist').textContent || ''));
  ok(alarmShown, 'thủng màng → alarm WTP-RO-COND-HI hiện trên panel');

  ok(jsErrors.length === 0, 'không có lỗi JS — ' + (jsErrors.join(' | ') || 'none'));
} catch (e) {
  fails.push('EXCEPTION: ' + (e?.message || String(e)));
}
await browser.close();
srv.kill();
if (fails.length) { console.error(`\nE2E FAIL (${fails.length}):`); for (const f of fails) console.error('  ✗', f); process.exit(1); }
console.log('\nE2E PASS — water-runtime (plugin #2) HMI sống.');
process.exit(0);
