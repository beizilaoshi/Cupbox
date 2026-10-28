/**
 * emotion_engine.mjs —— D4 情绪引擎（批E·E3 执刀·OCC 简化评价 + 三段式半衰 + 再评价算子）
 *
 * 🔴 E0c 闸最高规格：默认关=旧行为字节一致（本模块闸 OFF 时零消费·不写引擎表/不出 hint）。
 *   单一谓词 emotionEngineOn(companionId) 是【所有 fork 点唯一判定源】（E3 §3 接缝规格·四处：
 *   tickArcOnTime 入口 / 引擎计算入口 / hint 输出口 / E0b 迁移触发口）。
 * 🔴 铁线（D4 §2/§6·E3 §3.6）：情绪引擎【零沉默输入】——白名单不含任何时间差量(last_user_reply_at 族)、
 *   不含 arc 状态量；轻蔑(contempt)不在枚举（结构排除）；危机链零触碰。
 *
 * 数学内核已 scratchpad 预研 10/10（三段半衰/慢层 cap/怒退悲显/同源加速/单调性）。
 * Copyright (c) 2026 溪语 AI Contributors. MIT License.
 */

// ─── env 参数族（E0c §4·全 dogfood 校准·保守侧 D4 §1）───────────────────────────
const _num = (k, d) => { const v = process.env[k]; if (v === undefined || v === '') return d; const n = Number(v); return Number.isFinite(n) ? n : d; };

// 三段式半衰（小时）：快(annoyance/relief/surprise) / 中(joy/gratitude/upset/worry/hope/pride) / 慢(sadness/guilt)
export const EMO_HL = () => ({ fast: _num('EMOTION_HL_FAST', 1.5), mid: _num('EMOTION_HL_MID', 10), slow: _num('EMOTION_HL_SLOW', 36) });
export const EMO_IMP_MULT_MAX = () => _num('EMOTION_IMP_MULT_MAX', 2);   // 重要性乘数上限 ×2（文献 ×3 收保守）
export const EMO_SLOW_CAP     = () => _num('EMOTION_SLOW_CAP', 1.5);     // 🔴 §1 修正一：慢层乘数 cap（防 sadness 拖 5 天）
export const EMO_RUMINATE     = () => _num('EMOTION_RUMINATE_MULT', 3);  // 反刍减速（未决 ×3·事件解决即清）
export const EMO_HYST_THRESH  = () => _num('EMOTION_HYSTERESIS_THRESH', 55); // 负面和 >阈 同类刺激 ×1.5
export const EMO_HYST_MULT    = () => _num('EMOTION_HYSTERESIS_MULT', 1.5);
export const ENGINE_CALM_FLOOR = () => _num('ENGINE_CALM_FLOOR', 10);   // 🔴 engine_calmed 收敛地板（E3 §3.3）
export const ENGINE_CALM_FLOOR_DIGEST = () => _num('ENGINE_CALM_FLOOR_DIGEST', 10); // 增补：触发计数入 digest 的观察 floor（维护者·dogfood 校准）
export const EMOTION_APPRAISAL_SCALE = () => _num('EMOTION_APPRAISAL_SCALE', 1); // 评价 base 全局缩放（dogfood 校准·全 env 保守侧）
export const EMOTION_HINT_FLOOR = () => _num('EMOTION_HINT_FLOOR', 15);   // ②表达：负面和 <此 → 零 hint（平静不宣布·E4 判据）
// 再评价算子（自愈·只由事件触发·D4 §3）——各触发的回落系数（全 env·均 ≤1=只降不增）。
export const EMOTION_RESOLVE_FACTOR    = () => _num('EMOTION_RESOLVE_FACTOR', 0.6);    // ②同源解决即时回落
export const EMOTION_REAPPRAISE_FACTOR = () => _num('EMOTION_REAPPRAISE_FACTOR', 0.55); // ①换视角(Webb d=.45→×0.55)·③自我消化共用
export const EMOTION_DILUTE_FACTOR     = () => _num('EMOTION_DILUTE_FACTOR', 0.85);    // ④新好事冲淡(d=.27·最弱辅助)
export const EMOTION_SELF_PEAK_MIN     = () => _num('EMOTION_SELF_PEAK_MIN', 40);      // ③自我再评价触发的强度下限（高强度已过峰）

