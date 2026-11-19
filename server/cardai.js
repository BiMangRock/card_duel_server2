// cardai.js — 유저 카드 제안 (GitHub PR 방식). 시연용.
//   유저가 카드 아이디어(이름·코스트·공/체·효과 문장·그림)를 낸다
//   → Gemini 가 게임 카드 데이터(필요하면 새 효과 코드까지)로 바꾼다
//   → 서버가 형식을 검사하고, 봇 대전으로 자동 점검한다
//   → 개발자(is_admin)가 보고 승인·반려한다. 승인된 카드는 data/approved-cards.json 에 쌓인다.
//
//   환경변수
//     GEMINI_API_KEY   Google AI Studio 키 (코드에 적지 말 것)
//     GEMINI_MODEL     모델 이름 (기본 gemini-2.5-flash — 404 가 나면 AI Studio 에서 쓸 수 있는 이름으로 바꾼다)
//     CARDAI_MOCK=1    키 없이 시연: 미리 만든 답을 돌려준다 (API 가 막혔을 때 비상용)
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('./db');
const { requireAuth, requireAdmin } = require('./auth');
const JS = path.join(__dirname, '..', 'public', 'js');
const E = require(path.join(JS, 'engine.js'));

const DATA_DIR = path.join(__dirname, '..', 'data');
const APPROVED_FILE = path.join(DATA_DIR, 'approved-cards.json');

db.exec(`
CREATE TABLE IF NOT EXISTS card_proposals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'pending',      -- pending | approved | rejected
  mode        TEXT    NOT NULL,                        -- data(기존 효과 조합) | new_effect(새 효과 코드 필요)
  input_json  TEXT    NOT NULL,                        -- 유저가 낸 원본
  card_json   TEXT    NOT NULL,                        -- 검사를 통과한 카드 데이터
  effect_json TEXT,                                    -- new_effect 일 때 {type, code, text}
  check_json  TEXT,                                    -- 자동 점검 결과
  flags_json  TEXT    NOT NULL DEFAULT '[]',           -- 경고 목록
  image       TEXT,                                    -- 유저가 올린 그림 (작게 줄인 data URL)
  note        TEXT,                                    -- 개발자 메모(반려 사유 등)
  reviewed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_card_proposals_user ON card_proposals(user_id, id);
`);

// ---------- 프롬프트 ----------
const KNOWN_EFFECTS = new Set(E.CARD_POOL.map(c => c.effect && c.effect.type).filter(Boolean));
const KEYWORDS = ['taunt', 'shield', 'charge', 'rush', 'elusive', 'lifesteal', 'stealth', 'windfury'];
const RARITIES = ['일반', '희귀', '특급', '전설'];

function effectCatalog() {                       // "효과 이름: 카드에 적히는 설명" 목록 (AI 에게 보여 줄 기존 효과)
  const lines = [];
  for (const t of KNOWN_EFFECTS) {
    const fn = E.EFFECT_TEXT && E.EFFECT_TEXT[t];
    let txt = '';
    try { txt = typeof fn === 'function' ? String(fn(2, { value: 2, draw: 1, corpses: 1, count: 1 })) : ''; } catch (_) { txt = ''; }
    lines.push(`- ${t}${txt ? ': ' + txt.slice(0, 80) : ''}`);
  }
  return lines.slice(0, 140).join('\n');
}

