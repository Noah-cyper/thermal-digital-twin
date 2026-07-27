// @idtp/plugin-water-treatment-demo — plugin #2 (BÀI TEST GENERIC). Nội dung khai báo + 1 ISimModel.
// Runtime CHỈ import @idtp/sdk. Thêm plugin này KHÔNG sửa packages/* & apps/* (doc 00 §5.4).
export { WaterTankModel } from './sim/tank';
export { waterControlLoops, waterLoopSeeds } from './control/loops';
export { waterAlarms } from './alarms/alarms';
export { waterScreens, waterScreenTags } from './graphics/screens';
