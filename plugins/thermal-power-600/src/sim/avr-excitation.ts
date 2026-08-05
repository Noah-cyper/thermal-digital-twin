// Plugin thermal-power-600 — AvrExcitationModel (ISimModel, doc 10 §7 — AVR / hệ kích từ máy phát).
// CHỈ import @idtp/sdk. CHIỀU SÂU vật lý phía điện: bộ điều chỉnh điện áp tự động (AVR) giữ ĐIỆN ÁP ĐẦU CỰC
// máy phát bằng cách điều khiển DÒNG KÍCH TỪ (field/excitation) → chi phối công suất PHẢN KHÁNG (MVAr).
// Đọc `GEN_MVAR_01` (công suất phản kháng thực, đã có) để suy dòng kích từ cần thiết + đặc tuyến bão hoà;
// AUTO giữ V_đầu-cực = setpoint, MANUAL để điện áp trôi theo lưới (mất điều áp).
//
// ADDITIVE — sinh tag ELEC_* kích từ ĐỘC LẬP; KHÔNG ghi đè GEN_MVAR_01 / ELEC_GEN_MVA_01 (0 hồi quy). Tất
// định (không Math.random). Có TRẠNG THÁI (dòng kích từ + điện áp cực có quán tính) → snapshot/restore.
// Malfunction: 'grid-undervoltage' (lưới sụt → AVR tăng kích từ + MVAr đỡ áp) · 'avr-manual' (khoá kích từ,
// điện áp cực trôi theo lưới — minh hoạ mất điều áp trong OTS).
//
// Neo Design Basis (Phụ lục A §3.3): máy phát 667 MVA · 20 kV · cosφ 0,9 (⇒ ~290 MVAr đầy tải) · kích thích
// tĩnh. Dòng kích từ nền/trần, hệ số kích-từ→MVAr, điện trở cuộn kích, hệ số đỡ áp = [GIẢ ĐỊNH] GĐ-106.
import type { ISimModel, ISimModelContext, ISimSnapshot, ISimStepResult, IMalfunction, TagId } from '@idtp/sdk';

