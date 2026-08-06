// Plugin thermal-power-600 — luật INTERLOCK / PERMISSIVE KHAI BÁO (doc 09 điều khiển). DỮ LIỆU thuần:
// CHỈ import type từ @idtp/sdk. InterlockEngine (@idtp/engines) thông dịch. Mỗi luật: khi TẤT CẢ điều
// kiện đúng → chặn lệnh có `target`, hiện `message` làm lý do. Ở ĐIỂM VẬN HÀNH (MFT=0 · turbine trip=0 ·
// áp≈17,5 · drum≈0 · chân không≈5,4 · FD≈62%) MỌI interlock BẤT HOẠT — không chặn nhầm. Ngưỡng ngoài
// Design Basis = [GIẢ ĐỊNH] GĐ-77.
import type { InterlockRule } from '@idtp/sdk';

export const thermalInterlocks: ReadonlyArray<InterlockRule> = [
  // ── Permissive lệnh ĐẶT TẢI (target 'load') ──
  {
    id: 'il-load-mft',
    target: 'load',
    when: [{ tag: 'BLR_MFT_TRIP', op: 'gt', value: 0 }],
    message: { vi: 'Đang Master Fuel Trip — nhiên liệu đã cắt; RESET MFT trước khi đặt tải.', en: 'Master Fuel Trip active — reset MFT before setting load.' },
  },
  {
    id: 'il-load-turbine-trip',
    target: 'load',
    when: [{ tag: 'TRB_TRIP', op: 'gt', value: 0 }],
    message: { vi: 'Turbine đã trip — không nhận lệnh tải; RESET turbine trip trước.', en: 'Turbine tripped — reset turbine trip before setting load.' },
  },
  {
    id: 'il-load-lowpress',
    target: 'load',
    when: [{ tag: 'BLR_MSTM_SH_PRESS_01', op: 'lt', value: 14 }],
    message: { vi: 'Áp hơi chính quá thấp (< 14 MPa) — khoá tăng tải cho tới khi phục áp.', en: 'Main steam pressure too low (< 14 MPa) — load raise blocked until recovered.' },
  },
  {
    // TSE (GĐ-128) thành RÀNG BUỘC điều khiển thật: ứng suất nhiệt rotor > 90% → khoá TĂNG TẢI cho tới khi
    // chênh nhiệt bề mặt–tâm giảm (tránh mỏi nhiệt). Điểm vận hành ứng suất ~0% → bất hoạt (0 hồi quy).
    id: 'il-load-tse-stress',
    target: 'load',
    when: [{ tag: 'TSE_STRESS_PCT_01', op: 'gt', value: 90 }],
    message: { vi: 'Ứng suất nhiệt rotor turbine > 90% (TSE) — khoá tăng tải tới khi chênh nhiệt bề mặt–tâm giảm.', en: 'Turbine rotor thermal stress > 90% (TSE) — load raise blocked until rotor ΔT recovers.' },
  },
  // ── Permissive chuyển AUTO loop MỨC BAO HƠI (target loopId 'drum-level') ──
  {
    id: 'il-drum-hh',
    target: 'drum-level',
    when: [{ tag: 'BLR_DRUM_LEVEL_01', op: 'gt', value: 250 }],
    message: { vi: 'Mức bao hơi HH (> 250 mm) — cấm chuyển loop mức sang AUTO (nguy cơ cuốn nước).', en: 'Drum level HH — auto mode blocked (carryover risk).' },
  },
  {
    id: 'il-drum-ll',
    target: 'drum-level',
    when: [{ tag: 'BLR_DRUM_LEVEL_01', op: 'lt', value: -250 }],
    message: { vi: 'Mức bao hơi LL (< −250 mm) — cấm chuyển loop mức sang AUTO (nguy cơ cạn lò).', en: 'Drum level LL — auto mode blocked (dry-out risk).' },
  },
  // ── Permissive KHỞI ĐỘNG MILL (target 'mill-a-start') — purge/air permissive NFPA 85 ──
  {
    id: 'il-mill-a-air',
    target: 'mill-a-start',
    when: [{ tag: 'BLR_FD_DAMPER_01', op: 'lt', value: 20 }],
    message: { vi: 'Chưa đủ gió cháy (FD damper < 20%) — cấm khởi động mill (permissive purge NFPA 85).', en: 'Insufficient combustion air (FD < 20%) — mill start blocked (NFPA 85 purge permissive).' },
  },
  // ── Permissive ROLL/MANG TẢI TURBINE (target 'turbine-roll') ──
  {
    id: 'il-turbine-vacuum',
    target: 'turbine-roll',
    when: [{ tag: 'TRB_COND_VACUUM_01', op: 'gt', value: 15 }],
    message: { vi: 'Chân không bình ngưng chưa đạt (> 15 kPa) — cấm roll/mang tải turbine.', en: 'Condenser vacuum not established (> 15 kPa) — turbine roll blocked.' },
  },
];
