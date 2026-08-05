# Usage monitor — cảnh báo sắp hết token (Claude Code)

Hai script cho **statusline + hook** của Claude Code để theo dõi hạn mức token **cửa sổ 5 giờ / 7 ngày**
theo thời gian thực, và **tự nhắc một lần** khi 5h ≥ ngưỡng (mặc định 90%).

- `usage-statusline.js` — hiện `[model] ctx X% | 5h Y% | 7d Z%` (xanh/vàng/đỏ theo 70/90, ⚠️ khi ≥ 90%);
  ghi số liệu mới nhất ra `~/.claude/.rate_limit_cache.json`.
- `usage-warn-hook.js` — chạy ở sự kiện `Stop` (sau mỗi lượt trả lời), đọc cache trên, nhắc **một lần cho mỗi
  cửa sổ 5 giờ** khi vượt ngưỡng. Đổi ngưỡng bằng env `USAGE_WARN_THRESHOLD` (vd `80`).

## Cài trên máy của bạn

> Cần **gói trả phí** (Pro/Max/Team/Enterprise) — số `rate_limits` không có với API key thuần, và chỉ xuất
> hiện **sau phản hồi API đầu tiên** trong phiên. Dùng đường dẫn **tuyệt đối**, dấu `/` kể cả trên Windows.

1. Chép 2 file `.js` vào thư mục scripts của Claude Code:
   - macOS/Linux: `~/.claude/scripts/` (rồi `chmod +x *.js`)
   - Windows: `C:\Users\<tên>\.claude\scripts\`
2. Mở (tạo nếu chưa có) `~/.claude/settings.json` — **đọc trước, đừng ghi đè key khác** — và thêm:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node /ABS/PATH/.claude/scripts/usage-statusline.js"
  },
  "hooks": {
    "Stop": [
      { "hooks": [ { "type": "command", "command": "node", "args": ["/ABS/PATH/.claude/scripts/usage-warn-hook.js"] } ] }
    ]
  }
}
```
   (Windows: dùng `C:/Users/<tên>/.claude/scripts/...` — dấu `/`. Nếu đã có `statusLine` khác thì giữ nó,
   chỉ thêm phần `hooks`.)
3. Kiểm nhanh bằng input giả lập — phải thấy `5h 93%` kèm ⚠️:
```bash
echo '{"model":{"display_name":"Test"},"context_window":{"used_percentage":10},"rate_limits":{"five_hour":{"used_percentage":93,"resets_at":9999999999},"seven_day":{"used_percentage":20,"resets_at":9999999999}}}' | node ~/.claude/scripts/usage-statusline.js
```

## Cần biết (không giấu)

- Claude Code · claude.ai chat · Desktop **dùng chung một hồ hạn mức** theo tài khoản. Mở 1 cửa sổ Claude Code
  có statusline này là thấy % **chung** (gồm cả phần đã dùng bên chat) — không cần vào Settings.
- **Trong chat claude.ai thường, không script nào đọc được % này** (giới hạn sản phẩm). Xem chính xác tại
  **claude.ai/settings/usage**.
- Hook nhắc dựa vào cache statusline ghi lần gần nhất → có thể trễ đúng 1 lượt; đủ để cảnh báo sớm, không phải
  "chính xác tức thời tuyệt đối".

Nguồn: skill `usage-limit-monitor`; tài liệu statusline: https://code.claude.com/docs/en/statusline
