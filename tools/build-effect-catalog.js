// tools/build-effect-catalog.js — 카드 제작용 효과 목록(public/js/effectcatalog.js)을 만든다.
//   node tools/build-effect-catalog.js
//
// 하는 일
//   1) 기존 하수인 카드를 전부 훑어서 "실제로 쓰이고 있는 효과"를 모은다 (그 카드의 값을 템플릿으로 쓴다)
//   2) 효과마다 카드에 적히는 문장을 엔진(effectText)으로 만들어 본다 (undefined·NaN 이 나오면 제외)
//   3) 효과 하나만 가진 시험 카드로 봇 대전을 돌려 오류가 나는 효과는 제외한다
//   4) 카테고리 · 등급(하/중/상/단점) · 숫자 입력칸 · 경고 문구를 붙여 파일로 쓴다
//
// 카드를 새로 추가하거나 효과를 바꾸면 이 스크립트를 다시 돌리면 된다.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const JS = path.join(ROOT, 'public', 'js');
const E = require(path.join(JS, 'engine.js'));
const SRC = fs.readFileSync(path.join(JS, 'engine.js'), 'utf8');

const listConst = n => { const m = SRC.match(new RegExp('const ' + n + '=(\\[[^\\]]*\\])')); return m ? eval(m[1]) : []; };
const NO_TARGET_FX = listConst('NO_TARGET_FX');
const NEG_FLAGS = listConst('NEG_FLAGS');
const TARGETED_BC = (() => {                      // 대상을 고르는 전투의 함성 (cardTargetsRaw 가 다루는 효과)
  const a = SRC.indexOf('function cardTargetsRaw'), b = SRC.indexOf('\nfunction ', a + 10);
  return [...new Set([...SRC.slice(a, b).matchAll(/e\.type==='([a-zA-Z]+)'/g)].map(m => m[1]))];
})();

// ---- 카드에서 효과가 아닌 칸 ----
const BASE = new Set(['type', 'name', 'cost', 'rarity', 'atk', 'hp', 'tribe', 'art', 'flavor', 'scope', 'desc', 'school', 'rc', 'quote', 'runes', 'hunter', 'unlock', 'effect']);
const SKIP = new Set(['eggBonus', 'hatchLeft', 'stealthTemp', 'knightBy', 'infuse', 'echo']);   // 게임 중 상태값 · 전용 장치
// 함께 있어야 동작하는 짝
const COMPANIONS = { endCorpses: ['startSpend'], pteroEgg: ['deathPtero'], freshBuffEnd: ['endSelfHpLoss'], ghostLeech: ['deathFace'] };
const COMPANION_OF = new Set(Object.values(COMPANIONS).flat());

// ---- 키워드 (카드에 태그로 표시되는 것) ----
const KEYWORDS = [
  ['taunt', '도발', '상대는 이 하수인을 먼저 공격해야 해요', 1],
  ['shield', '보호막', '처음 받는 피해 한 번을 막아요', 2],
  ['rush', '속공', '낸 턴에 하수인을 공격할 수 있어요', 1],
  ['charge', '돌진', '낸 턴에 바로 영웅도 공격할 수 있어요', 2],
  ['lifesteal', '생명력 흡수', '준 피해만큼 내 영웅이 회복해요', 2],
  ['stealth', '은신', '공격하기 전까지 대상이 되지 않아요', 1],
  ['windfury', '질풍', '한 턴에 두 번 공격해요', 2],
  ['poison', '독성', '피해를 준 하수인을 처치해요', 2],
  ['revive', '환생', '죽으면 생명력 1로 한 번 되살아나요', 2],
  ['elusive', '모면', '주문·영웅 능력의 대상이 되지 않아요', 1],
];
const KW_KEYS = new Set(KEYWORDS.map(k => k[0]));

