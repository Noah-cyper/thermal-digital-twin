# 06 — Process Analysis (Phân tích quy trình) — Index

> Tài liệu #06/00–25 (§10 prompt cha). **Tách theo hệ thống** (một file/hệ), mỗi hệ đủ **13 mục**.
> Mục tiêu **v1‑complete** (≥ 40 hệ) — trải nhiều batch. Neo Design Basis (Phụ lục A §3). Naming theo
> doc 04. **C&E matrix MFT/Turbine trip → doc 09** (ở đây chỉ nêu Interlock/Sequence từng hệ).

## Khung 13 mục/hệ (§10)
Chức năng · Nguyên lý · Thiết bị · Instrument · PLC/DCS thuộc hệ · Interlock/Trip · Alarm · Trend ·
Faceplate · Tag · Animation · Sequence · SOP.

## Danh mục hệ thống & thứ tự (slice‑first: Boiler Island)

| File | Hệ thống | Nhóm | Trạng thái |
|---|---|---|---|
| `06-01-steam-drum.md` | Steam Drum | Boiler Island | **Xong** |
| `06-02-combustion-furnace.md` | Combustion / Furnace | Boiler Island | **Xong** |
| `06-03-pulverizer.md` | Pulverizer (Mill A–F) | Boiler Island | **Xong** |
| `06-04-fans-fd-id-pa.md` | FD / ID / PA Fans | Boiler Island | chờ |
| `06-05-air-heater.md` | Air Heater | Boiler Island | chờ |
| `06-06-economizer.md` | Economizer | Boiler Island | chờ |
| `06-07-main-steam.md` | Main Steam (SH) | Boiler Island | chờ |
| `06-08-steam-temp-control.md` | SH/RH Temp Control | Boiler Island | chờ |
| `06-09-boiler-protection.md` | Boiler Protection (MFT) | Boiler Island | chờ |
| `06-20…59` | Turbine · Generator · Electrical · BoP | v1‑complete | chờ |

> Tiêu chí nghiệm thu (§10): ≥ 40 hệ · ≥ 3.000 tag · ≥ 600 alarm · ≥ 25 loop · ≥ 8 sequence.
