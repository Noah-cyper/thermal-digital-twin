// @idtp/plugin-thermal-power-600 — plugin #1 (nội dung khai báo + ISimModel).
// BoilerIslandModel = mô hình Boiler Island đầy đủ (Pha B). DrumModel = mô hình drum tối giản
// dùng cho walking-skeleton Pha A (giữ lại làm tham chiếu).
export { BoilerIslandModel } from './sim/boiler-island';
export { TurbineGeneratorModel } from './sim/turbine-generator';
export { DrumModel } from './sim/drum';
export { boilerControlLoops, boilerLoopSeeds } from './control/loops';
export { boilerScreens, screenTags } from './graphics/screens';
export { boilerAlarms } from './alarms/boiler-alarms';
export { thermalKpis } from './kpi/calculators';
export { thermalMaintenance } from './maintenance/items';
export { thermalPredictiveRules } from './maintenance/predictive';
export { thermalFaceplates } from './faceplates/defs';
export { thermalNav } from './nav/tree';
export { thermalTagTemplates } from './seed/templates';
export { thermalSeedSpec } from './seed/spec';
export { thermalSequences } from './sequences/defs';
export { thermalScenarios } from './scenarios/defs';
export { thermalCauseEffect } from './cause-effect/matrices';
export { thermalKnowledge, thermalKnowledgeSource } from './ai/knowledge';
