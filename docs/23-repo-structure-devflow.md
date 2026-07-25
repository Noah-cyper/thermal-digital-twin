# 23 — Repo Structure & Dev Flow

> Tài liệu #23/00–25 (§14). Monorepo kernel + plugin. Nguồn: Phụ lục A §11.1 (điều chỉnh cho kernel/plugin).

## 1. Cấu trúc (monorepo — pnpm workspace + Turborepo)
```
idtp/
├─ apps/
│  ├─ hmi/            # Next.js 15 / React 19 (Operator client)
│  ├─ api/            # NestJS: REST + WS hub + Tag/Realtime + AuthZ
│  ├─ sim-engine/     # Simulation host (worker threads)
│  ├─ alarm-engine/   historian/   gateway/(v3)   loadgen/
├─ packages/
│  ├─ kernel/         # L1: UNS · asset · data-contract · event-bus · plugin-loader · audit · time
│  ├─ sdk/            # @idtp/sdk: interface + schema (doc 03)
│  ├─ ui/             # thư viện symbol SVG (doc 14)
│  ├─ contracts/      # OpenAPI + WS types
│  └─ config/         # eslint · tsconfig · tailwind preset
├─ plugins/
│  ├─ thermal-power-600/    # plugin #1 (dữ liệu khai báo)
│  └─ water-treatment-demo/ # plugin #2 (test generic)
├─ infra/docker/  (timescale · mosquitto · postgres · redis)
├─ docs/            # 00–25 (đang ở đây)
└─ CLAUDE.md  PROGRESS.md
```

## 2. Luật ranh giới (ESLint rule)
Plugin **chỉ** import `@idtp/sdk`; cấm import `apps/*`, `packages/kernel` (doc 02/03).

## 3. CI gate
`pnpm build` · `lint` (0 warning) · `typecheck` (strict) · `test` (≥70%) · Playwright e2e. Container lên được.

## 4. Quy ước commit
Conventional Commits: `type(scope): subject` (vd `docs(06): …`, `feat(kernel): …`). Branch feature → PR → gate → merge.

## 5. Giả định
| Mã | `[GIẢ ĐỊNH]` |
|---|---|
| GĐ‑31 | Turborepo (vs Nx) — chốt khi khởi tạo repo code |