// ─── OCC 简化评价枚举（D4 §0·5 正 5 负·🔴 无 contempt）────────────────────────────
export const EMO_POSITIVE = Object.freeze(['joy', 'gratitude', 'pride', 'hope', 'relief']);
export const EMO_NEGATIVE = Object.freeze(['worry', 'upset', 'sadness', 'annoyance', 'guilt']);   // upset=生气委屈
export const EMOTIONS = Object.freeze([...EMO_POSITIVE, ...EMO_NEGATIVE]);
// 半衰分层归属
const EMO_LAYER = Object.freeze({
  annoyance: 'fast', relief: 'fast',
  joy: 'mid', gratitude: 'mid', pride: 'mid', hope: 'mid', upset: 'mid', worry: 'mid',
  sadness: 'slow', guilt: 'slow',
});
const MS_PER_HOUR = 3_600_000;

// ─── E0c 单一谓词：闸三态（OFF 字节一致 / WHITELIST dogfood / ON 全量）───────────────
// 读 process.env 于调用时（dogfood 设 env 即生效·无模块加载期缓存）。companionId 可空（非 companion 上下文=OFF）。
export function emotionEngineOn(companionId) {
  if (process.env.EMOTION_ENGINE !== '1') return false;              // OFF（默认）=旧行为字节一致
  const wl = (process.env.EMOTION_ENGINE_WHITELIST || '').trim();
  if (wl === '' ) return false;                                       // 开关开但无名单=保守视为 OFF（须显式名单或 '*'）
  if (wl === '*') return true;                                        // ON 全量（季后·维护者 拍）
  if (companionId == null) return false;                             // 白名单模式但无 companion 上下文 → OFF
  const set = new Set(wl.split(',').map(s => s.trim()).filter(Boolean));
  return set.has(String(companionId));                               // WHITELIST dogfood
}

// ─── 三段式半衰（纯函数·scratchpad 预研已验）──────────────────────────────────────
/**
 * 单情绪半衰（小时）：base 层半衰 × 重要性乘数(慢层 cap) × 反刍减速(未决)。
 * @param emotion  EMOTIONS 之一
 * @param importance 事件重要性（→乘数 ×0.5..MAX）
 * @param unresolved 差距是否仍在（未决→×RUMINATE 减速·事件解决即清）
 */
export function emotionHalfLifeHours(emotion, importance = 1, unresolved = false) {
  const layer = EMO_LAYER[emotion] || 'mid';
  const base = EMO_HL()[layer];
  const rawMult = Math.max(0.5, Math.min(EMO_IMP_MULT_MAX(), Number(importance) || 1));
  const mult = layer === 'slow' ? Math.min(rawMult, EMO_SLOW_CAP()) : rawMult;   // 🔴 慢层 cap
  const ruminate = unresolved ? EMO_RUMINATE() : 1;
  return base * mult * ruminate;
}

/**
 * 情绪脉冲随时间衰减（rise 即时·此处只管 down·单调不增=缺席绝不反向铁线）。
 * @param pulse { emotion, intensity, at(ISO/ms), importance, unresolved }
 * @param now Date
 * @returns 衰减后强度 [0,100]
 */
export function decayEmotionIntensity(pulse, now = new Date()) {
  const v0 = Math.max(0, Math.min(100, Number(pulse.intensity) || 0));
  if (v0 === 0) return 0;
  const atMs = typeof pulse.at === 'number' ? pulse.at
    : (pulse.at ? new Date(String(pulse.at).replace(' ', 'T')).getTime() : now.getTime());
  const dtH = Math.max(0, (now.getTime() - atMs) / MS_PER_HOUR);
  const hl = emotionHalfLifeHours(pulse.emotion, pulse.importance ?? 1, !!pulse.unresolved);
  return v0 * Math.exp(-Math.LN2 * dtH / hl);
}

