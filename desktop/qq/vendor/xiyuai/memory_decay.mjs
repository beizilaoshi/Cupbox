/**
 * memory_decay.mjs —— 记忆遗忘曲线单一权威源（零依赖叶子·批D·件③b·维护者 拍 A）
 *
 * 只依赖 process.env / Math / Number / Date——**不 import 任何 src 模块**。
 * db.mjs 与 memory_v2.mjs 皆 import 本叶子（memory_v2 re-export computeMemoryDecay 向后兼容）：
 *   - 破 db↔memory_v2 成环（memory_v2:10 已 import db·若 db 裸 import memory_v2 取 decay=cycle）。
 *   - decay + 打分公式**只此一处**（批C fact_age_scan / tense_lock 零依赖叶子先例）。
 *
 * 遗忘曲线（design_D2_forgetting_curve）：
 *   - computeMemoryDecay：14/45/90 三段半衰·指数衰减·[0,1]。
 *   - scoreMemoryForRecall：D2-1 臂C 实证公式 score = weight/5×0.25 + imp/10×0.2
 *       + decay×0.3 + major×0.15 + ctxBoost×0.25（系数与半衰全 env 化灰度·dogfood 零代码调形）。
 *   - major = locked || imp≥9（user-pin=pinned∧imp≥9 被 imp≥9 覆盖）；auto-pin(pinned∧imp<9) **不吃 major·治毒化**。
 */

const MS_PER_DAY = 86_400_000;

// ─── env 化灰度常量（期1·dogfood 零代码调形·design_D2「常量全部 env 化」） ───────────────
function envNum(key, dflt) {
  const v = process.env[key];
  if (v === undefined || v === '') return dflt;
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

// 三段半衰（调形·天）：weight>=4 慢 / weight<=1 快 / 其余 中
export const DECAY_HALF_LIFE = {
  slow: envNum('MEM_HALFLIFE_SLOW', 90),
  mid:  envNum('MEM_HALFLIFE_MID', 45),
  fast: envNum('MEM_HALFLIFE_FAST', 14),
};

// D2-1 打分系数（设计 0.3 系·A/B 调形产物·现码旧值 0.2=接线前）
export const RECALL_SCORE_WEIGHTS = {
  weight: envNum('MEM_SCORE_W_WEIGHT', 0.25),
  imp:    envNum('MEM_SCORE_W_IMP', 0.2),
  decay:  envNum('MEM_SCORE_W_DECAY', 0.3),
  major:  envNum('MEM_SCORE_W_MAJOR', 0.15),
  ctx:    envNum('MEM_SCORE_W_CTX', 0.25),
};

// ─── decay ────────────────────────────────────────────────────────────────────

/**
 * 记忆衰减分 [0,1]。
 * locked=1 → 1.0（显式意志·永不褪）；pinned 且非 auto-pin → 1.0。
 * weight>=4 → 慢褪(半衰 90 天)；weight<=1 → 快褪(14 天)；其余 45 天。
 *
 * @param {boolean} ignoreAutoPin  读侧传 true：auto-pin(pinned∧imp<9)【不再豁免】走正常 decay（治毒化）；
 *   默认 false=零行为变更（夜批 applyMemoryDecayBatch / rank 旧调用不变·夜批 WHERE pinned=0 本就跳 pinned）。
 */
export function computeMemoryDecay(memory, now = new Date(), ignoreAutoPin = false) {
  // 🔴 批D·件③ auto-pin 治理(维护者 拍·locked-first)：locked=显式意志→永不褪；user-pin/高imp-pin(pinned∧imp≥9)→永活；
  //   auto-pin(pinned∧imp<9∧!locked·saveMemory imp≥7 自动 pin 的毒化源) 在读侧(ignoreAutoPin=true)【不再豁免】→走正常 decay。
  if (memory.locked) return 1.0;
  const autoPin = ignoreAutoPin && memory.pinned && (Number(memory.importance) || 5) < 9;
  if (memory.pinned && !autoPin) return 1.0;
  if (memory.memory_status && memory.memory_status !== 'active') return 0;

  const createdAt = memory.created_at ? new Date(String(memory.created_at).replace(' ', 'T')) : now;
  const lastUsed  = memory.last_used_at ? new Date(String(memory.last_used_at).replace(' ', 'T')) : createdAt;
  const refDate   = lastUsed > createdAt ? lastUsed : createdAt;
  const ageDays   = Math.max(0, (now - refDate) / MS_PER_DAY);

  const weight = typeof memory.memory_weight === 'number' ? memory.memory_weight : 3;
  let halfLifeDays;
  if (weight >= 4)      halfLifeDays = DECAY_HALF_LIFE.slow;
  else if (weight <= 1) halfLifeDays = DECAY_HALF_LIFE.fast;
  else                  halfLifeDays = DECAY_HALF_LIFE.mid;

  return Math.exp(-ageDays * Math.LN2 / halfLifeDays);
}

// ─── D2-1 召回打分 ──────────────────────────────────────────────────────────────

// weight 归一（0-5 clamp·叶子自持·不 import memory_v2 的 normalizeMemoryWeight 避成环）
function clampWeight01(weight) {
  const n = Number(weight);
  if (!Number.isFinite(n)) return 3 / 5;
  return Math.min(5, Math.max(0, Math.round(n))) / 5;
}

/**
 * D2-1 召回打分：score = weight/5×0.25 + imp/10×0.2 + decay×0.3 + major×0.15 + ctxBoost×0.25。
 *   - decay = computeMemoryDecay(m, now, ignoreAutoPin=true)（读侧治 auto-pin 毒化）。
 *   - major = locked || imp≥9（auto-pin=pinned∧imp<9 不吃 major）。
 *   - ctxBoost ∈ {0,1}：ctxWords 任一命中 content → 1（单项封顶 0.25）。件④ bigram/停用词改进 ctxWords 提取。
 *
 * @param {object}   m         记忆行（含 memory_weight/importance/locked/pinned/created_at/last_used_at）
 * @param {string[]} ctxWords  当前语境关键词（长度≥2·recallMemories 已提取）
 * @param {Date}     now
 * @returns {number}
 */
export function scoreMemoryForRecall(m, ctxWords = [], now = new Date()) {
  const decay   = computeMemoryDecay(m, now, true);
  const weight  = clampWeight01(m.memory_weight ?? 3);
  const impVal  = Number(m.importance);
  const impSafe = Number.isFinite(impVal) ? impVal : 5;
  const major   = (m.locked || impSafe >= 9) ? 1 : 0;

  let ctxBoost = 0;
  if (ctxWords.length && m.content) {
    if (ctxWords.some(w => w && m.content.includes(w))) ctxBoost = 1;
  }

  const W = RECALL_SCORE_WEIGHTS;
  return weight * W.weight
       + (impSafe / 10) * W.imp
       + decay * W.decay
       + major * W.major
       + ctxBoost * W.ctx;
}

