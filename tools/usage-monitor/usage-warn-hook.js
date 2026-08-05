#!/usr/bin/env node
// Hook `Stop` Claude Code: sau mỗi lượt trả lời, đọc ~/.claude/.rate_limit_cache.json (do statusline ghi).
// Nếu 5h ≥ ngưỡng (mặc định 90, đổi bằng env USAGE_WARN_THRESHOLD) → cảnh báo người dùng qua systemMessage.
// Chỉ cảnh báo MỘT LẦN cho mỗi cửa sổ 5 giờ: nhớ resets_at đã cảnh báo trong ~/.claude/.rate_limit_warned.json.
// Im lặng (exit 0, không output) trong mọi trường hợp khác — không làm phiền mỗi lượt, không chặn Stop.
const fs = require('fs');
const os = require('os');
const path = require('path');

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }

try {
  const home = os.homedir();
  const cache = readJson(path.join(home, '.claude', '.rate_limit_cache.json'));
  if (!cache || !cache.five_hour) process.exit(0);

  const p5 = cache.five_hour.used_percentage;
  const resetsAt = cache.five_hour.resets_at ?? null;
  const threshold = Number(process.env.USAGE_WARN_THRESHOLD || 90);
  if (typeof p5 !== 'number' || p5 < threshold) process.exit(0);

  // Đã cảnh báo cho cửa sổ này chưa? (so theo resets_at)
  const warnedPath = path.join(home, '.claude', '.rate_limit_warned.json');
  const warned = readJson(warnedPath);
  if (warned && warned.resets_at === resetsAt) process.exit(0);

  try { fs.writeFileSync(warnedPath, JSON.stringify({ resets_at: resetsAt, at: Math.floor(Date.now() / 1000) })); } catch { /* noop */ }

  let when = '';
  if (typeof resetsAt === 'number') {
    const mins = Math.max(0, Math.round((resetsAt * 1000 - Date.now()) / 60000));
    when = mins >= 60 ? ` (reset sau ~${Math.floor(mins / 60)}h${mins % 60 ? ' ' + (mins % 60) + 'm' : ''})` : ` (reset sau ~${mins}m)`;
  }
  const msg = `⚠️ Đã dùng ${p5}% hạn mức 5 giờ (ngưỡng ${threshold}%)${when}. Cân nhắc gói gọn công việc / commit sớm trước khi bị khoá. Xem chi tiết: claude.ai/settings/usage`;
  process.stdout.write(JSON.stringify({ systemMessage: msg }));
  process.exit(0);
} catch {
  process.exit(0); // hook lỗi không bao giờ được chặn luồng
}
