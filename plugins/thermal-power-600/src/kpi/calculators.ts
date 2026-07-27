// Plugin thermal-power-600 — KPI KHAI BÁO (doc 21). Implement IKpiCalculator, CHỈ import @idtp/sdk.
// KpiEngine generic chạy trên Historian. Công thức neo Design Basis §3.1 (LHV, tự dùng ~7%).
import type { IKpiCalculator, IKpiInput, IKpiResult } from '@idtp/sdk';

const LHV = 21_500; // kJ/kg — Design Basis
const AUX_FRAC = 0.07; // tự dùng ~7% (Design Basis §3.1) — [GIẢ ĐỊNH] cố định (chưa đo house load)

async function heatRateKjKwh(input: IKpiInput): Promise<number> {
  const coal = await input.read('BLR_COAL_FLOW_01', 'avg'); // t/h
  const gross = await input.read('GEN_MW_01', 'avg'); // MW
  const net = gross * (1 - AUX_FRAC);
  return net > 1 ? (coal * LHV) / net : 0; // (t/h·kJ/kg)/MW = kJ/kWh
}

const heatRate: IKpiCalculator = {
  kpiId: 'heat-rate',
  unit: { symbol: 'kJ/kWh' },
  async compute(input): Promise<IKpiResult> {
    return { kpiId: 'heat-rate', value: await heatRateKjKwh(input), unit: { symbol: 'kJ/kWh' } };
  },
};

const efficiency: IKpiCalculator = {
  kpiId: 'efficiency',
  unit: { symbol: '%' },
  async compute(input): Promise<IKpiResult> {
    const hr = await heatRateKjKwh(input);
    return { kpiId: 'efficiency', value: hr > 0 ? (3600 / hr) * 100 : 0, unit: { symbol: '%' } };
  },
};

const steamRate: IKpiCalculator = {
  kpiId: 'steam-rate',
  unit: { symbol: 't/(h·MW)' },
  async compute(input): Promise<IKpiResult> {
    const steam = await input.read('BLR_STEAM_FLOW_01', 'avg');
    const gross = await input.read('GEN_MW_01', 'avg');
    return { kpiId: 'steam-rate', value: gross > 1 ? steam / gross : 0, unit: { symbol: 't/(h·MW)' } };
  },
};

export const thermalKpis: ReadonlyArray<IKpiCalculator> = [heatRate, efficiency, steamRate];