const V_BASE_KV = 20; // kV — điện áp đầu cực danh định
const V_SP_PU = 1.0; // pu — setpoint AVR
const FIELD_NOLOAD_A = 1500; // A — dòng kích từ giữ điện áp danh định khi KHÔNG phản kháng
const K_FIELD_A_PER_MVAR = 5.4; // A/MVAr — kích từ tăng theo phản kháng (neo: Q≈278 → field≈3000 A)
const FIELD_CEIL_A = 4000; // A — trần dòng kích từ (giới hạn nhiệt cuộn rotor)
const R_FIELD_OHM = 0.12; // Ω — điện trở cuộn kích (→ điện áp kích)
const K_SUPPORT_MVAR_PER_PU = 250; // MVAr/pu — phản kháng AVR huy động để đỡ áp khi lưới sụt
const GRID_DIP_PU = 0.94; // pu — điện áp lưới khi sụt (malfunction)
const TAU_AVR_S = 1.5; // s — quán tính vòng kích từ (AVR nhanh)

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export class AvrExcitationModel implements ISimModel {
  readonly id = 'thermal-avr-excitation';
  readonly tagsProvided: ReadonlyArray<TagId> = [
    'ELEC_TERM_VOLT_01', // kV — điện áp đầu cực máy phát
    'ELEC_TERM_VOLT_PU_01', // pu — điện áp đầu cực
    'ELEC_AVR_SETPOINT_01', // pu — setpoint điện áp AVR
    'ELEC_FIELD_CURRENT_01', // A — dòng kích từ (excitation)
    'ELEC_FIELD_VOLTAGE_01', // V — điện áp kích từ
    'ELEC_EXCITATION_01', // % — mức kích từ (so trần)
    'ELEC_REACTIVE_AVR_01', // MVAr — phản kháng AVR huy động (đầy tải ~ GEN_MVAR)
    'ELEC_AVR_MODE_01', // 0/1 — AVR ở chế độ AUTO
  ];

  private field = 3000; // A
  private vTermPu = V_SP_PU;
  private avrManual = false;
  private gridDip = false;

  init(_ctx?: ISimModelContext, _config?: unknown): void {
    this.field = 3000;
    this.vTermPu = V_SP_PU;
    this.avrManual = false;
    this.gridDip = false;
  }

  step(ctx: ISimModelContext): ISimStepResult {
    const dt = ctx.dtMs / 1000;
    const q = Math.max(0, ctx.getTag('GEN_MVAR_01')); // MVAr thực (đã có, chỉ đọc)
    const gridPu = this.gridDip ? GRID_DIP_PU : 1.0;
    const avrAuto = !this.avrManual;

    // AUTO: huy động thêm phản kháng đỡ áp khi lưới sụt (0 khi lưới danh định) → tăng kích từ, giữ V_cực.
    const qSupport = avrAuto ? K_SUPPORT_MVAR_PER_PU * Math.max(0, V_SP_PU - gridPu) : 0;
    const reactiveAvr = q + qSupport;

    // Dòng kích từ bám mục tiêu (nền + tỉ lệ phản kháng), có quán tính vòng kích từ.
    const fieldTarget = clamp(FIELD_NOLOAD_A + K_FIELD_A_PER_MVAR * reactiveAvr, 0, FIELD_CEIL_A * 1.1);
    this.field += (fieldTarget - this.field) * (dt / TAU_AVR_S);

    // Điện áp đầu cực: AUTO giữ setpoint; MANUAL để trôi theo lưới (kích từ khoá → mất điều áp).
    const vTarget = avrAuto ? V_SP_PU : gridPu;
    this.vTermPu += (vTarget - this.vTermPu) * (dt / TAU_AVR_S);

    const excitationPct = clamp((this.field / FIELD_CEIL_A) * 100, 0, 110);
    const fieldVoltage = this.field * R_FIELD_OHM;

    return {
      outputs: [
        { tagId: 'ELEC_TERM_VOLT_01', value: this.vTermPu * V_BASE_KV, quality: 'Good' },
        { tagId: 'ELEC_TERM_VOLT_PU_01', value: this.vTermPu, quality: 'Good' },
        { tagId: 'ELEC_AVR_SETPOINT_01', value: V_SP_PU, quality: 'Good' },
        { tagId: 'ELEC_FIELD_CURRENT_01', value: this.field, quality: 'Good' },
        { tagId: 'ELEC_FIELD_VOLTAGE_01', value: fieldVoltage, quality: 'Good' },
        { tagId: 'ELEC_EXCITATION_01', value: excitationPct, quality: 'Good' },
        { tagId: 'ELEC_REACTIVE_AVR_01', value: reactiveAvr, quality: 'Good' },
        { tagId: 'ELEC_AVR_MODE_01', value: avrAuto ? 1 : 0, quality: 'Good' },
      ],
    };
  }

  snapshot(): ISimSnapshot {
    return { state: { field: this.field, vTermPu: this.vTermPu, avrManual: this.avrManual ? 1 : 0, gridDip: this.gridDip ? 1 : 0 } };
  }
  restore(snapshot: ISimSnapshot): void {
    this.field = snapshot.state.field ?? 3000;
    this.vTermPu = snapshot.state.vTermPu ?? V_SP_PU;
    this.avrManual = (snapshot.state.avrManual ?? 0) > 0.5;
    this.gridDip = (snapshot.state.gridDip ?? 0) > 0.5;
  }
  injectMalfunction(m: IMalfunction): void {
    if (m.id === 'grid-undervoltage') this.gridDip = true;
    if (m.id === 'avr-manual') this.avrManual = true;
  }
  clearMalfunction(id: string): void {
    if (id === 'grid-undervoltage') this.gridDip = false;
    if (id === 'avr-manual') this.avrManual = false;
  }
  dispose(): void {
    // không giữ tài nguyên ngoài
  }
}