/** 负面情绪当前总和（滞后闸/engine_calmed 判定用·纯读时算·不写库）。 */
export function negativeEmotionSum(pulses, now = new Date()) {
  let s = 0;
  for (const p of pulses || []) {
    if (EMO_NEGATIVE.includes(p.emotion)) s += decayEmotionIntensity(p, now);
  }
  return s;
}

// ─── OCC 简化评价（事件白名单 → 情绪脉冲·rise 即时·D4 §0/§2/§8）─────────────────────
// 事件白名单是【结构级铁线】：只有"她的世界事件 + 相处真实言行"入表；🔴 任何时间差量（沉默/缺席族）
//   注入即报错（D4 §6）；contempt 不在任何目标（轻蔑轨道禁用·同枚举法结构排除）。
// base 强度=保守默认·经 EMOTION_APPRAISAL_SCALE 全局缩放（dogfood 校准）；importance ×0.5..2 乘初始强度；
//   severe→叠加 sadness（怒悲同注·裁定①·差速半衰使"怒退悲显"）；负面高位（negSum>阈）同类刺激 ×1.5（滞后）。
const APPRAISAL_BASE = Object.freeze({
  // ── 相处摩擦（负·arc 冲突域·Phase 4 与 arc 转移双写）──
  harsh_words:      { neg: true,  emit: [['upset', 60]],                     coNote: [['sadness', 55]] },
  taboo_hit:        { neg: true,  emit: [['upset', 70]],                     coNote: [['sadness', 65]] },
  pressure_spam:    { neg: true,  emit: [['annoyance', 45], ['upset', 25]] },
  promise_broken:   { neg: true,  emit: [['upset', 55]] },   // 🔴 挂承诺重要性(importance)·非时长本身（§8①）
  schedule_setback: { neg: true,  emit: [['sadness', 30]] },
  // ── 相处正向 / 修复 ──
  warm_words:       { neg: false, emit: [['joy', 40], ['gratitude', 30]] },
  apology:          { neg: false, emit: [['relief', 35]] },   // + 同源加速（再评价·见下节）
  promise_kept:     { neg: false, emit: [['gratitude', 40], ['joy', 25]] },
  heard:            { neg: false, emit: [['gratitude', 45], ['relief', 30]] },  // 倾诉被接住（再评价触发①）
  teach:            { neg: false, emit: [['gratitude', 30], ['joy', 20]] },
  // ── 她的世界事件（正·各源接线 Phase 4+·base 值保守·待 dogfood 校准）──
  work_done:        { neg: false, emit: [['pride', 55], ['joy', 40]] },
  work_progress:    { neg: false, emit: [['joy', 25]] },
  surprise_good:    { neg: false, emit: [['joy', 45]] },
  social_good:      { neg: false, emit: [['joy', 40]] },
  schedule_achieve: { neg: false, emit: [['pride', 40]] },
  anchor_good:      { neg: false, emit: [['joy', 20]] },
});

// 🔴 铁线：沉默/缺席量绝不入评价（注入即报错·D4 §6·白名单枚举外=结构拒绝）。
export const FORBIDDEN_APPRAISAL_KEYS = Object.freeze([
  'last_user_reply_at', 'last_proactive_reply_at', 'missing_score',
  'neglect_stage', 'neglectStage', 'idle_hours', 'idleHours',
  'silence_hours', 'silenceHours', 'hours_idle', 'hoursIdle',
]);

/**
 * 事件评价 → 情绪脉冲（纯函数·rise 即时·D4 §0/§2）。
 * @param event { kind, importance=1, severe=false, event_id=null, at } —— 🔴 不得含任何沉默/缺席量（注入即报错）
 * @param currentPulses 当前脉冲（供滞后闸算 negSum·不改）
 * @param now Date
 * @returns [{emotion,intensity,importance,unresolved,source:'event',event_id,at}]（白名单外 kind → []）
 */
