// @idtp/plugin-thermal-power-600 — plugin #1 (nội dung khai báo + ISimModel).
// BoilerIslandModel = mô hình Boiler Island đầy đủ (Pha B). DrumModel = mô hình drum tối giản
// dùng cho walking-skeleton Pha A (giữ lại làm tham chiếu).
export { BoilerIslandModel } from './sim/boiler-island';
export { DrumModel } from './sim/drum';
export { boilerControlLoops, boilerLoopSeeds } from './control/loops';