// ---- 숫자 입력칸 이름 · 세기에 비례하는 값 ----
const PARAM_LABEL = { value: '수치', count: '마릿수', atk: '공격력', hp: '체력', draw: '뽑기', corpses: '시체', min: '최소 비용', discount: '할인', armor: '방어도', heroAtk: '영웅 공격력', life: '생명력', amount: '수치' };
const SCALES = new Set(['value', 'count', 'atk', 'hp', 'draw', 'armor', 'heroAtk', 'life', 'amount']);

// ---- 경고 (선택은 막지 않는다) ----
const WARN = [
  [/학사모/, '학사모 카드가 있어야 효과가 있어요'],
  [/토템/, '토템 하수인과 함께 써야 효과가 있어요'],
  [/야수/, '야수 하수인과 함께 쓰면 좋아요'],
  [/1학년/, '1학년 하수인과 함께 써야 효과가 있어요'],
  [/거머리/, '거머리 카드와 함께 쓰는 효과예요'],
  [/혈기/, '혈기 카드가 있어야 효과가 있어요'],
  [/트로그/, '깊은무쇠 트로그 전용 효과예요'],
  [/(암흑|신성|화염|냉기|비전|자연|부정|지식) 주문/, '해당 속성의 주문 카드와 함께 쓰면 좋아요'],
  [/주문을 (시전|쓸|낸)|시전한 주문|주문 수/, '주문 카드가 많은 덱에서 효과가 커요'],
  [/시체/, '시체는 내 하수인이 죽을 때마다 1개씩 쌓여요'],
  [/방어도가 \d+ 이상/, '방어도를 얻는 카드와 함께 써야 해요'],
  [/도발 하수인들?을 소환|죽은 내 도발/, '도발 하수인이 많은 덱에서 효과가 커요'],
];
const DYNAMIC = /시전한 주문|주문 수만큼|시체|이번 게임에서|무작위 주문|덱에 없던/;   // 상황에 따라 세기가 크게 달라짐 → 상
const DRAWBACK_KEYS = new Set([...NEG_FLAGS, 'endHeroHurt', 'deathSelfFace', 'startSelfHurt', 'deadlineDmg', 'overload', 'guardAll', 'deathKillAlly', 'deathHandMinion', 'freshScare', 'needArmor']);
const DRAWBACK_TEXT = /공격 불가|공격할 수 없|내 영웅에게 피해|내 영웅 피해|자신에게 피해|과부하|아군 하수인 처치|내 손의 무작위 하수인 제거/;

