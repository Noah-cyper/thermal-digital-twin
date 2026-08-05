import { defineConfig, coverageConfigDefaults } from 'vitest/config';

// Chỉ tinh chỉnh ĐO COVERAGE — không đổi test discovery (giữ mặc định `**/*.test.ts`).
// Loại các script E2E chạy RIÊNG bằng `node` (Playwright headless: `e2e/*.mjs`) khỏi mẫu coverage:
// chúng KHÔNG được `vitest run` nạp nên luôn hiện 0% và bóp méo tổng coverage của gói.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      exclude: [...coverageConfigDefaults.exclude, 'e2e/**', '**/*.mjs'],
    },
  },
});
