// Plugin thermal-power-600 — chuỗi SFC KHAI BÁO (doc 09 §3, ISA-88 / NFPA 85). DỮ LIỆU thuần: chỉ
// import type từ @idtp/sdk. SequenceEngine (@idtp/engines) chạy. Actions ghi tag lệnh (audit); giá trị
// thời gian/ngưỡng ngoài Design Basis = [GIẢ ĐỊNH] (GĐ-45). holdMs = thời gian giữ bước (mô phỏng).
import type { SequenceDef } from '@idtp/sdk';

export const thermalSequences: ReadonlyArray<SequenceDef> = [
  {
    sequenceId: 'mill-a-start',
    title: { vi: 'Khởi động máy nghiền A', en: 'Mill A start' },
    steps: [
      { stepId: 'purge', title: { vi: 'Thổi sạch mill', en: 'Purge mill' }, permissive: [], actions: [{ tag: 'BLR_MILL_A_PURGE_CMD', value: 1, reason: 'thổi sạch trước khi cấp than' }, { tag: 'BLR_MILL_A_STOP_CMD', value: 0, reason: 'xoá cờ dừng — mill A trở lại phối hợp' }], transition: [], holdMs: 300, timeoutMs: 30000 },
      { stepId: 'feeder', title: { vi: 'Chạy feeder', en: 'Start feeder' }, permissive: [], actions: [{ tag: 'BLR_MILL_A_FEEDER_CMD', value: 1, reason: 'cấp than tối thiểu' }], transition: [], holdMs: 300, timeoutMs: 30000 },
      { stepId: 'load', title: { vi: 'Tăng tải mill', en: 'Ramp mill load' }, permissive: [], actions: [{ tag: 'BLR_MILL_A_LOAD_CMD', value: 60, reason: 'đưa mill vào phối hợp CCS' }], transition: [], holdMs: 300, timeoutMs: 30000 },
    ],
  },
  {
    sequenceId: 'mill-a-stop',
    title: { vi: 'Dừng máy nghiền A', en: 'Mill A stop' },
    steps: [
      { stepId: 'unload', title: { vi: 'Giảm tải mill', en: 'Unload mill' }, permissive: [], actions: [{ tag: 'BLR_MILL_A_LOAD_CMD', value: 0, reason: 'giảm cấp than về 0' }], transition: [], holdMs: 300, timeoutMs: 30000 },
      { stepId: 'feeder-off', title: { vi: 'Dừng feeder', en: 'Stop feeder' }, permissive: [], actions: [{ tag: 'BLR_MILL_A_FEEDER_CMD', value: 0, reason: 'ngắt cấp than' }], transition: [], holdMs: 300, timeoutMs: 30000 },
      { stepId: 'purge-out', title: { vi: 'Thổi sạch & dừng', en: 'Purge & stop' }, permissive: [], actions: [{ tag: 'BLR_MILL_A_STOP_CMD', value: 1, reason: 'thổi sạch than còn lại rồi dừng' }], transition: [], holdMs: 400, timeoutMs: 30000 },
    ],
  },
  {
    sequenceId: 'boiler-purge',
    title: { vi: 'Thông gió lò (NFPA 85)', en: 'Boiler purge (NFPA 85)' },
    steps: [
      { stepId: 'dampers-open', title: { vi: 'Mở damper gió/khói', en: 'Open air/gas dampers' }, permissive: [], actions: [{ tag: 'BLR_PURGE_DAMPER_CMD', value: 1, reason: 'đường gió/khói thông suốt' }], transition: [], holdMs: 300, timeoutMs: 20000 },
      { stepId: 'air-flow', title: { vi: 'Đặt lưu lượng gió ≥ 30%', en: 'Set air flow ≥ 30%' }, permissive: [], actions: [{ tag: 'BLR_PURGE_AIR_CMD', value: 30, reason: 'NFPA 85: ≥ 30% MCR air' }], transition: [], holdMs: 500, timeoutMs: 20000 },
      { stepId: 'purge-hold', title: { vi: 'Giữ 5 lần thay khí', en: 'Hold 5 air changes' }, permissive: [], actions: [{ tag: 'BLR_PURGE_COMPLETE', value: 1, reason: 'đủ thời gian thông gió → cho phép light-off' }], transition: [], holdMs: 800, timeoutMs: 30000 },
    ],
  },
  {
    sequenceId: 'boiler-light-off',
    title: { vi: 'Mồi lửa lò', en: 'Boiler light-off' },
    steps: [
      { stepId: 'permit', title: { vi: 'Kiểm tra purge xong', en: 'Check purge complete' }, permissive: [{ tag: 'BLR_PURGE_COMPLETE', op: 'ge', value: 1 }], actions: [{ tag: 'BLR_IGNITER_CMD', value: 1, reason: 'cấp điện igniter khi đã purge' }], transition: [], holdMs: 300, timeoutMs: 15000 },
      { stepId: 'oil-gun', title: { vi: 'Vào súng dầu', en: 'Insert oil gun' }, permissive: [], actions: [{ tag: 'BLR_OIL_GUN_CMD', value: 1, reason: 'mồi lửa bằng dầu' }], transition: [], holdMs: 400, timeoutMs: 15000 },
      { stepId: 'flame', title: { vi: 'Xác nhận ngọn lửa', en: 'Prove flame' }, permissive: [], actions: [{ tag: 'BLR_FIRST_FUEL_CMD', value: 1, reason: 'ngọn lửa ổn định → cho phép cấp than' }], transition: [], holdMs: 400, timeoutMs: 15000 },
    ],
  },
  {
    sequenceId: 'feedwater-fill',
    title: { vi: 'Cấp nước điền lò', en: 'Feedwater fill' },
    steps: [
      { stepId: 'bfp', title: { vi: 'Chạy BFP', en: 'Start BFP' }, permissive: [], actions: [{ tag: 'BLR_BFP_START_CMD', value: 1, reason: 'khởi động bơm nước cấp' }], transition: [], holdMs: 400, timeoutMs: 30000 },
      { stepId: 'fill', title: { vi: 'Điền tới mức bình thường', en: 'Fill to normal level' }, permissive: [], actions: [{ tag: 'BLR_FW_FILL_CMD', value: 1, reason: 'điền bao hơi tới 0 mm' }], transition: [{ tag: 'BLR_DRUM_LEVEL_01', op: 'ge', value: -20 }], holdMs: 300, timeoutMs: 60000 },
      { stepId: 'auto', title: { vi: 'Chuyển 3-element AUTO', en: 'Drum level to AUTO' }, permissive: [], actions: [{ tag: 'BLR_FW_FILL_CMD', value: 0, reason: 'trao lại vòng mức 3-element' }], transition: [], holdMs: 200, timeoutMs: 10000 },
    ],
  },
  {
    sequenceId: 'turbine-roll',
    title: { vi: 'Quay turbine tới định mức', en: 'Turbine roll to speed' },
    steps: [
      { stepId: 'latch', title: { vi: 'Cài trip & mở stop valve', en: 'Latch & open stop valve' }, permissive: [], actions: [{ tag: 'TRB_LATCH_CMD', value: 1, reason: 'reset trip, mở stop valve' }], transition: [], holdMs: 300, timeoutMs: 20000 },
      { stepId: 'roll', title: { vi: 'Quay qua tốc độ tới hạn', en: 'Roll through critical speed' }, permissive: [], actions: [{ tag: 'TRB_SPEED_SP', value: 3000, reason: 'nâng tốc vượt vùng tới hạn' }], transition: [], holdMs: 800, timeoutMs: 60000 },
      { stepId: 'rated', title: { vi: 'Giữ 3000 rpm', en: 'Hold 3000 rpm' }, permissive: [], actions: [{ tag: 'TRB_READY_SYNC', value: 1, reason: 'đạt tốc định mức → sẵn sàng hoà' }], transition: [], holdMs: 300, timeoutMs: 20000 },
    ],
  },
  {
    sequenceId: 'generator-sync',
    title: { vi: 'Hoà máy phát', en: 'Generator synchronize' },
    steps: [
      { stepId: 'excite', title: { vi: 'Kích từ', en: 'Field excitation' }, permissive: [{ tag: 'TRB_READY_SYNC', op: 'ge', value: 1 }], actions: [{ tag: 'GEN_FIELD_CMD', value: 1, reason: 'đóng kích từ, dựng điện áp' }], transition: [], holdMs: 300, timeoutMs: 20000 },
      { stepId: 'match', title: { vi: 'Đồng bộ V/f/góc', en: 'Match V/f/angle' }, permissive: [], actions: [{ tag: 'GEN_SYNC_CMD', value: 1, reason: 'auto-synchronizer khớp lưới' }], transition: [], holdMs: 500, timeoutMs: 30000 },
      { stepId: 'close', title: { vi: 'Đóng máy cắt', en: 'Close breaker' }, permissive: [], actions: [{ tag: 'GEN_BREAKER_CMD', value: 1, reason: 'đóng breaker, nhận tải ban đầu' }], transition: [], holdMs: 300, timeoutMs: 15000 },
    ],
  },
  {
    sequenceId: 'unit-runback',
    title: { vi: 'Chạy lùi tải (runback)', en: 'Unit runback' },
    abortOnFail: true,
    steps: [
      { stepId: 'detect', title: { vi: 'Nhận sự kiện runback', en: 'Latch runback event' }, permissive: [], actions: [{ tag: 'UNIT_RUNBACK_CMD', value: 1, reason: 'mất thiết bị lớn → giảm tải nhanh' }], transition: [], holdMs: 200, timeoutMs: 5000 },
      { stepId: 'target', title: { vi: 'Đặt tải mục tiêu an toàn', en: 'Set safe target load' }, permissive: [], actions: [{ tag: 'BLR_MW_DEMAND', value: 300, reason: 'runback về tải hữu công an toàn' }], transition: [], holdMs: 500, timeoutMs: 30000 },
      { stepId: 'stabilize', title: { vi: 'Ổn định', en: 'Stabilize' }, permissive: [], actions: [{ tag: 'UNIT_RUNBACK_CMD', value: 0, reason: 'xoá cờ khi đã ổn định' }], transition: [], holdMs: 400, timeoutMs: 30000 },
    ],
  },
  {
    // NFPA 85: sau Master Fuel Trip, BẮT BUỘC thông gió lò trước khi cho phép mồi lửa lại (đuổi khí cháy
    // dư). Permissive chỉ cho chạy khi ĐÃ trip (BLR_MFT_TRIP ≥ 1) — không purge khi lò đang cháy.
    sequenceId: 'post-trip-purge',
    title: { vi: 'Thông gió sau trip (NFPA 85)', en: 'Post-trip purge (NFPA 85)' },
    steps: [
      { stepId: 'verify-trip', title: { vi: 'Xác nhận đã MFT', en: 'Verify MFT' }, permissive: [{ tag: 'BLR_MFT_TRIP', op: 'ge', value: 1 }], actions: [{ tag: 'BLR_POST_TRIP_PURGE_CMD', value: 1, reason: 'khởi động trình tự thông gió sau trip' }], transition: [], holdMs: 300, timeoutMs: 20000 },
      { stepId: 'dampers-open', title: { vi: 'Mở damper gió/khói', en: 'Open air/gas dampers' }, permissive: [], actions: [{ tag: 'BLR_PURGE_DAMPER_CMD', value: 1, reason: 'đường gió/khói thông suốt' }], transition: [], holdMs: 300, timeoutMs: 20000 },
      { stepId: 'air-flow', title: { vi: 'Đặt lưu lượng gió ≥ 30%', en: 'Set air flow ≥ 30%' }, permissive: [], actions: [{ tag: 'BLR_PURGE_AIR_CMD', value: 30, reason: 'NFPA 85: ≥ 30% MCR air, 5 lần thay khí' }], transition: [], holdMs: 500, timeoutMs: 30000 },
      { stepId: 'purge-done', title: { vi: 'Hoàn tất thông gió', en: 'Purge complete' }, permissive: [], actions: [{ tag: 'BLR_PURGE_COMPLETE', value: 1, reason: 'đủ thông gió → cho phép mồi lửa lại' }], transition: [], holdMs: 500, timeoutMs: 30000 },
    ],
  },
  {
    // Tiền đề cold-start (trước khi quay turbine): lập CHÂN KHÔNG bình ngưng — chạy nước tuần hoàn, cấp HƠI
    // CHÈN TRỤC (gland) chống lọt khí, khởi động SJAE hút khí không ngưng → kéo chân không tới định mức.
    sequenceId: 'condenser-vacuum-raise',
    title: { vi: 'Lập chân không bình ngưng', en: 'Condenser vacuum raising' },
    steps: [
      { stepId: 'cw-pumps', title: { vi: 'Chạy bơm nước tuần hoàn', en: 'Start CW pumps' }, permissive: [], actions: [{ tag: 'COND_CW_PUMP_CMD', value: 1, reason: 'cấp nước làm mát bình ngưng' }], transition: [], holdMs: 400, timeoutMs: 30000 },
      { stepId: 'gland-steam', title: { vi: 'Cấp hơi chèn trục', en: 'Admit gland steam' }, permissive: [], actions: [{ tag: 'TRB_GLAND_SEAL_CMD', value: 1, reason: 'chèn kín trục chống lọt khí trước khi hút chân không' }], transition: [], holdMs: 400, timeoutMs: 20000 },
      { stepId: 'sjae-start', title: { vi: 'Khởi động SJAE', en: 'Start air ejector (SJAE)' }, permissive: [{ tag: 'TRB_GLAND_SEAL_CMD', op: 'ge', value: 1 }], actions: [{ tag: 'COND_SJAE_START_CMD', value: 1, reason: 'hút khí không ngưng khỏi bình ngưng' }], transition: [], holdMs: 500, timeoutMs: 30000 },
      { stepId: 'pull-vacuum', title: { vi: 'Kéo chân không tới định mức', en: 'Pull to rated vacuum' }, permissive: [], actions: [{ tag: 'COND_VACUUM_READY', value: 1, reason: 'chân không đạt → cho phép quay turbine' }], transition: [{ tag: 'TRB_COND_VACUUM_01', op: 'le', value: 10 }], holdMs: 600, timeoutMs: 60000 },
    ],
  },
  {
    // Tiền đề cold-start (sau light-off, trước khi quay turbine): NÂNG ÁP lò có kiểm soát + SOAK làm ấm ống
    // góp/đường hơi (giãn nở nhiệt an toàn), mở drain quá nhiệt lúc áp thấp rồi đóng khi đã nâng áp.
    sequenceId: 'pressure-raising',
    title: { vi: 'Nâng áp lò & soak làm ấm', en: 'Boiler pressure raising & warm-up soak' },
    steps: [
      { stepId: 'sh-drains-open', title: { vi: 'Mở drain quá nhiệt', en: 'Open superheater drains' }, permissive: [{ tag: 'BLR_FIRST_FUEL_CMD', op: 'ge', value: 1 }], actions: [{ tag: 'BLR_SH_DRAIN_CMD', value: 1, reason: 'thoát nước ngưng đường hơi khi áp thấp' }], transition: [], holdMs: 400, timeoutMs: 20000 },
      { stepId: 'warm-soak', title: { vi: 'Soak làm ấm (giãn nở nhiệt)', en: 'Warm-up soak' }, permissive: [], actions: [{ tag: 'BLR_WARMUP_SOAK_CMD', value: 1, reason: 'giữ firing thấp làm ấm ống góp/đường hơi đều' }], transition: [], holdMs: 900, timeoutMs: 60000 },
      { stepId: 'raise', title: { vi: 'Nâng áp tới định mức', en: 'Raise to rated pressure' }, permissive: [], actions: [{ tag: 'BLR_PRESS_RAISE_CMD', value: 1, reason: 'tăng firing nâng áp có kiểm soát' }], transition: [{ tag: 'BLR_MSTM_SH_PRESS_01', op: 'ge', value: 16 }], holdMs: 600, timeoutMs: 90000 },
      { stepId: 'sh-drains-close', title: { vi: 'Đóng drain quá nhiệt', en: 'Close superheater drains' }, permissive: [], actions: [{ tag: 'BLR_SH_DRAIN_CMD', value: 0, reason: 'đã nâng áp → đóng drain, hơi sẵn sàng quay turbine' }], transition: [], holdMs: 300, timeoutMs: 15000 },
    ],
  },
  {
    // Two-shifting / island: TÁCH LƯỚI có kiểm soát — giảm tải về tự dùng, mở máy cắt đầu cực, chuyển máy
    // phát sang cấp TẢI TỰ DÙNG (house load) độc lập. Dùng cho tắt máy ca đêm hoặc khi mất lưới (island).
    sequenceId: 'generator-desync',
    title: { vi: 'Tách lưới về tải tự dùng', en: 'Generator desync to house load' },
    steps: [
      { stepId: 'unload', title: { vi: 'Giảm tải về tối thiểu', en: 'Reduce to minimum load' }, permissive: [], actions: [{ tag: 'BLR_MW_DEMAND', value: 40, reason: 'giảm tải hữu công về mức tự dùng trước khi tách' }], transition: [], holdMs: 500, timeoutMs: 60000 },
      { stepId: 'open-breaker', title: { vi: 'Mở máy cắt đầu cực', en: 'Open generator breaker' }, permissive: [], actions: [{ tag: 'GEN_BREAKER_CMD', value: 0, reason: 'tách máy phát khỏi lưới 500 kV' }], transition: [], holdMs: 400, timeoutMs: 20000 },
      { stepId: 'house-load', title: { vi: 'Chuyển cấp tải tự dùng', en: 'Transfer to house load' }, permissive: [], actions: [{ tag: 'UNIT_HOUSE_LOAD_CMD', value: 1, reason: 'máy phát cấp riêng tải tự dùng (island)' }], transition: [], holdMs: 400, timeoutMs: 20000 },
    ],
  },
  {
    // Two-shifting: Ủ LÒ qua đêm (hot banking) — giữ lò ở trạng thái nóng-chờ (áp/nhiệt gần định mức) để khởi
    // động lại NHANH vào ca sáng, thay vì để nguội hẳn. Giảm firing về mức ủ, duy trì mức bao hơi & áp.
    sequenceId: 'boiler-bank',
    title: { vi: 'Ủ lò nóng-chờ (hot banking)', en: 'Boiler hot banking' },
    steps: [
      { stepId: 'reduce-firing', title: { vi: 'Giảm firing về mức ủ', en: 'Reduce firing to banking rate' }, permissive: [], actions: [{ tag: 'BLR_BANK_CMD', value: 1, reason: 'giảm đốt về mức ủ giữ nhiệt' }], transition: [], holdMs: 500, timeoutMs: 30000 },
      { stepId: 'hot-standby', title: { vi: 'Vào nóng-chờ', en: 'Enter hot standby' }, permissive: [], actions: [{ tag: 'BLR_HOT_STANDBY_CMD', value: 1, reason: 'giữ áp/nhiệt gần định mức cho khởi động nhanh' }], transition: [], holdMs: 600, timeoutMs: 30000 },
      { stepId: 'maintain-level', title: { vi: 'Duy trì mức bao hơi', en: 'Maintain drum level' }, permissive: [], actions: [{ tag: 'BLR_BANK_LEVEL_CMD', value: 1, reason: 'giữ mức bao hơi trong khi ủ' }], transition: [], holdMs: 300, timeoutMs: 20000 },
    ],
  },
  {
    // Mang tải turbine theo KHỐI, RÀNG BUỘC TSE (v1.65): mỗi khối chỉ tiến khi ứng suất nhiệt rotor ≤ 85% —
    // tự động tôn trọng giới hạn mỏi nhiệt (permissive TSE_STRESS_PCT_01). Nối SFC với TSE (GĐ-128).
    sequenceId: 'turbine-loading-stress-limited',
    title: { vi: 'Mang tải turbine (ràng buộc ứng suất TSE)', en: 'Turbine loading (TSE stress-limited)' },
    steps: [
      { stepId: 'block-300', title: { vi: 'Khối tải 300 MW (chờ ứng suất ≤85%)', en: 'Load block 300 MW (await stress ≤85%)' }, permissive: [{ tag: 'TSE_STRESS_PCT_01', op: 'le', value: 85 }], actions: [{ tag: 'BLR_MW_DEMAND', value: 300, reason: 'khối tải 1 khi ứng suất rotor trong ngưỡng' }], transition: [], holdMs: 500, timeoutMs: 60000 },
      { stepId: 'block-450', title: { vi: 'Khối tải 450 MW (chờ ứng suất ≤85%)', en: 'Load block 450 MW (await stress ≤85%)' }, permissive: [{ tag: 'TSE_STRESS_PCT_01', op: 'le', value: 85 }], actions: [{ tag: 'BLR_MW_DEMAND', value: 450, reason: 'khối tải 2 khi ứng suất rotor trong ngưỡng' }], transition: [], holdMs: 500, timeoutMs: 60000 },
      { stepId: 'block-560', title: { vi: 'Khối tải 560 MW (chờ ứng suất ≤85%)', en: 'Load block 560 MW (await stress ≤85%)' }, permissive: [{ tag: 'TSE_STRESS_PCT_01', op: 'le', value: 85 }], actions: [{ tag: 'BLR_MW_DEMAND', value: 560, reason: 'khối tải 3 (đầy tải) khi ứng suất rotor trong ngưỡng' }], transition: [], holdMs: 500, timeoutMs: 60000 },
    ],
  },
];
