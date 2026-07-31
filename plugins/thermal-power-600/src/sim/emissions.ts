// Plugin thermal-power-600 — EmissionsModel (ISimModel, doc 10 §6 — phát thải CEMS: bụi/SO₂/NOₓ/CO₂
// sau ESP + FGD). CHỈ import @idtp/sdk. CHIỀU SÂU vật lý bổ sung (v1.22), chạy CẠNH …/fluegas: đọc lưu
// lượng than/khói/gió thừa tươi → tính tải phát thải từ THÀNH PHẦN THAN (tro/S/C) rồi khử qua ESP/FGD,
// quy về nồng độ mg/Nm³ (CEMS). ADDITIVE — không đổi tag khác (0 hồi quy). Tất định (không Math.random).
//
// Neo Design Basis (Phụ lục A): than bituminous · tro 15 % · S 0,6 % · ESP 2×4 trường, bụi ra < 30
// mg/Nm³ · sơ đồ khói có FGD. Hàm lượng C than, tỷ lệ tro bay, độ khử ESP/FGD, ρ khói, tương quan NOₓ,
// thể tích khói riêng = [GIẢ ĐỊNH] (GĐ-69) — số kiểm định/CEMS thật thay khi có. ESP hiệu chỉnh để đạt
// mốc thiết kế < 30 mg/Nm³ (ESP được THIẾT KẾ để đạt ngưỡng này).
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

/* ── Design Basis (Phụ lục A) ── */
const ASH_FRAC = 0.15; // tro trong than
const S_FRAC = 0.006; // lưu huỳnh 0,6 %
const ESP_DUST_LIMIT_MG = 30; // bụi ra thiết kế < 30 mg/Nm³

