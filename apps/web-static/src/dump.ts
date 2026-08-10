// Dump định nghĩa màn hình ra file tĩnh — CHẠY QUA esbuild bundle (platform node) để tránh lỗi
// ERR_MODULE_NOT_FOUND của Node loader với import thiếu đuôi .js trong dist plugin (gotcha HANDOVER §8).
// esbuild inline mọi import khi bundle → chạy được. Thư mục ra nhận qua env IDTP_DIST.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createThermalRuntime } from '@idtp/app-thermal-runtime';
import { boilerScreens } from '@idtp/plugin-thermal-power-600';

const DIST = process.env.IDTP_DIST;
if (!DIST) throw new Error('dump: thiếu env IDTP_DIST');
mkdirSync(join(DIST, 'screen'), { recursive: true });

const rt = createThermalRuntime({ breadthLive: true });
const byId = new Map<string, { screenId: string; level: string; title: { vi: string; en: string } }>();
for (const s of boilerScreens) byId.set(s.screenId, s as never);
for (const s of rt.catalogScreens()) if (!byId.has(s.screenId)) byId.set(s.screenId, s as never);

const registry: Array<{ screenId: string; level: string; title: { vi: string; en: string } }> = [];
for (const [id, def] of byId) {
  writeFileSync(join(DIST, 'screen', id), JSON.stringify(def));
  registry.push({ screenId: def.screenId, level: def.level, title: def.title });
}
writeFileSync(join(DIST, 'screens'), JSON.stringify(registry));
console.log(`[web-static] dump ${byId.size} màn hình tĩnh`);