function buildPrompt(input) {
  return `너는 카드 게임 "카드 결투"의 카드 디자이너 겸 엔진 개발자다. 유저가 낸 카드 아이디어를 게임 데이터로 바꿔라.

[카드 데이터 형식 — 예시]
{"type":"minion","name":"책벌레","cost":1,"rarity":"일반","atk":1,"hp":1,"effect":{"type":"draw","value":1}}
{"type":"minion","name":"돌담 견습병","cost":1,"rarity":"일반","atk":1,"hp":3,"taunt":true}
{"type":"spell","name":"학사 경고","cost":3,"rarity":"특급","effect":{"type":"damage","value":4}}
- type 은 minion(하수인) 또는 spell(주문). 하수인만 atk, hp 가 있다. 주문에는 atk, hp 를 쓰지 않는다.
- 키워드(true 만 씀): ${KEYWORDS.join(', ')}
- rarity: ${RARITIES.join(', ')}
- 밸런스 기준: 하수인은 atk+hp 가 대략 코스트×2 이하. 효과가 강할수록 스탯을 깎는다. 코스트 0~10, atk 0~12, hp 1~12.

[이미 있는 효과 — 가능하면 이 중에서 고른다 (mode:"data")]
${effectCatalog()}

[없는 효과가 필요할 때 (mode:"new_effect")]
effect.type 에 새 이름(영문 camelCase, 위 목록에 없는 것)을 쓰고, 엔진에 넣을 코드 조각 engineCode 와 카드에 적힐 문장 effectText 를 만든다.
engineCode 규칙:
- engine.js 의 효과 처리 함수 안에 들어가는 \`if(e.type==='새이름'){ ... return; }\` 블록 하나만 쓴다.
- 쓸 수 있는 값: s(게임 상태), seat(내 좌석 0/1), other(seat)(상대 좌석), e(효과: e.value), ev(이벤트 배열), src(출처), nextRand(s)(난수. Math.random 금지), drawCards(s, seat, n, ev, src), shuffle(배열, ()=>nextRand(s)).
- 내 영역: s.seats[seat].deck / .hand / .board / .hp / .armor, 상대는 s.seats[other(seat)].
- 마지막에 ev.push({type:'새이름', seat, src}); return; 으로 끝낸다.
- 외부 접근(require, fetch, process, fs, eval, Function, import), 무한 루프, 시간 함수는 절대 쓰지 않는다.
예시 (기존 효과 seedDeck):
if(e.type==='seedDeck'){
  const P=s.seats[seat], pool=spellPool({});
  for(let i=0;i<e.value;i++){ const x=pool[Math.floor(nextRand(s)*pool.length)]; P.deck.push({...x, id:s.nextId++}); }
  shuffle(P.deck, ()=>nextRand(s));
  ev.push({type:'deckAdd', seat, count:e.value, src}); return;
}

[출력] 아래 JSON 한 개만 출력한다 (설명 문장, 마크다운 금지).
{"mode":"data"|"new_effect","card":{...카드 데이터...},"newEffect":null 또는 {"type":"새이름","engineCode":"...","effectText":"전투의 함성: ..."},"reason":"이렇게 만든 이유와 밸런스 판단 (한국어 2문장 이내)"}

[유저가 낸 아이디어]
이름: ${input.name}
종류: ${input.type === 'spell' ? '주문' : '하수인'}
코스트: ${input.cost}
공격력/체력: ${input.type === 'spell' ? '없음' : input.atk + '/' + input.hp}
효과 설명: ${input.text}`;
}

// ---------- Gemini 호출 ----------
function mockAnswer(input) {
  const t = input.text;
  if (/덱/.test(t) && /(바꾼|바꿉|바꿔|교환|swap)/i.test(t)) {
    return {
      mode: 'new_effect',
      card: { type: input.type, name: input.name, cost: input.cost, rarity: '전설', ...(input.type === 'minion' ? { atk: input.atk, hp: input.hp } : {}), effect: { type: 'swapDecks', value: 1 } },
      newEffect: {
        type: 'swapDecks',
        engineCode: "if(e.type==='swapDecks'){\n  const A=s.seats[seat], B=s.seats[other(seat)];\n  const tmp=A.deck; A.deck=B.deck; B.deck=tmp;\n  ev.push({type:'deckSwap', seat, src}); return;\n}",
        effectText: '전투의 함성: 두 플레이어의 덱을 서로 바꿉니다',
      },
      reason: '기존 효과에 덱 교환이 없어 새 효과가 필요합니다. 덱이 통째로 바뀌므로 코스트를 높게 잡았습니다. (모의 답변)',
    };
  }
  return {
    mode: 'data',
    card: { type: input.type, name: input.name, cost: input.cost, rarity: '희귀', ...(input.type === 'minion' ? { atk: input.atk, hp: input.hp } : {}), effect: { type: input.type === 'spell' ? 'damage' : 'draw', value: input.type === 'spell' ? 3 : 1 } },
    newEffect: null,
    reason: '기존 효과(카드 뽑기/피해)로 표현할 수 있어 데이터만 만들었습니다. (모의 답변)',
  };
}

async function callGemini(input) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    if (process.env.CARDAI_MOCK === '1') return mockAnswer(input);
    const e = new Error('서버에 GEMINI_API_KEY 가 없어요. (키 없이 시연하려면 CARDAI_MOCK=1)'); e.status = 503; throw e;
  }
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
    }),
    signal: AbortSignal.timeout(60000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(`Gemini 오류 ${r.status}: ${(d.error && d.error.message) || '응답 없음'}`.slice(0, 300));
    e.status = r.status === 429 ? 429 : 502; throw e;
  }
  const text = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts
    ? d.candidates[0].content.parts.map(p => p.text || '').join('') : '';
  return parseJson(text);
}

function parseJson(text) {
  const clean = String(text || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(clean); } catch (_) {
    const e = new Error('AI 답을 JSON 으로 읽지 못했어요. 다시 시도해 주세요.'); e.status = 502; throw e;
  }
}

// ---------- 입력·결과 검사 ----------
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

