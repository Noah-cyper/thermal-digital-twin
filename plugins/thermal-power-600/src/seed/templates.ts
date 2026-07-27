// Template tag theo loại thiết bị (doc 07 §3 — ánh xạ 1:1 docs/07-tag-registry/templates.tags.yaml).
// DỮ LIỆU khai báo, chỉ import @idtp/sdk. SeedGenerator (@idtp/engines) expand template × instance.
import type { TagTemplate } from '@idtp/sdk';

export const thermalTagTemplates: TagTemplate[] = [
  {
    type: 'motor_pump', // bơm/quạt truyền động motor
    tags: [
      { suffix: 'RUN', datatype: 'bool', scan: 'process' },
      { suffix: 'MODE', datatype: 'int', scan: 'process', writable: true },
      { suffix: 'CURRENT', datatype: 'float', eu: 'A', scan: 'process', alarm: true },
      { suffix: 'FLOW', datatype: 'float', eu: 'm3/h', scan: 'process' },
      { suffix: 'DISCH_PRESS', datatype: 'float', eu: 'MPa', scan: 'process', alarm: true },
      { suffix: 'BRG_VIB', datatype: 'float', eu: 'mm/s', scan: 'fast', alarm: true },
      { suffix: 'BRG_TEMP_DE', datatype: 'float', eu: 'degC', scan: 'slow', alarm: true },
      { suffix: 'BRG_TEMP_NDE', datatype: 'float', eu: 'degC', scan: 'slow', alarm: true },
      { suffix: 'WIND_TEMP', datatype: 'float', eu: 'degC', scan: 'slow', alarm: true },
      { suffix: 'TRIP', datatype: 'bool', scan: 'fast', alarm: true },
    ],
  },
  { type: 'fan', ref: 'motor_pump' },
  {
    type: 'mill', // + đặc thù pulverizer
    tags: [
      { suffix: 'RUN', datatype: 'bool', scan: 'process' },
      { suffix: 'MODE', datatype: 'int', scan: 'process', writable: true },
      { suffix: 'OUTLET_TEMP', datatype: 'float', eu: 'degC', scan: 'process', alarm: true },
      { suffix: 'PA_FLOW', datatype: 'float', eu: 't/h', scan: 'process', alarm: true },
      { suffix: 'FEEDER_SPD', datatype: 'float', eu: '%', scan: 'process', writable: true },
      { suffix: 'CURRENT', datatype: 'float', eu: 'A', scan: 'process', alarm: true },
      { suffix: 'DP', datatype: 'float', eu: 'kPa', scan: 'process', alarm: true },
      { suffix: 'SEAL_AIR', datatype: 'float', eu: 'kPa', scan: 'process', alarm: true },
      { suffix: 'BRG_TEMP', datatype: 'float', eu: 'degC', scan: 'slow', alarm: true },
      { suffix: 'OUTLET_O2', datatype: 'float', eu: '%', scan: 'diag' },
      { suffix: 'FEEDER_TRIP', datatype: 'bool', scan: 'fast', alarm: true },
      { suffix: 'TRIP', datatype: 'bool', scan: 'fast', alarm: true },
    ],
  },
  {
    type: 'control_loop', // loop PID / van điều khiển
    tags: [
      { suffix: 'PV', datatype: 'float', scan: 'process', alarm: true },
      { suffix: 'SP', datatype: 'float', scan: 'process', writable: true },
      { suffix: 'OP', datatype: 'float', eu: '%', scan: 'process', writable: true },
      { suffix: 'MODE', datatype: 'int', scan: 'process', writable: true },
      { suffix: 'POS_FB', datatype: 'float', eu: '%', scan: 'process' },
      { suffix: 'OPEN', datatype: 'bool', scan: 'process' },
      { suffix: 'CLOSE', datatype: 'bool', scan: 'process' },
      { suffix: 'FAULT', datatype: 'bool', scan: 'fast', alarm: true },
    ],
  },
  {
    type: 'transmitter', // PT/TT/FT/LT analog
    tags: [
      { suffix: 'PV', datatype: 'float', scan: 'process', alarm: true },
      { suffix: 'QUALITY', datatype: 'int', scan: 'diag' },
      { suffix: 'ALM', datatype: 'bool', scan: 'process', alarm: true },
    ],
  },
  {
    type: 'analyzer', // O2 / CEMS
    tags: [
      { suffix: 'VALUE', datatype: 'float', scan: 'diag', alarm: true },
      { suffix: 'QUALITY', datatype: 'int', scan: 'diag' },
      { suffix: 'CAL_STATUS', datatype: 'int', scan: 'diag' },
      { suffix: 'RANGE', datatype: 'float', scan: 'diag' },
      { suffix: 'FAULT', datatype: 'bool', scan: 'diag', alarm: true },
    ],
  },
  {
    type: 'breaker', // đóng cắt điện
    tags: [
      { suffix: 'STATUS', datatype: 'int', scan: 'process' },
      { suffix: 'CURRENT', datatype: 'float', eu: 'A', scan: 'process', alarm: true },
      { suffix: 'VOLTAGE', datatype: 'float', eu: 'kV', scan: 'process', alarm: true },
      { suffix: 'PROT', datatype: 'bool', scan: 'fast', alarm: true },
      { suffix: 'TRIP', datatype: 'bool', scan: 'fast', alarm: true },
    ],
  },
  {
    type: 'heater_vessel', // heater / bình / bể
    tags: [
      { suffix: 'LEVEL', datatype: 'float', eu: 'mm', scan: 'process', alarm: true },
      { suffix: 'DRAIN', datatype: 'float', eu: '%', scan: 'process', writable: true },
      { suffix: 'IN_TEMP', datatype: 'float', eu: 'degC', scan: 'slow' },
      { suffix: 'OUT_TEMP', datatype: 'float', eu: 'degC', scan: 'slow', alarm: true },
      { suffix: 'BYPASS', datatype: 'bool', scan: 'process' },
      { suffix: 'ALM', datatype: 'bool', scan: 'process', alarm: true },
    ],
  },
  {
    type: 'calc_point', // điểm dẫn xuất / KPI (source = calc, doc 07 §4 "Calc/KPI/system/derived")
    tags: [{ suffix: 'VALUE', datatype: 'float', scan: 'slow' }],
  },
];
