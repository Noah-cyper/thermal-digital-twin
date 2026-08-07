import { describe, it, expect } from 'vitest';
import { startServer } from '../src/server';

// Fleet view (v1.66): route /fleet phục vụ trang gom 2 twin. Kiểm HTTP (không cần twin nước để test route).
describe('thermal-runtime server — route /fleet', () => {
  it('/fleet trả HTML trang fleet (chứa FLEET + tham chiếu cổng nước 8090)', async () => {
    const app = startServer(0, { stepMs: 50 });
    const port = await app.ready;
    const res = await fetch(`http://127.0.0.1:${port}/fleet`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('FLEET');
    expect(html).toContain('8090'); // nối tới twin nước
    expect(html).toContain('D1-plant-health'); // subscribe rollup nhiệt điện
    await app.close();
  });
});