export function appraiseEvent(event = {}, currentPulses = [], now = new Date()) {
  for (const k of FORBIDDEN_APPRAISAL_KEYS) {
    if (k in event) throw new Error(`appraiseEvent 铁线违规：沉默/缺席量 '${k}' 不得入情绪评价（沉默无入口）`);
  }
  const { kind, importance = 1, severe = false, event_id = null, at = now.toISOString() } = event;
  const row = APPRAISAL_BASE[kind];
  if (!row) return [];   // 白名单外 = 零输入（结构级拒绝）
  const scale = EMOTION_APPRAISAL_SCALE();
  const impMult = Math.max(0.5, Math.min(EMO_IMP_MULT_MAX(), Number(importance) || 1));
  const hyst = (row.neg && negativeEmotionSum(currentPulses, now) > EMO_HYST_THRESH()) ? EMO_HYST_MULT() : 1;
  const specs = severe ? [...row.emit, ...(row.coNote || [])] : row.emit;
  const pulses = [];
  for (const [emotion, base] of specs) {
    if (!EMOTIONS.includes(emotion)) continue;   // 结构护栏：非枚举（含 contempt）拒绝
    const intensity = Math.max(0, Math.min(100, base * impMult * scale * hyst));
    if (intensity <= 0) continue;
    pulses.push({ emotion, intensity, importance: impMult, unresolved: !!row.neg, source: 'event', event_id, at });
  }
  return pulses;
}

// ─── 再评价算子（自愈·只由事件触发·时间只管衰减·D4 §3）─────────────────────────────
// 🔴 缺席绝不反向：任何触发只【降低或不变】负面·绝不加重（单调自愈·所有系数 ≤1）。正面不动。
// ①heard 换视角（倾诉被接住）②resolve 同源加速（道歉/事件解决→同 event_id 族全体加速回落·demo 修正二）
// ③self 次日自我消化（高强度已过峰·概率·🔴大情绪 imp≥2 当轮不许想通→须 isNextDay）④dilute 新好事冲淡（最弱辅助）
export function reappraise(pulses, trigger = {}, now = new Date()) {
  const { type, event_id = null, isNextDay = false, roll = 1 } = trigger;
  return (pulses || []).map((p) => {
    if (!EMO_NEGATIVE.includes(p.emotion)) return { ...p };   // 正面不动（负面来得有因去得自然·正面允许绵延）
    const cur = decayEmotionIntensity(p, now);                // 当前有效强度（衰减后）
    let factor = 1, clearUnresolved = false;
    if (type === 'resolve') {
      if (event_id != null && p.event_id === event_id) { factor = EMOTION_RESOLVE_FACTOR(); clearUnresolved = true; }
    } else if (type === 'heard') {
      factor = EMOTION_REAPPRAISE_FACTOR(); clearUnresolved = true;
    } else if (type === 'self') {
      // ③只在次日、且高强度已过峰、概率命中时消化（大情绪 imp≥2 因 isNextDay 前置=当轮已被排除）。
      // 🔴 E5②(B1)：成功"想开了"=不再反刍→清 unresolved（与紧邻 heard 一致·同为认知再评价）。否则只砍一刀、
      //   反刍尾巴仍 ×3 拖两周(读法A 15 天不达"数天")；清后尾巴半衰 162h→54h→数天衰过 floor·让 E4「自己会散」诚实。
      //   零触碰数学(MULT/floor/factor/半衰全不动)·只改脉冲已决位=与 resolve/heard 同一操作。
      if (isNextDay && cur >= EMOTION_SELF_PEAK_MIN() && roll < 0.5) { factor = EMOTION_REAPPRAISE_FACTOR(); clearUnresolved = true; }
    } else if (type === 'dilute') {
      factor = EMOTION_DILUTE_FACTOR();
    }
    if (factor >= 1 && !clearUnresolved) return { ...p };
    const newIntensity = Math.max(0, Math.min(100, cur * factor));   // ≤cur=单调（缺席绝不反向）
    return { ...p, intensity: newIntensity, at: now.toISOString(), unresolved: clearUnresolved ? false : p.unresolved };
  });
}

