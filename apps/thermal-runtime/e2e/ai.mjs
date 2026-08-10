import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PW = process.env.PW_CHROMIUM || undefined;
const PORT = 8093;
const srv = spawn('node', ['dist/server.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2500));
let fail = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const errors = [];
const browser = await chromium.launch({ executablePath: PW, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console:' + m.text()); });
await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

await page.click('#openAi');
await page.waitForTimeout(800);
ok((await page.evaluate(() => document.querySelectorAll('#aiFleet > div').length)) >= 12, 'panel AI: fleet ≥12 tài sản');
ok(/Mô phỏng|Demo/i.test(await page.evaluate(() => document.getElementById('aiNotice').textContent || '')), 'nhãn chế độ trung thực');
await page.evaluate(() => { const r = [...document.querySelectorAll('#aiFleet > div')].find(x => /\(FD\)/.test(x.textContent)); if (r) r.click(); });
await page.waitForTimeout(600);
ok(/\/100/.test(await page.evaluate(() => document.getElementById('aiDetail').textContent || '')), 'detail hiện điểm sức khoẻ + factor');

// chạy demo (evaluate-click để không bị modal chặn pointer)
await page.evaluate(() => document.getElementById('aiDemo').click());
await page.waitForTimeout(5000); // server step → publishCognitive + poll ai-assess
const detail = await page.evaluate(() => document.getElementById('aiDetail').textContent || '');
ok(/Vì sao|Cảnh báo|Nguy cấp/i.test(detail), 'sau tiêm sự cố: AI chẩn đoán — ' + detail.slice(0, 70).replace(/\s+/g, ' '));
ok(/MÔ PHỎNG/.test(detail), 'RUL gắn nhãn MÔ PHỎNG');
ok(errors.length === 0, 'không lỗi JS — ' + (errors.slice(0, 3).join(' | ') || 'none'));
console.log(fail === 0 ? '\nAI E2E PASS' : '\nAI E2E FAIL (' + fail + ')');
await browser.close(); srv.kill('SIGKILL'); process.exit(fail ? 1 : 0);