// ---- 도우미 ----
const clone = x => JSON.parse(JSON.stringify(x));
const dummy = part => ({ type: 'minion', name: '(시험 카드)', cost: 3, rarity: '일반', atk: 2, hp: 2, ...clone(part) });
function textOf(part) {
  try { return String(E.effectText(dummy(part)) || ''); } catch (e) { return null; }
}
const badText = t => t == null || /undefined|NaN|\[object/.test(t);
const vanillaPts = c => Math.max(1, Math.min(6, (c.cost * 2 + 1) - (c.atk + c.hp)));   // 기존 카드가 효과에 쓴 능력치

function paramsOf(obj, prefix) {      // 숫자 칸 → 입력칸
  const out = [];
  for (const [k, v] of Object.entries(obj || {})) {
    if (k === 'type') continue;
    const key = prefix ? prefix + '.' + k : k;
    if (typeof v === 'number' && Number.isFinite(v)) {
      const lo = (k === 'atk' || k === 'hp' || k === 'count' || v >= 1) ? 1 : 0;
      out.push({ key, label: PARAM_LABEL[k] || k, min: lo, max: Math.max(10, v), def: v, scales: SCALES.has(k) });
    } else if (v && typeof v === 'object' && !Array.isArray(v) && !prefix) out.push(...paramsOf(v, key));
  }
  return out;
}

function setPathIn(o, p, v) { const ks = p.split('.'); let x = o; for (let i = 0; i < ks.length - 1; i++) x = x[ks[i]]; x[ks[ks.length - 1]] = v; }

// ---- 봇 대전으로 효과 하나 검사 ----
const CHECK_NAME = '__효과검사__';
function simulate(part, games = 4) {
  const card = { ...dummy(part), name: CHECK_NAME, cost: 2 };
  E.CARD_POOL.push(card);
  let errors = 0, firstErr = null;
  try {
    for (let g = 0; g < games && !errors; g++) {
      const d0 = E.buildRandomDeck(), d1 = E.buildRandomDeck();
      for (let i = 0; i < 6; i++) d0[i] = CHECK_NAME;
      for (let i = 0; i < 2; i++) d1[i] = CHECK_NAME;
      let s = E.newGame(Math.random, { decks: [d0, d1], freeDeck: [true, true] });
      let steps = 0;
      while (!s.over && s.turnNo <= 120 && steps++ < 3000) {
        let r;
        try { r = E.apply(s, E.BotPlayers.rule.decide(E.viewFor(s, s.turn)), s.turn); }
        catch (e) { errors++; firstErr = e.message; break; }
        if (!r.ok) { errors++; firstErr = r.error || 'apply 실패'; break; }
        s = r.state;
      }
    }
  } finally { const i = E.CARD_POOL.indexOf(card); if (i >= 0) E.CARD_POOL.splice(i, 1); }
  return { errors, firstErr };
}

// ---- 모으기 ----
const minions = E.CARD_POOL.filter(c => c.type === 'minion');
minions.sort((a, b) => (a.scope ? 1 : 0) - (b.scope ? 1 : 0));      // 일반 카드를 템플릿으로 먼저 쓴다
const entries = new Map();
const nFeatures = c => Object.keys(c).filter(k => !BASE.has(k) && !SKIP.has(k)).length + (c.effect ? 1 : 0);

for (const c of minions) {
  const feats = Math.max(1, nFeatures(c));
  const pts = Math.max(1, Math.round(vanillaPts(c) / feats));
  if (c.effect && !entries.has('bc:' + c.effect.type)) {
    entries.set('bc:' + c.effect.type, { id: 'bc:' + c.effect.type, kind: 'bc', key: c.effect.type, template: clone(c.effect), from: c.name, pts, targeted: TARGETED_BC.includes(c.effect.type) && !NO_TARGET_FX.includes(c.effect.type) });
  }
  for (const k of Object.keys(c)) {
    if (BASE.has(k) || SKIP.has(k) || KW_KEYS.has(k) || COMPANION_OF.has(k) || entries.has('f:' + k)) continue;
    const parts = { [k]: clone(c[k]) };
    for (const p of (COMPANIONS[k] || [])) if (c[p] !== undefined) parts[p] = clone(c[p]);
    entries.set('f:' + k, { id: 'f:' + k, kind: 'flag', key: k, template: parts, from: c.name, pts });
  }
}

// ---- 문장 · 검사 · 분류 ----
const out = [], dropped = [];
for (const en of entries.values()) {
  const part = en.kind === 'bc' ? { effect: en.template } : en.template;
  const text = textOf(part);
  if (badText(text) || !text.trim()) { dropped.push([en.id, '문장 없음/오류: ' + text]); continue; }
  if (process.env.TRACE) process.stderr.write(en.id + ' ');
  const sim = simulate(part);
  if (sim.errors) { dropped.push([en.id, '대전 오류: ' + sim.firstErr]); continue; }

  const params = en.kind === 'bc' ? paramsOf(en.template) : Object.entries(en.template).flatMap(([k, v]) =>
    typeof v === 'number' ? [{ key: k, label: PARAM_LABEL[k] || '수치', min: v >= 1 ? 1 : 0, max: Math.max(10, v), def: v, scales: true }]
      : (v && typeof v === 'object' && !Array.isArray(v)) ? paramsOf(v, k) : []);

  // 문장 속 숫자 위치: 값을 특이한 숫자(9101, 9138 …)로 바꿔 문장을 만들고, 그 숫자가 나온 자리를 {{입력칸}} 으로 바꾼다
  let tpl = null;
  if (params.length) {
    const p2 = clone(part), sent = {};
    params.forEach((p, i) => { sent[p.key] = 9101 + i * 37; setPathIn(en.kind === 'bc' ? p2.effect : p2, p.key, sent[p.key]); });
    const t2 = textOf(p2);
    if (!badText(t2)) {
      let t = t2, found = 0;
      for (const p of params) { const v = String(sent[p.key]); if (t.includes(v)) { t = t.split(v).join('{{' + p.key + '}}'); p.inline = true; found++; } }
      if (found && !/9\d{3}/.test(t)) tpl = t; else for (const p of params) delete p.inline;   // 계산된 숫자가 섞여 있으면 문장 속 입력칸은 쓰지 않는다
    }
  }
  const drawback = en.kind === 'flag' && (Object.keys(en.template).some(k => DRAWBACK_KEYS.has(k)) || DRAWBACK_TEXT.test(text)) && !/전투의 함성/.test(text);
  let category;
  if (en.kind === 'bc') category = 'battlecry';
  else if (drawback) category = 'drawback';
  else if (/^죽음의 메아리|죽음의 메아리:/.test(text)) category = 'deathrattle';
  else if (/턴이 끝날 때|턴이 시작될 때|턴 종료|턴 시작|매 턴/.test(text)) category = 'turn';
  else if (/할 때마다|한 후에|된 후에|받은 후|입을 때마다|받을 때마다|처치하면|처치한 후|소환될 때마다|소환된 후|공격할 때/.test(text)) category = 'reaction';
  else category = 'aura';

  const dynamic = DYNAMIC.test(text);
  const warns = WARN.filter(([re]) => re.test(text)).map(([, w]) => w);
  out.push({
    id: en.id, kind: en.kind, key: en.key, category, from: en.from,
    template: en.template, params, text, tpl,
    pts: drawback ? -1 : dynamic ? Math.max(4, en.pts) : en.pts,
    fixedTier: drawback ? 'drawback' : dynamic ? 'high' : null,
    targeted: !!en.targeted, warns,
  });
}

const kw = KEYWORDS.map(([key, label, help, pts]) => ({ id: 'kw:' + key, kind: 'kw', key, category: 'keyword', text: label, help, pts, params: [], warns: [], fixedTier: pts >= 2 ? 'mid' : 'low' }));
const all = [...kw, ...out];

const CATEGORIES = [
  ['keyword', '키워드'], ['battlecry', '전투의 함성'], ['deathrattle', '죽음의 메아리'],
  ['turn', '턴 시작·종료'], ['reaction', '반응'], ['aura', '상시'], ['drawback', '단점'],
];
const counts = Object.fromEntries(CATEGORIES.map(([k]) => [k, all.filter(e => e.category === k).length]));

const file = `// effectcatalog.js — 카드 제작용 효과 목록 (브라우저·서버 공용)
// ⚠ 자동 생성 파일: tools/build-effect-catalog.js 로 다시 만든다. 직접 고치지 말 것.
//   기존 카드에서 실제로 쓰이는 효과만 모았고, 효과마다 봇 대전 ${4}판으로 오류가 없는지 검사했다.
//   생성: ${new Date().toISOString()} · 효과 ${all.length}개 (제외 ${dropped.length}개)
(function (root) {
  const EFFECT_CATEGORIES = ${JSON.stringify(CATEGORIES)};
  const EFFECT_CATALOG = ${JSON.stringify(all, null, 0).replace(/\},\{"id"/g, '},\n  {"id"')};
  const api = { EFFECT_CATEGORIES, EFFECT_CATALOG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;
fs.writeFileSync(path.join(JS, 'effectcatalog.js'), file);
console.log('효과', all.length, '개', counts);
console.log('제외', dropped.length, '개');
for (const [id, why] of dropped) console.log('  -', id, why.slice(0, 120));