// ─── E0b 存量 arc 迁移折算（纯函数·开闸一次性·db.mjs 调·无 DB 副作用）────────────────
// 规格：E0b arc→引擎迁移规格。开闸时非 normal 存量 arc → 引擎脉冲，
// 强度按【在态时长】引擎半衰折算（老态迁近零=天然平静·防旧情绪原样再注）。scar 直接清除。
// 🔴 铁线（§4）：只读 arc_state + stateChangedAt（存量快照）·【不读 last_user_reply_at 族】
//   （stateChangedAt=该态起始时刻·非沉默时长·只用于折算衰减不产生新情绪）·目标枚举无 contempt。
export const MIG_HURT_UPSET   = () => _num('MIG_HURT_UPSET', 45);   // hurt → upset base
export const MIG_COLD_UPSET   = () => _num('MIG_COLD_UPSET', 40);   // cold → upset base（怒退）
export const MIG_COLD_SAD     = () => _num('MIG_COLD_SAD', 55);     // cold → sadness base（悲显）
export const MIG_WD_SAD       = () => _num('MIG_WD_SAD', 75);       // withdrawing → sadness base
export const MIG_REPAIR_UPSET = () => _num('MIG_REPAIR_UPSET', 15); // repairing → 低 upset（近愈残余）
export const MIG_HL_UPSET     = () => _num('MIG_HL_UPSET', 10);     // 折算半衰·中层保守中点（D4 §1）
export const MIG_HL_SADNESS   = () => _num('MIG_HL_SADNESS', 36);   // 折算半衰·慢层
export const MIG_DROP_FLOOR   = () => _num('MIG_DROP_FLOOR', 5);    // 折算后 <此 → 丢弃（已消化）

// arc_state → 迁移脉冲模板（base 强度 + 折算半衰）；normal / normal_with_scar 无脉冲。
function _migTemplates(arcState) {
  switch (arcState) {
    case 'hurt':        return [{ emotion: 'upset',   base: MIG_HURT_UPSET(),   hl: MIG_HL_UPSET() }];
    case 'cold':        return [{ emotion: 'upset',   base: MIG_COLD_UPSET(),   hl: MIG_HL_UPSET() },
                                { emotion: 'sadness', base: MIG_COLD_SAD(),     hl: MIG_HL_SADNESS() }];
    case 'withdrawing': return [{ emotion: 'sadness', base: MIG_WD_SAD(),       hl: MIG_HL_SADNESS() }];
    case 'repairing':   return [{ emotion: 'upset',   base: MIG_REPAIR_UPSET(), hl: MIG_HL_UPSET() }];
    default:            return [];   // normal / normal_with_scar
  }
}

/**
 * 存量 arc 迁移为引擎脉冲（纯函数·E0b §1/§2·同输入同输出可审计）。
 * @param arcState         现存 arc_state
 * @param stateChangedAtMs 该态起始时刻(ms)——🔴 只用于折算衰减·非沉默时长（铁线：不涉 last_user_reply）
 * @param now              Date
 * @returns { pulses:[{emotion,intensity,importance,unresolved}], clearScar:bool }
 *   intensity=按在态时长折算后的【当前有效强度】（engine 从 now 接管继续三段半衰）；
 *   折算后 <MIG_DROP_FLOOR 的脉冲丢弃（该情绪视为已消化）；importance=1/unresolved=false（账已清·不反刍）。
 */
export function migrateArcToPulses(arcState, stateChangedAtMs, now = new Date()) {
  const clearScar = arcState === 'normal_with_scar';
  const nowMs = now.getTime();
  const baseMs = Number(stateChangedAtMs);
  const hoursInState = Math.max(0, (nowMs - (Number.isFinite(baseMs) ? baseMs : nowMs)) / MS_PER_HOUR);
  const pulses = [];
  for (const t of _migTemplates(arcState)) {
    const decayed = t.base * Math.exp(-Math.LN2 * hoursInState / t.hl);
    const intensity = Math.max(0, Math.min(100, decayed));
    if (intensity < MIG_DROP_FLOOR()) continue;   // 已消化·丢弃（防陈年负面原样再注）
    pulses.push({ emotion: t.emotion, intensity, importance: 1, unresolved: false });
  }
  return { pulses, clearScar };
}

