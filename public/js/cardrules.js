// cardrules.js — 직접 만든 카드의 규칙 (브라우저·서버 공용)
//   · 예산: 공격력 + 체력 + 효과 비용 ≤ 코스트 × 3
//   · 효과 비용: 하 1 · 중 2 · 상 3 · 단점 -1(예산이 1 늘어남). 숫자가 큰 효과는 등급이 올라간다
//   · 이름 검사: 길이 · 글자 · 비속어 · 중복
//   · buildCard(): 고른 효과로 실제 게임 카드 데이터와 카드 문장을 만든다 (서버가 같은 함수로 다시 검사한다)
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const CAT = isNode ? require('./effectcatalog.js') : root;
  const effectTextFn = () => (isNode ? require('./engine.js').effectText : root.effectText);
  // 브라우저의 CARD_POOL 은 cards.js 의 const 라서 window 속성이 아니다 → 이름으로 직접 읽는다
  const poolFn = () => (isNode ? require('./engine.js').CARD_POOL : (typeof CARD_POOL !== 'undefined' ? CARD_POOL : []));

  const CUSTOM = {
    GOLD_COST: 100,          // 카드 한 장 만드는 데 드는 골드
    EDIT_GOLD: 10,           // 만듦·반려 카드를 고치는 데 드는 골드 (이름은 고정)
    MAX_PER_USER: null,      // 한 사람이 만들 수 있는 카드 수 (null = 제한 없음)
    BUDGET_PER_COST: 3,      // 예산 = 코스트 × 3
    MIN_BUDGET: 2,           // 0코스트 카드도 0/1 + 효과 하나 정도는 가능하게
    MAX_STAT: 12,
    GIVE_COPIES: 2,          // 만든 사람에게 주는 장수 (덱 한도)
    SUMMON_DEPTH: 3,         // 소환수가 또 소환수를 부르는 깊이 (카드 → 소환수 → 소환수 → 소환수)
    SUMMON_MAX: 7,           // 한 번에 소환하는 최대 마릿수 (전장 칸 수)
    MAX_IMAGES: 8,           // 카드 그림 + 소환수 그림 합계
  };
  const TIER_NAME = { 1: '하', 2: '중', 3: '상', '-1': '단점' };
  const BY_ID = new Map(CAT.EFFECT_CATALOG.map(e => [e.id, e]));

  // ---------- 이름 ----------
  const BANNED = ['시발', '씨발', '씨빨', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '븅신', '좆', '존나', 'ㅈㄴ', '개새', '새끼', 'ㅅㄲ', '미친놈', '미친년', '닥쳐', '꺼져',
    '애미', '애비', '느금', '니미', '엠창', '창녀', '걸레', '보지', '자지', '섹스', '야동', '한남', '김치녀', '틀딱', '장애인새', '찐따',
    'fuck', 'shit', 'bitch', 'damn', 'sex', 'porn', 'nigger', 'nigga', 'asshole', 'dick', 'pussy'];
  function nameProblem(name, extraTaken, allowName) {   // allowName: 고치는 중인 내 카드 이름 (중복 검사에서 뺀다)
    const n = String(name == null ? '' : name).trim();
    if (n.length < 2 || n.length > 12) return '이름은 2~12자로 지어 주세요';
    if (!/^[가-힣a-zA-Z0-9 ]+$/.test(n)) return '이름에는 한글·영문·숫자·띄어쓰기만 쓸 수 있어요';
    if (/\s{2,}/.test(n)) return '띄어쓰기는 한 칸만 쓸 수 있어요';
    const flat = n.toLowerCase().replace(/[^가-힣ㄱ-ㅎa-z0-9]/g, '');
    if (BANNED.some(w => flat.includes(w))) return '사용할 수 없는 단어가 들어 있어요';
    if (n !== allowName && (poolFn().some(c => c.name === n) || (extraTaken && extraTaken(n)))) return '이미 있는 카드 이름이에요';
    return null;
  }

  // ---------- 효과 비용 ----------
  const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  function setPath(o, p, v) { const ks = p.split('.'); let x = o; for (let i = 0; i < ks.length - 1; i++) x = x[ks[i]]; x[ks[ks.length - 1]] = v; }
  const clone = x => JSON.parse(JSON.stringify(x));

  function cleanParams(entry, params) {           // 입력칸 범위 안의 정수로
    const out = {};
    for (const p of entry.params || []) {
      let v = params && params[p.key] !== undefined ? Number(params[p.key]) : p.def;
      if (!Number.isFinite(v)) v = p.def;
      out[p.key] = Math.max(p.min, Math.min(p.max, Math.round(v)));
    }
    return out;
  }
  function tierOf(entry, params) {                // → 1 | 2 | 3 | -1
    if (entry.fixedTier === 'drawback') return -1;
    if (entry.kind === 'kw') return entry.pts >= 2 ? 2 : 1;
    const P = cleanParams(entry, params);
    let ratio = 1, stat = [], others = [];
    for (const p of entry.params || []) {
      if (!p.scales) continue;
      const r = (P[p.key] || 0) / (p.def || 1);
      if (/count$/.test(p.key)) ratio *= r; else if (/(^|\.)(atk|hp)$/.test(p.key)) stat.push(r); else others.push(r);
    }
    const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
    if (stat.length) ratio *= mean(stat);
    if (others.length) ratio *= mean(others);
    const pts = Math.round(entry.pts * ratio);
    let t = pts <= 1 ? 1 : pts <= 3 ? 2 : 3;
    if (entry.fixedTier === 'high') t = 3;
    return t;
  }
  function costOf(entry, params) {                // 예산에서 빠지는 값 (단점은 -1 → 예산이 늘어남)
    const t = tierOf(entry, params);
    if (t < 0) return -1;
    const P = cleanParams(entry, params), cnt = P.count, a = P.atk, h = P.hp;
    if (Number.isFinite(cnt) && Number.isFinite(a) && Number.isFinite(h)) return Math.max(t, Math.ceil(cnt * (a + h) / 2));   // 소환 효과: 마릿수 × (공+체) ÷ 2
    return t;
  }

  // ---------- 효과 → 카드 데이터 ----------
  function partOf(entry, params) {                // 이 효과가 카드에 더하는 칸들
    const P = cleanParams(entry, params);
    if (entry.kind === 'kw') return { [entry.key]: true };
    const base = clone(entry.kind === 'bc' ? { effect: entry.template } : entry.template);
    for (const [k, v] of Object.entries(P)) setPath(entry.kind === 'bc' ? base.effect : base, k, v);
    return base;
  }
  function textOf(entry, params) {                // 이 효과 하나의 카드 문장
    if (entry.kind === 'kw') return entry.text;
    try { return String(effectTextFn()({ type: 'minion', name: '(미리보기)', cost: 3, atk: 2, hp: 2, ...partOf(entry, params) }) || entry.text); }
    catch (_) { return entry.text; }
  }

  // ---------- 소환수 디자인 ----------
  //   selection: {id:'sum:bc'|'sum:death'|'sum:end', params:{count}, token:{name, atk, hp, kw:[키워드], art, summons:[{when:'death'|'end', count, token}]}}
  //   비용 = 마릿수 × (공 + 체 + 키워드 비용 + 소환수가 다시 부르는 소환 비용) ÷ 2   (턴 종료 소환은 매 턴 반복되므로 ×2)
  const SUMMON_WHEN = { bc: '전투의 함성', death: '죽음의 메아리', end: '내 턴이 끝날 때' };
  const SUMMON_ENTRIES = [
    { id: 'sum:bc', kind: 'summon', when: 'bc', category: 'battlecry', text: '전투의 함성: 직접 디자인한 하수인 소환', help: '이름·공격력·체력·키워드·그림을 정한 소환수를 불러와요', pts: 0, params: [], warns: [] },
    { id: 'sum:death', kind: 'summon', when: 'death', category: 'deathrattle', text: '죽음의 메아리: 직접 디자인한 하수인 소환', help: '죽으면 내가 디자인한 소환수가 나와요', pts: 0, params: [], warns: [] },
    { id: 'sum:end', kind: 'summon', when: 'end', category: 'turn', text: '내 턴이 끝날 때: 직접 디자인한 하수인 소환', help: '매 턴 끝에 소환해요 (예산 2배)', pts: 0, params: [], warns: [] },
  ];
  const KW_ENTRIES = CAT.EFFECT_CATALOG.filter(e => e.kind === 'kw');
  const KW_LABEL = Object.fromEntries(KW_ENTRIES.map(e => [e.key, e.text]));
  const kwCost = k => { const e = KW_ENTRIES.find(x => x.key === k); return e ? (e.pts >= 2 ? 2 : 1) : 0; };
  const okArt = a => typeof a === 'string' && (/^data:image\/(png|jpeg|webp);base64,/.test(a) || /^\/api\/customcards\/[\w/-]+$/.test(a) || /^pending:\d+$/.test(a));

  // 소환수 정리 + 문제 찾기. depth: 1 = 카드가 부르는 소환수
  function cleanToken(t, depth, problems, opts) {
    t = t || {};
    const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
    const name = String(t.name == null ? '' : t.name).trim();
    const np = name ? nameProblem(name) : '소환수 이름을 지어 주세요';
    if (np && !(opts && opts.skipName)) problems.push(`소환수 「${name || '?'}」: ${np}`);
    const out = { name, atk: int(t.atk, 0, CUSTOM.MAX_STAT, 1), hp: int(t.hp, 1, CUSTOM.MAX_STAT, 1), kw: [...new Set((t.kw || []).filter(k => KW_LABEL[k]))], summons: [] };
    if (okArt(t.art)) out.art = t.art;
    for (const c of Array.isArray(t.summons) ? t.summons : []) {
      if (depth >= CUSTOM.SUMMON_DEPTH) { problems.push(`소환수가 소환수를 부르는 건 ${CUSTOM.SUMMON_DEPTH}단계까지예요`); break; }
      if (c.when !== 'death' && c.when !== 'end') continue;   // 소환수는 손에서 내는 카드가 아니라서 전투의 함성이 없다
      out.summons.push({ when: c.when, count: int(c.count, 1, CUSTOM.SUMMON_MAX, 1), token: cleanToken(c.token, depth + 1, problems, opts) });
    }
    if (out.summons.length > 2) { problems.push('소환수 하나에 소환 효과는 2개까지예요'); out.summons = out.summons.slice(0, 2); }
    return out;
  }
  const tokenValue = t => t.atk + t.hp + t.kw.reduce((s, k) => s + kwCost(k), 0) + t.summons.reduce((s, c) => s + summonCost(c), 0);
  const summonCost = c => Math.max(1, Math.ceil(c.count * tokenValue(c.token) / 2)) * (c.when === 'end' ? 2 : 1);
  const tokenDesc = t => `${t.name || '소환수'}(${t.atk}/${t.hp}${t.kw.length ? ' ' + t.kw.map(k => KW_LABEL[k]).join('·') : ''})`;
  const summonText = c => (c.when === 'end' ? '내 턴이 끝날 때, ' : SUMMON_WHEN[c.when] + ': ') + `${tokenDesc(c.token)}을(를) ${c.count}마리 소환합니다`;
  function joinTexts(texts) {                     // 같은 머리말(전투의 함성 · 죽음의 메아리)은 하나로 묶는다
    const groups = new Map(), plain = [];
    for (const t0 of texts) {
      const t = t0.replace(/[.。]\s*$/, ''), m = /^(전투의 함성|죽음의 메아리): (.*)$/.exec(t);
      if (m && !/\. /.test(m[2])) { if (!groups.has(m[1])) groups.set(m[1], []); groups.get(m[1]).push(m[2]); } else plain.push(t);
    }
    const order = ['전투의 함성', '죽음의 메아리'].filter(h => groups.has(h));   // 함성 → 죽메 → 나머지 순서
    return [...order.map(h => `${h}: ${groups.get(h).join(', ')}`), ...plain].join('. ');
  }
  function tokenData(t) {                         // 엔진이 쓰는 소환수 모양
    const d = { name: t.name, atk: t.atk, hp: t.hp };
    for (const k of t.kw) d[k] = true;
    if (t.art) d.art = t.art;
    if (t.summons.length) { d.csum = t.summons.map(c => ({ when: c.when, count: c.count, token: tokenData(c.token) })); d.customText = joinTexts(t.summons.map(summonText)); }
    return d;
  }
  function countImages(t) { return (t.art ? 1 : 0) + t.summons.reduce((s, c) => s + countImages(c.token), 0); }

  // input: {name, cost, atk, hp, selections:[{id, params}]}
  // 반환: {ok, card, budget:{limit, used, over}, lines:[{id, text, tier, cost, warns}], warns, problems:[...]}
  function buildCard(input, opts) {
    opts = opts || {};
    const problems = [];
    const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
    const cost = int(input.cost, 0, 10, 1), atk = int(input.atk, 0, CUSTOM.MAX_STAT, 1), hp = int(input.hp, 1, CUSTOM.MAX_STAT, 1);
    const name = String(input.name == null ? '' : input.name).trim();
    if (!opts.skipName) { const np = nameProblem(name, opts.nameTaken, opts.allowName); if (np) problems.push(np); }

    const seen = new Set(), lines = [];
    const summons = [];
    for (const s of Array.isArray(input.selections) ? input.selections : []) {
      const se = s && SUMMON_ENTRIES.find(x => x.id === s.id);
      if (se) {
        if (summons.some(c => c.when === se.when)) continue;
        const cnt = Math.max(1, Math.min(CUSTOM.SUMMON_MAX, Math.round(Number(s.params && s.params.count)) || 1));
        const c = { when: se.when, count: cnt, token: cleanToken(s.token, 1, problems, opts) };
        summons.push(c);
        const cost = summonCost(c);
        lines.push({ id: se.id, entry: se, params: { count: cnt }, token: c.token, text: summonText(c), tier: cost <= 1 ? 1 : cost <= 3 ? 2 : 3, cost, warns: [] });
        continue;
      }
      const e = s && BY_ID.get(s.id);
      if (!e) { problems.push('없는 효과가 있어요'); continue; }
      if (seen.has(e.id)) continue; seen.add(e.id);
      const params = cleanParams(e, s.params);
      lines.push({ id: e.id, entry: e, params, text: textOf(e, params), tier: tierOf(e, params), cost: costOf(e, params), warns: e.warns || [] });
    }
    if (lines.length > 12) problems.push('효과는 12개까지 고를 수 있어요');

    const limit = Math.max(CUSTOM.MIN_BUDGET, cost * CUSTOM.BUDGET_PER_COST);
    const used = atk + hp + lines.reduce((s, l) => s + l.cost, 0);
    const budget = { limit, used, over: used > limit };
    if (budget.over) problems.push(`예산을 ${used - limit} 넘었어요`);

    // 카드 데이터
    const card = { type: 'minion', name, cost, atk, hp, custom: true };
    if (summons.length) card.csum = summons.map(c => ({ when: c.when, count: c.count, token: tokenData(c.token) }));
    if (okArt(input.art)) card.art = input.art;
    const nImg = (card.art ? 1 : 0) + summons.reduce((s, c) => s + countImages(c.token), 0);
    if (nImg > CUSTOM.MAX_IMAGES) problems.push(`그림은 카드와 소환수를 합쳐 ${CUSTOM.MAX_IMAGES}장까지예요`);
    const bcs = lines.filter(l => l.entry.kind === 'bc');
    for (const l of lines) if (l.entry.kind !== 'bc' && l.entry.kind !== 'summon') Object.assign(card, partOf(l.entry, l.params));
    if (bcs.length) {
      const first = bcs.find(l => l.entry.targeted) || bcs[0];          // 대상을 고르는 함성이 있으면 그것을 직접 고르게 한다
      card.effect = partOf(first.entry, first.params).effect;
      const rest = bcs.filter(l => l !== first).map(l => partOf(l.entry, l.params).effect);
      if (rest.length) card.bcExtra = rest;                           // 나머지 함성: 대상이 필요하면 무작위
    }
    // 카드 문장: 같은 머리말(전투의 함성 · 죽음의 메아리)은 하나로 묶는다 — 함성은 실제로 발동하는 순서(직접 고르는 것 먼저)
    const firstBc = bcs.length ? (bcs.find(l => l.entry.targeted) || bcs[0]) : null;
    const ordered = [...(firstBc ? [firstBc] : []), ...lines.filter(l => l !== firstBc)];
    const txt = joinTexts(ordered.filter(l => l.entry.kind !== 'kw').map(l => l.text));
    if (txt) card.customText = txt;
    const effPts = lines.reduce((s, l) => s + Math.max(0, l.cost), 0);
    card.rarity = effPts >= 8 ? '전설' : effPts >= 5 ? '특급' : effPts >= 2 ? '희귀' : '일반';

    const warns = [...new Set(lines.flatMap(l => l.warns))];
    if (bcs.filter(l => l.entry.targeted).length > 1) warns.push('대상을 고르는 전투의 함성이 여러 개예요. 첫 번째만 직접 고르고 나머지는 무작위 대상이에요');
    return { ok: !problems.length, card, budget, lines: lines.map(({ entry, ...l }) => l), warns, problems: [...new Set(problems)] };
  }

  const api = { CUSTOM, TIER_NAME, SUMMON_ENTRIES, KW_LABEL, nameProblem, tierOf, costOf, partOf, textOf, buildCard, cleanParams, cleanToken, summonCost, tokenDesc };
  if (isNode) module.exports = api;
  else root.CardRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