/* ── [GIẢ ĐỊNH] hiệu chỉnh (GĐ-69) ── */
const C_FRAC = 0.62; // carbon trong than bituminous
const FLYASH_FRAC = 0.85; // phần tro bay (tới ESP); còn lại tro đáy
const ESP_EFF = 0.9977; // độ khử bụi ESP (hiệu chỉnh để đạt < 30 mg/Nm³)
const ESP_FIELD_PASS = Math.pow(1 - ESP_EFF, 1 / 4); // phần bụi lọt qua MỖI trường (4 trường nối tiếp)
const FGD_EFF = 0.95; // độ khử SO₂ của FGD ướt
const FG_DENSITY_KG_NM3 = 1.3; // khối lượng riêng khói
const NOX_BASE_MG = 320; // NOₓ nền ở O₂ danh định
const MW_SO2_S = 64 / 32; // kg SO₂ / kg S
const MW_CO2_C = 44 / 12; // kg CO₂ / kg C

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class EmissionsModel implements ISimModel {
  readonly id = 'thermal-emissions';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'EMI_FG_VOLUME_01', // Nm³/h — lưu lượng khói thể tích
    'EMI_DUST_STACK_01', // mg/Nm³ — bụi ra ống khói (sau ESP)
    'EMI_SO2_STACK_01', // mg/Nm³ — SO₂ ra ống khói (sau FGD)
    'EMI_NOX_STACK_01', // mg/Nm³ — NOₓ ra ống khói
    'EMI_CO2_RATE_01', // t/h — phát thải CO₂
    'EMI_ESP_EFF_01', // % — độ khử bụi ESP
    'EMI_FGD_EFF_01', // % — độ khử SO₂ FGD
    // Chiều sâu SCADA: nồng độ bụi qua TỪNG trường ESP (4 trường nối tiếp). Mỗi trường cho qua
    // (1−ESP_EFF)^(1/4) phần bụi → giảm dần từ đầu vào tới < 30 mg/Nm³ ở trường cuối (KHÔNG bịa: cùng
    // ESP_EFF tổng, chỉ khai triển theo tầng). Không thêm trạng thái.
    'EMI_ESP_IN_DUST_01',
    'EMI_ESP_F1_DUST_01',
    'EMI_ESP_F2_DUST_01',
    'EMI_ESP_F3_DUST_01',
    'EMI_ESP_F4_DUST_01',
  ];

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    // model không giữ trạng thái (phát thải tức thời theo đầu vào; đầu vào đã có quán tính)
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const coalTph = Math.max(0, ctx.getTag('BLR_COAL_FLOW_01')); // t/h
    const fgTph = Math.max(0, ctx.getTag('FG_FLOW_01')); // t/h khói
    const excess = Math.max(0, ctx.getTag('FG_EXCESS_AIR_01')); // %
    const firing = coalTph > 5;

    const coalKgh = coalTph * 1000;
    const vFgNm3h = firing ? (fgTph * 1000) / FG_DENSITY_KG_NM3 : 0; // Nm³/h

    // Bụi: tro bay tới ESP → sau ESP → nồng độ.
    const flyAshKgh = coalKgh * ASH_FRAC * FLYASH_FRAC;
    const dustStackKgh = flyAshKgh * (1 - ESP_EFF);
    const dustConc = vFgNm3h > 1 ? (dustStackKgh * 1e6) / vFgNm3h : 0; // mg/Nm³
    // Nồng độ bụi vào ESP + sau từng trường (4 trường nối tiếp, mỗi trường cho qua ESP_FIELD_PASS).
    const dustInConc = vFgNm3h > 1 ? (flyAshKgh * 1e6) / vFgNm3h : 0; // mg/Nm³ trước ESP
    const espField = (k: number): number => dustInConc * Math.pow(ESP_FIELD_PASS, k);

    // SO₂: từ S trong than → sau FGD → nồng độ.
    const so2RawKgh = coalKgh * S_FRAC * MW_SO2_S;
    const so2StackKgh = so2RawKgh * (1 - FGD_EFF);
    const so2Conc = vFgNm3h > 1 ? (so2StackKgh * 1e6) / vFgNm3h : 0; // mg/Nm³

    // NOₓ: nền theo tải, tăng nhẹ khi gió thừa cao (nhiều O₂ → nhiều NOₓ nhiệt) [GIẢ ĐỊNH].
    const noxConc = firing ? NOX_BASE_MG * clamp(1 + (excess - 18) / 120, 0.7, 1.4) : 0;

    // CO₂: từ carbon trong than (không khử) → tấn/h.
    const co2Tph = (coalKgh * C_FRAC * MW_CO2_C) / 1000;

    return {
      outputs: [
        { tagId: 'EMI_FG_VOLUME_01', value: vFgNm3h, quality: 'Good' },
        { tagId: 'EMI_DUST_STACK_01', value: dustConc, quality: 'Good' },
        { tagId: 'EMI_SO2_STACK_01', value: so2Conc, quality: 'Good' },
        { tagId: 'EMI_NOX_STACK_01', value: noxConc, quality: 'Good' },
        { tagId: 'EMI_CO2_RATE_01', value: co2Tph, quality: 'Good' },
        { tagId: 'EMI_ESP_EFF_01', value: firing ? ESP_EFF * 100 : 0, quality: 'Good' },
        { tagId: 'EMI_FGD_EFF_01', value: firing ? FGD_EFF * 100 : 0, quality: 'Good' },
        { tagId: 'EMI_ESP_IN_DUST_01', value: dustInConc, quality: 'Good' },
        { tagId: 'EMI_ESP_F1_DUST_01', value: espField(1), quality: 'Good' },
        { tagId: 'EMI_ESP_F2_DUST_01', value: espField(2), quality: 'Good' },
        { tagId: 'EMI_ESP_F3_DUST_01', value: espField(3), quality: 'Good' },
        { tagId: 'EMI_ESP_F4_DUST_01', value: espField(4), quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: {} };
  }
  restore(_snapshot: ISimSnapshot): void {
    // không giữ trạng thái
  }
  injectMalfunction(_m: IMalfunction): void {
    // model không có malfunction riêng ở v1.22
  }
  clearMalfunction(_id: string): void {
    // không giữ trạng thái malfunction
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}
