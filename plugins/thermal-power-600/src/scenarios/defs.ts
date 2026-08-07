// Plugin thermal-power-600 — kịch bản nghiệm thu §10 (doc 22): cold-start → light-off → fill →
// mill start → turbine roll → sync → ramp → mill trip → runback → MFT/coast-down. DỮ LIỆU thuần.
// Pha khởi động chạy SFC (orchestration); pha ramp/trip/runback/coast tác động CCS thật (physics).
// Ghi chú: sim warm-start ở điểm vận hành nên chuỗi cold-start mang tính điều phối; physics cold-start
// đầy đủ = pha sim sâu hơn, để sau (GĐ-46). Số bước settle/ngưỡng = [GIẢ ĐỊNH].
import type { ScenarioDef } from '@idtp/sdk';

export const thermalScenarios: ReadonlyArray<ScenarioDef> = [
  {
    // Kịch bản nghiệm thu §10 ĐẦY ĐỦ (doc 22): cold-start (6 SFC) → ramp → giữ tải → sự cố mill → runback
    // → phục hồi → MASTER FUEL TRIP (nút tay → Cause&Effect → cắt nhiên liệu THẬT) → coast-down →
    // thông gió sau trip (NFPA 85). MFT dùng cơ chế trip thật (BLR_MFT_PB) — không phải chỉ đặt tải 0.
    scenarioId: 'unit-startup-to-coastdown',
    title: { vi: 'Cold-start → vận hành → MFT → coast-down', en: 'Cold-start → operate → MFT → coast-down' },
    sampleTags: ['GEN_MW_01', 'BLR_STEAM_FLOW_01', 'BLR_MSTM_SH_PRESS_01', 'BLR_DRUM_LEVEL_01', 'BLR_COAL_FLOW_01', 'BLR_MFT_TRIP'],
    phases: [
      { phaseId: 'purge', title: { vi: 'Thông gió lò (NFPA 85)', en: 'Boiler purge' }, action: 'sequence', ref: 'boiler-purge', settleSteps: 20 },
      { phaseId: 'light-off', title: { vi: 'Mồi lửa', en: 'Light-off' }, action: 'sequence', ref: 'boiler-light-off', settleSteps: 20 },
      { phaseId: 'fw-fill', title: { vi: 'Cấp nước điền lò', en: 'Feedwater fill' }, action: 'sequence', ref: 'feedwater-fill', settleSteps: 20 },
      { phaseId: 'mill-start', title: { vi: 'Khởi động mill A', en: 'Mill A start' }, action: 'sequence', ref: 'mill-a-start', settleSteps: 20 },
      { phaseId: 'turbine-roll', title: { vi: 'Quay turbine', en: 'Turbine roll' }, action: 'sequence', ref: 'turbine-roll', settleSteps: 20 },
      { phaseId: 'sync', title: { vi: 'Hoà máy phát', en: 'Generator sync' }, action: 'sequence', ref: 'generator-sync', settleSteps: 20 },
      { phaseId: 'ramp-up', title: { vi: 'Ramp tải lên 550 MW', en: 'Ramp to 550 MW' }, action: 'load', value: 550, settleSteps: 400 },
      { phaseId: 'hold', title: { vi: 'Giữ tải ổn định', en: 'Hold steady load' }, action: 'settle', settleSteps: 150 },
      { phaseId: 'mill-trip', title: { vi: 'Sự cố trip mill', en: 'Mill trip' }, action: 'malfunction', ref: 'mill-trip', settleSteps: 250 },
      { phaseId: 'runback', title: { vi: 'Runback tải', en: 'Unit runback' }, action: 'sequence', ref: 'unit-runback', settleSteps: 200 },
      { phaseId: 'mill-restore', title: { vi: 'Phục hồi mill', en: 'Restore mill' }, action: 'clear', ref: 'mill-trip', settleSteps: 150 },
      { phaseId: 'mft', title: { vi: 'MASTER FUEL TRIP (nút tay)', en: 'Master Fuel Trip' }, action: 'set', ref: 'BLR_MFT_PB', value: 1, settleSteps: 400 },
      { phaseId: 'coast-down', title: { vi: 'Coast-down', en: 'Coast-down' }, action: 'settle', settleSteps: 350 },
      { phaseId: 'post-trip-purge', title: { vi: 'Thông gió sau trip (NFPA 85)', en: 'Post-trip purge' }, action: 'sequence', ref: 'post-trip-purge', settleSteps: 40 },
    ],
  },
  {
    // Kịch bản KHỞI ĐỘNG SẠCH tới ĐẦY TẢI (không sự cố) — chuỗi cold-start ĐẦY ĐỦ gồm tiền đề chân không +
    // nâng áp/soak: lập chân không (gland/SJAE) → thông gió → mồi lửa → điền nước → nâng áp & soak → khởi
    // động mill → quay turbine → hoà lưới → ramp tới 600 MW → giữ tải phối hợp. Bổ trợ cho kịch bản
    // startup→coastdown (có trip) ở trên — đây là quỹ đạo vận hành BÌNH THƯỜNG lên đầy tải.
    scenarioId: 'cold-start-to-full-load',
    title: { vi: 'Cold-start → hoà lưới → ramp đầy tải 600 MW', en: 'Cold-start → sync → ramp to full load 600 MW' },
    sampleTags: ['GEN_MW_01', 'BLR_STEAM_FLOW_01', 'BLR_MSTM_SH_PRESS_01', 'TRB_COND_VACUUM_01', 'TRB_SPEED_01', 'BLR_COAL_FLOW_01'],
    phases: [
      { phaseId: 'vacuum', title: { vi: 'Lập chân không bình ngưng', en: 'Condenser vacuum raising' }, action: 'sequence', ref: 'condenser-vacuum-raise', settleSteps: 20 },
      { phaseId: 'purge', title: { vi: 'Thông gió lò (NFPA 85)', en: 'Boiler purge' }, action: 'sequence', ref: 'boiler-purge', settleSteps: 20 },
      { phaseId: 'light-off', title: { vi: 'Mồi lửa', en: 'Light-off' }, action: 'sequence', ref: 'boiler-light-off', settleSteps: 20 },
      { phaseId: 'fw-fill', title: { vi: 'Cấp nước điền lò', en: 'Feedwater fill' }, action: 'sequence', ref: 'feedwater-fill', settleSteps: 20 },
      { phaseId: 'pressure-raise', title: { vi: 'Nâng áp lò & soak', en: 'Pressure raising & soak' }, action: 'sequence', ref: 'pressure-raising', settleSteps: 20 },
      { phaseId: 'mill-start', title: { vi: 'Khởi động mill A', en: 'Mill A start' }, action: 'sequence', ref: 'mill-a-start', settleSteps: 20 },
      { phaseId: 'turbine-roll', title: { vi: 'Quay turbine', en: 'Turbine roll' }, action: 'sequence', ref: 'turbine-roll', settleSteps: 20 },
      { phaseId: 'sync', title: { vi: 'Hoà máy phát', en: 'Generator sync' }, action: 'sequence', ref: 'generator-sync', settleSteps: 20 },
      { phaseId: 'ramp-full', title: { vi: 'Ramp tải lên 600 MW', en: 'Ramp to 600 MW' }, action: 'load', value: 600, settleSteps: 500 },
      { phaseId: 'coordinated', title: { vi: 'Giữ đầy tải phối hợp', en: 'Hold full load (coordinated)' }, action: 'settle', settleSteps: 200 },
    ],
  },
  {
    // Vận hành TWO-SHIFTING: tắt máy ca đêm rồi khởi động lại ca sáng (nhà máy chạy theo phụ tải ngày/đêm).
    // Chiều tối giảm tải → tách lưới về tự dùng → ủ lò nóng-chờ → qua đêm → sáng mồi lại → hoà lưới → ramp.
    scenarioId: 'two-shift-cycle',
    title: { vi: 'Two-shift: tách lưới ca đêm → ủ lò → hoà lại ca sáng', en: 'Two-shift: overnight desync → bank → morning resync' },
    sampleTags: ['GEN_MW_01', 'BLR_STEAM_FLOW_01', 'BLR_MSTM_SH_PRESS_01', 'UNIT_HOUSE_LOAD_CMD', 'GEN_BREAKER_CMD', 'BLR_COAL_FLOW_01'],
    phases: [
      { phaseId: 'day-hold', title: { vi: 'Giữ tải ban ngày', en: 'Hold day load' }, action: 'settle', settleSteps: 100 },
      { phaseId: 'evening-unload', title: { vi: 'Chiều tối giảm tải', en: 'Evening unload' }, action: 'load', value: 200, settleSteps: 250 },
      { phaseId: 'desync', title: { vi: 'Tách lưới về tự dùng', en: 'Desync to house load' }, action: 'sequence', ref: 'generator-desync', settleSteps: 40 },
      { phaseId: 'bank', title: { vi: 'Ủ lò nóng-chờ', en: 'Boiler hot banking' }, action: 'sequence', ref: 'boiler-bank', settleSteps: 40 },
      { phaseId: 'overnight', title: { vi: 'Qua đêm (nóng-chờ)', en: 'Overnight (banked)' }, action: 'settle', settleSteps: 150 },
      { phaseId: 'exit-bank', title: { vi: 'Thoát ủ lò (khôi phục firing)', en: 'Exit banking (restore firing)' }, action: 'set', ref: 'BLR_BANK_CMD', value: 0, settleSteps: 20 },
      { phaseId: 'mill-restart', title: { vi: 'Khởi động lại mill', en: 'Restart mill' }, action: 'sequence', ref: 'mill-a-start', settleSteps: 20 },
      { phaseId: 'ready-sync', title: { vi: 'Turbine sẵn sàng hoà', en: 'Turbine ready to sync' }, action: 'set', ref: 'TRB_READY_SYNC', value: 1, settleSteps: 10 },
      { phaseId: 'resync', title: { vi: 'Hoà lưới lại', en: 'Resynchronize' }, action: 'sequence', ref: 'generator-sync', settleSteps: 20 },
      { phaseId: 'ramp-back', title: { vi: 'Ramp về tải ngày', en: 'Ramp back to day load' }, action: 'load', value: 448, settleSteps: 300 },
    ],
  },
  {
    // Vận hành ISLAND MODE: mất lưới (sự cố đường dây) → máy phát TÁCH LƯỚI, chạy runback cấp riêng TẢI TỰ
    // DÙNG (island) — governor giữ tần số, AVR giữ điện áp cực — tới khi lưới phục hồi thì HOÀ LẠI.
    scenarioId: 'grid-island-runback',
    title: { vi: 'Island: mất lưới → tự dùng độc lập → hoà lại', en: 'Island: grid loss → house load island → resync' },
    sampleTags: ['GEN_MW_01', 'SY_LINES_INSERVICE_01', 'UNIT_HOUSE_LOAD_CMD', 'ELEC_TERM_VOLT_PU_01', 'ANSI_81_FREQ_01', 'BLR_MSTM_SH_PRESS_01'],
    phases: [
      { phaseId: 'full', title: { vi: 'Vận hành đầy tải', en: 'Full load operation' }, action: 'settle', settleSteps: 100 },
      { phaseId: 'grid-loss', title: { vi: 'Mất lưới (cắt đường dây)', en: 'Grid loss (line trip)' }, action: 'malfunction', ref: 'line-trip', settleSteps: 60 },
      { phaseId: 'island', title: { vi: 'Tách lưới về tự dùng (island)', en: 'Island to house load' }, action: 'sequence', ref: 'generator-desync', settleSteps: 40 },
      { phaseId: 'island-hold', title: { vi: 'Chạy island (governor/AVR giữ)', en: 'Island hold (governor/AVR)' }, action: 'settle', settleSteps: 150 },
      { phaseId: 'grid-restore', title: { vi: 'Lưới phục hồi', en: 'Grid restored' }, action: 'clear', ref: 'line-trip', settleSteps: 40 },
      { phaseId: 'ready-sync', title: { vi: 'Turbine sẵn sàng hoà', en: 'Turbine ready to sync' }, action: 'set', ref: 'TRB_READY_SYNC', value: 1, settleSteps: 10 },
      { phaseId: 'resync', title: { vi: 'Hoà lưới lại', en: 'Resynchronize' }, action: 'sequence', ref: 'generator-sync', settleSteps: 20 },
      { phaseId: 'ramp-back', title: { vi: 'Ramp về tải', en: 'Ramp back to load' }, action: 'load', value: 448, settleSteps: 300 },
    ],
  },
  {
    // Cold-start MANG TẢI THEO KHỐI RÀNG BUỘC TSE (v1.66): dùng SFC turbine-loading-stress-limited (GĐ-133) →
    // mỗi khối tải chờ ứng suất rotor ≤ 85% rồi mới tiến (bảo vệ tuổi thọ rotor). Kiểm end-to-end.
    scenarioId: 'cold-start-stress-limited',
    title: { vi: 'Cold-start → mang tải ràng buộc ứng suất (TSE)', en: 'Cold-start → TSE stress-limited loading' },
    sampleTags: ['GEN_MW_01', 'TSE_STRESS_PCT_01', 'TSE_RAMP_LIMIT_01', 'BLR_MSTM_SH_PRESS_01', 'BFP_NPSH_MARGIN_01'],
    phases: [
      { phaseId: 'purge', title: { vi: 'Thông gió lò', en: 'Boiler purge' }, action: 'sequence', ref: 'boiler-purge', settleSteps: 20 },
      { phaseId: 'light-off', title: { vi: 'Mồi lửa', en: 'Light-off' }, action: 'sequence', ref: 'boiler-light-off', settleSteps: 20 },
      { phaseId: 'fw-fill', title: { vi: 'Cấp nước điền lò', en: 'Feedwater fill' }, action: 'sequence', ref: 'feedwater-fill', settleSteps: 20 },
      { phaseId: 'mill-start', title: { vi: 'Khởi động mill A', en: 'Mill A start' }, action: 'sequence', ref: 'mill-a-start', settleSteps: 20 },
      { phaseId: 'turbine-roll', title: { vi: 'Quay turbine', en: 'Turbine roll' }, action: 'sequence', ref: 'turbine-roll', settleSteps: 20 },
      { phaseId: 'sync', title: { vi: 'Hoà máy phát', en: 'Generator sync' }, action: 'sequence', ref: 'generator-sync', settleSteps: 20 },
      { phaseId: 'loading', title: { vi: 'Mang tải theo khối (ràng buộc TSE)', en: 'Stress-limited block loading' }, action: 'sequence', ref: 'turbine-loading-stress-limited', settleSteps: 300 },
      { phaseId: 'hold', title: { vi: 'Giữ đầy tải', en: 'Hold full load' }, action: 'settle', settleSteps: 150 },
    ],
  },
];
