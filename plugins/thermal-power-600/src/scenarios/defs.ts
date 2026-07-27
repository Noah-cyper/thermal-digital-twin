// Plugin thermal-power-600 — kịch bản nghiệm thu §10 (doc 22): cold-start → light-off → fill →
// mill start → turbine roll → sync → ramp → mill trip → runback → MFT/coast-down. DỮ LIỆU thuần.
// Pha khởi động chạy SFC (orchestration); pha ramp/trip/runback/coast tác động CCS thật (physics).
// Ghi chú: sim warm-start ở điểm vận hành nên chuỗi cold-start mang tính điều phối; physics cold-start
// đầy đủ = pha sim sâu hơn, để sau (GĐ-46). Số bước settle/ngưỡng = [GIẢ ĐỊNH].
import type { ScenarioDef } from '@idtp/sdk';

export const thermalScenarios: ReadonlyArray<ScenarioDef> = [
  {
    scenarioId: 'unit-startup-to-coastdown',
    title: { vi: 'Khởi động → vận hành → coast-down', en: 'Startup → operate → coast-down' },
    sampleTags: ['GEN_MW_01', 'BLR_STEAM_FLOW_01', 'BLR_MSTM_SH_PRESS_01', 'BLR_DRUM_LEVEL_01', 'BLR_COAL_FLOW_01'],
    phases: [
      { phaseId: 'purge', title: { vi: 'Thông gió lò (NFPA 85)', en: 'Boiler purge' }, action: 'sequence', ref: 'boiler-purge', settleSteps: 20 },
      { phaseId: 'light-off', title: { vi: 'Mồi lửa', en: 'Light-off' }, action: 'sequence', ref: 'boiler-light-off', settleSteps: 20 },
      { phaseId: 'fw-fill', title: { vi: 'Cấp nước điền lò', en: 'Feedwater fill' }, action: 'sequence', ref: 'feedwater-fill', settleSteps: 20 },
      { phaseId: 'mill-start', title: { vi: 'Khởi động mill A', en: 'Mill A start' }, action: 'sequence', ref: 'mill-a-start', settleSteps: 20 },
      { phaseId: 'turbine-roll', title: { vi: 'Quay turbine', en: 'Turbine roll' }, action: 'sequence', ref: 'turbine-roll', settleSteps: 20 },
      { phaseId: 'sync', title: { vi: 'Hoà máy phát', en: 'Generator sync' }, action: 'sequence', ref: 'generator-sync', settleSteps: 20 },
      { phaseId: 'ramp-up', title: { vi: 'Ramp tải lên 550 MW', en: 'Ramp to 550 MW' }, action: 'load', value: 550, settleSteps: 400 },
      { phaseId: 'mill-trip', title: { vi: 'Sự cố trip mill', en: 'Mill trip' }, action: 'malfunction', ref: 'mill-trip', settleSteps: 250 },
      { phaseId: 'runback', title: { vi: 'Runback tải', en: 'Unit runback' }, action: 'sequence', ref: 'unit-runback', settleSteps: 250 },
      { phaseId: 'coast-down', title: { vi: 'MFT / coast-down', en: 'MFT / coast-down' }, action: 'load', value: 0, settleSteps: 500 },
    ],
  },
];
