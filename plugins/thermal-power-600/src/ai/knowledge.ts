// Plugin thermal-power-600 — nguồn TRI THỨC cho AI Advisor v1 (doc 20, IAiKnowledgeSource). DỮ LIỆU
// thuần, chỉ import @idtp/sdk. Advisor READ-ONLY dùng để trích dẫn (SOP/cause-effect/narrative) khi
// giải thích alarm. Nội dung neo Design Basis / doc 06/09; số ngoài Design Basis đã ở GĐ tương ứng.
import type { IAiKnowledgeSource, IKnowledgeDoc } from '@idtp/sdk';

export const thermalKnowledge: ReadonlyArray<IKnowledgeDoc> = [
  {
    docId: 'SOP-DRUM-LOW',
    title: { vi: 'SOP — Mức bao hơi thấp', en: 'SOP — Low drum level' },
    kind: 'sop',
    text: 'Khi mức bao hơi thấp: tăng lưu lượng nước cấp, kiểm vòng điều khiển mức 3-element và bơm nước cấp (BFP). Nếu mức tiếp tục giảm tới −250 mm sẽ kích Master Fuel Trip (bảo vệ cạn nước lò).',
    tagRefs: ['BLR_DRUM_LEVEL_01'],
  },
  {
    docId: 'SOP-VACUUM',
    title: { vi: 'SOP — Mất chân không bình ngưng', en: 'SOP — Loss of condenser vacuum' },
    kind: 'sop',
    text: 'Chân không bình ngưng xấu đi: kiểm ejector/bơm chân không, hơi chèn (gland seal), nước làm mát (CW). Giảm tải để hạn chế quá nhiệt tầng cuối; chân không quá xấu sẽ kích turbine trip.',
    tagRefs: ['TRB_COND_VACUUM_01'],
  },
  {
    docId: 'CE-MFT',
    title: { vi: 'Cause & Effect — Master Fuel Trip', en: 'Cause & Effect — Master Fuel Trip' },
    kind: 'cause-effect',
    text: 'MFT cắt toàn bộ nhiên liệu để bảo vệ lò khi: mức bao hơi LL/HH, áp buồng lửa HH/LL, hoặc quá áp hơi chính. Hệ quả: trip nhiên liệu, trip mill, trip quạt PA, đóng van nhiên liệu.',
    tagRefs: ['BLR_DRUM_LEVEL_01', 'BLR_FURN_PRESS_01', 'BLR_MSTM_SH_PRESS_01'],
  },
  {
    docId: 'NARR-COMBUSTION',
    title: { vi: 'Diễn giải — Đốt & O₂', en: 'Narrative — Combustion & O2' },
    kind: 'narrative',
    text: 'O₂ khói thấp cho thấy cháy thiếu gió (thừa nhiên liệu) → nguy cơ CO cao, cháy không hoàn toàn. Điều chỉnh tỉ lệ gió/nhiên liệu (air/fuel) để đưa O₂ về ~3,2%.',
    tagRefs: ['BLR_FLUE_O2_01', 'BLR_COAL_FLOW_01'],
  },
];

export const thermalKnowledgeSource: IAiKnowledgeSource = {
  sourceId: 'thermal-power-600-knowledge',
  list: () => Promise.resolve(thermalKnowledge),
};
