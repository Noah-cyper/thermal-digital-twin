import { describe, it, expect } from 'vitest';
import { modbusRegister } from '../src/field-drivers';

// Quy đổi địa chỉ Modbus holding-register (hàm THUẦN, tất định) — phần THẬT của driver (kết nối modbus-serial)
// là deploy-only, c8-ignored; nhưng ánh xạ địa chỉ thì kiểm được không cần thiết bị.
describe('field-drivers — modbusRegister', () => {
  it('4xxxx → offset 0-based; số < 40001 giữ nguyên; không hợp lệ → -1', () => {
    expect(modbusRegister('40001')).toBe(0); // 40001 → thanh ghi 0
    expect(modbusRegister('40011')).toBe(10); // 40011 → 10
    expect(modbusRegister('40000')).toBe(40000); // < 40001 → dùng nguyên (không phải dải 4xxxx)
    expect(modbusRegister('7')).toBe(7); // số thuần → dùng nguyên
    expect(modbusRegister('abc')).toBe(-1); // không phải số → không hợp lệ
  });
});
