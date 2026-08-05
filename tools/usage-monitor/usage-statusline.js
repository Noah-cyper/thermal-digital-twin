#!/usr/bin/env node
// Statusline Claude Code: hiện `[model] ctx X% | 5h Y% | 7d Z%`, tô màu xanh/vàng/đỏ theo ngưỡng 70/90,
// thêm ⚠️ khi 5h ≥ 90%. Ghi số liệu rate_limit mới nhất ra ~/.claude/.rate_limit_cache.json cho hook cảnh báo.
// Đọc JSON Claude Code đẩy vào stdin sau mỗi phản hồi. Không bao giờ chặn: lỗi gì cũng in được dòng status.
const fs = require('fs');
const os = require('os');
const path = require('path');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let d = {};
  try { d = JSON.parse(raw || '{}'); } catch { d = {}; }

  const model = (d.model && d.model.display_name) || 'Claude';
  const numOrNull = (v) => (typeof v === 'number' ? Math.round(v) : null);
  const ctx = numOrNull(d.context_window && d.context_window.used_percentage);
  const rl = d.rate_limits || {};
  const h5 = rl.five_hour || {};
  const d7 = rl.seven_day || {};
  const p5 = numOrNull(h5.used_percentage);
  const p7 = numOrNull(d7.used_percentage);

  const RESET = '\x1b[0m';
  const color = (v) => {
    if (v === null) return '\x1b[90m';   // xám: chưa có số liệu
    if (v >= 90) return '\x1b[31m';       // đỏ
    if (v >= 70) return '\x1b[33m';       // vàng
    return '\x1b[32m';                    // xanh
  };
  const seg = (label, v) => `${color(v)}${label} ${v === null ? '—' : v + '%'}${RESET}`;
  const warn = p5 !== null && p5 >= 90 ? ' \x1b[31m⚠️\x1b[0m' : '';
  const sep = ' \x1b[90m|\x1b[0m ';
  process.stdout.write(`\x1b[90m[${model}]\x1b[0m ` + [seg('ctx', ctx), seg('5h', p5), seg('7d', p7)].join(sep) + warn + '\n');

  // Cache cho hook cảnh báo — chỉ ghi khi thật sự có số liệu rate_limit (gói trả phí, sau phản hồi API đầu).
  if (p5 !== null || p7 !== null) {
    try {
      fs.writeFileSync(
        path.join(os.homedir(), '.claude', '.rate_limit_cache.json'),
        JSON.stringify({
          five_hour: { used_percentage: p5, resets_at: h5.resets_at ?? null },
          seven_day: { used_percentage: p7, resets_at: d7.resets_at ?? null },
          written_at: Math.floor(Date.now() / 1000),
        })
      );
    } catch { /* ghi cache lỗi không được làm hỏng statusline */ }
  }
});