function cleanInput(b) {
  b = b || {};
  const type = b.type === 'spell' ? 'spell' : 'minion';
  const name = String(b.name || '').replace(/[\u0000-\u001f"'\\<>]/g, '').trim();
  const text = String(b.text || '').replace(/[\u0000-\u001f]/g, ' ').trim();
  const cost = Number(b.cost), atk = Number(b.atk), hp = Number(b.hp);
  if (!name || name.length > 20) return { error: '카드 이름은 1~20자로 써 주세요.' };
  if (E.CARD_POOL.some(c => c.name === name)) return { error: '이미 있는 카드 이름이에요.' };
  if (!int(cost, 0, 10)) return { error: '코스트는 0~10 사이 정수예요.' };
  if (type === 'minion' && (!int(atk, 0, 12) || !int(hp, 1, 12))) return { error: '공격력은 0~12, 체력은 1~12 사이 정수예요.' };
  if (text.length < 2 || text.length > 200) return { error: '효과 설명은 2~200자로 써 주세요.' };
  let image = null;
  if (b.image) {
    if (typeof b.image !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(b.image) || b.image.length > 300000) return { error: '그림은 작은 png/jpg/webp 한 장만 올릴 수 있어요.' };
    image = b.image;
  }
  return { input: { type, name, cost, atk: type === 'minion' ? atk : undefined, hp: type === 'minion' ? hp : undefined, text }, image };
}

const DANGEROUS = /\b(require|process|fs|eval|Function|import|fetch|child_process|globalThis|window|document|Date|setTimeout|setInterval|while\s*\(\s*(true|1)\s*\)|for\s*\(\s*;\s*;\s*\))\b|Math\.random/;

function checkAnswer(ans, input) {
  const flags = [];
  if (!ans || typeof ans !== 'object' || !ans.card) return { error: 'AI 답에 카드 정보가 없어요.' };
  const mode = ans.mode === 'new_effect' ? 'new_effect' : 'data';
  const c = ans.card;
  const card = { type: input.type, name: input.name, cost: input.cost, rarity: RARITIES.includes(c.rarity) ? c.rarity : '희귀' };   // 이름·코스트·종류는 유저가 낸 값을 그대로 쓴다
  if (input.type === 'minion') { card.atk = input.atk; card.hp = input.hp; }
  for (const k of KEYWORDS) if (c[k] === true) card[k] = true;
  if (!c.effect || typeof c.effect.type !== 'string') return { error: 'AI 답에 효과가 없어요.' };
  const value = Number.isFinite(Number(c.effect.value)) ? Math.max(0, Math.min(10, Number(c.effect.value))) : 1;
  let newEffect = null;
  if (mode === 'data') {
    if (!KNOWN_EFFECTS.has(c.effect.type)) return { error: `엔진에 없는 효과(${String(c.effect.type).slice(0, 30)})를 골랐어요. 다시 시도해 주세요.` };
    card.effect = { type: c.effect.type, value };
  } else {
    const ne = ans.newEffect;
    if (!ne || !/^[a-z][A-Za-z0-9]{2,30}$/.test(String(ne.type)) || KNOWN_EFFECTS.has(ne.type)) return { error: '새 효과 이름이 올바르지 않거나 이미 있는 이름이에요.' };
    const code = String(ne.engineCode || '');
    if (!code.includes(`e.type==='${ne.type}'`) || code.length > 3000) return { error: '새 효과 코드 형식이 올바르지 않아요.' };
    if (DANGEROUS.test(code)) flags.push('⚠ 위험한 코드 패턴이 들어 있어요 (require/fetch/Math.random 등). 반려 권장');
    flags.push('새 효과 코드 — 개발자가 코드를 직접 검토해야 해요');
    card.effect = { type: ne.type, value };
    newEffect = { type: ne.type, code, text: String(ne.effectText || '').slice(0, 120) };
  }
  if (card.type === 'minion' && card.atk + card.hp > card.cost * 2 + 2) flags.push(`스탯이 높아요 (공+체 ${card.atk + card.hp} > 코스트×2+2 = ${card.cost * 2 + 2})`);
  return { mode, card, newEffect, flags, reason: String(ans.reason || '').slice(0, 300) };
}

// ---------- 자동 점검: 봇 대전 (기존 효과 카드만) ----------
function autoCheck(card, games = 8) {
  const pool = E.CARD_POOL, res = { games, errors: 0, stalled: 0, wins: 0, avgTurns: 0, ms: 0 };
  const t0 = Date.now(); let turns = 0;
  pool.push(card);                                              // 점검하는 동안만 카드 풀에 넣는다
  try {
    for (let g = 0; g < games; g++) {
      const d0 = E.buildRandomDeck(), d1 = E.buildRandomDeck();
      d0[0] = card.name; d0[1] = card.name;                      // 내 덱에 이 카드 2장
      let s = E.newGame(Math.random, { decks: [d0, d1], freeDeck: [true, true] });
      while (!s.over && s.turnNo <= 200) {
        const bot = E.BotPlayers.rule;
        let r;
        try { r = E.apply(s, bot.decide(E.viewFor(s, s.turn)), s.turn); } catch (e) { res.errors++; break; }
        if (!r.ok) { res.errors++; break; }
        s = r.state;
      }
      turns += s.turnNo;
      if (s.over) { if (s.winner === 0) res.wins++; } else if (!res.errors) res.stalled++;
    }
  } finally {
    const i = pool.indexOf(card); if (i >= 0) pool.splice(i, 1);
  }
  res.avgTurns = +(turns / games).toFixed(1); res.ms = Date.now() - t0;
  res.verdict = res.errors || res.stalled ? '문제 있음' : (res.wins / games > 0.9 ? '너무 강함?' : res.wins / games < 0.1 ? '너무 약함?' : '이상 없음');
  return res;
}

// ---------- 라우터 ----------
const router = express.Router();
const hits = new Map();
const rateOk = uid => { const t = Date.now(), a = (hits.get(uid) || []).filter(x => t - x < 60000); if (a.length >= 6) return false; a.push(t); hits.set(uid, a); return true; };
const rowOut = r => ({
  id: r.id, createdAt: r.created_at, status: r.status, mode: r.mode, by: r.username || undefined,
  input: JSON.parse(r.input_json), card: JSON.parse(r.card_json), effect: r.effect_json ? JSON.parse(r.effect_json) : null,
  check: r.check_json ? JSON.parse(r.check_json) : null, flags: JSON.parse(r.flags_json), image: r.image || null, note: r.note || null,
});

router.post('/cardai/draft', requireAuth, async (req, res, next) => {
  try {
    if (!rateOk(req.user.id)) return res.status(429).json({ error: '요청이 너무 빨라요. 잠시 뒤 다시 해 주세요.' });
    const ci = cleanInput(req.body);
    if (ci.error) return res.status(400).json({ error: ci.error });
    const ans = await callGemini(ci.input);
    const out = checkAnswer(ans, ci.input);
    if (out.error) return res.status(502).json({ error: out.error });
    const check = out.mode === 'data' ? autoCheck(JSON.parse(JSON.stringify(out.card))) : null;
    const info = db.prepare(`INSERT INTO card_proposals(user_id,created_at,status,mode,input_json,card_json,effect_json,check_json,flags_json,image)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(req.user.id, Date.now(), 'pending', out.mode, JSON.stringify(ci.input), JSON.stringify(out.card),
      out.newEffect ? JSON.stringify(out.newEffect) : null, check ? JSON.stringify(check) : null, JSON.stringify(out.flags), ci.image);
    const row = db.prepare('SELECT * FROM card_proposals WHERE id=?').get(Number(info.lastInsertRowid));
    res.json({ proposal: rowOut(row), reason: out.reason });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.get('/cardai/mine', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM card_proposals WHERE user_id=? ORDER BY id DESC LIMIT 30').all(req.user.id);
  res.json({ proposals: rows.map(rowOut) });
});

router.get('/cardai/admin/list', requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT p.*, COALESCE(u.nickname,u.username) AS username FROM card_proposals p JOIN users u ON u.id=p.user_id
    ORDER BY (p.status='pending') DESC, p.id DESC LIMIT 100`).all();
  res.json({ proposals: rows.map(rowOut) });
});

router.post('/cardai/admin/:id/review', requireAdmin, (req, res) => {
  const id = Number(req.params.id), decision = req.body && req.body.decision;
  if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'decision 은 approved 또는 rejected 예요.' });
  const row = db.prepare('SELECT * FROM card_proposals WHERE id=?').get(id);
  if (!row) return res.status(404).json({ error: '없는 제안이에요.' });
  if (row.status !== 'pending') return res.status(409).json({ error: '이미 처리된 제안이에요.' });
  const note = String((req.body && req.body.note) || '').slice(0, 300);
  db.prepare('UPDATE card_proposals SET status=?, note=?, reviewed_at=? WHERE id=?').run(decision, note, Date.now(), id);
  if (decision === 'approved') {                                // 시연용: 승인된 카드를 파일에 쌓는다 (엔진·카드 목록 반영은 개발자가 한다)
    fs.mkdirSync(DATA_DIR, { recursive: true });
    let list = []; try { list = JSON.parse(fs.readFileSync(APPROVED_FILE, 'utf8')); } catch (_) {}
    list.push({ id, approvedAt: Date.now(), card: JSON.parse(row.card_json), newEffect: row.effect_json ? JSON.parse(row.effect_json) : null });
    fs.writeFileSync(APPROVED_FILE, JSON.stringify(list, null, 2));
  }
  res.json({ ok: true, status: decision });
});

module.exports = { router, buildPrompt, callGemini, checkAnswer, cleanInput, autoCheck, KNOWN_EFFECTS };
