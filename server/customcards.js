// customcards.js — 유저가 직접 만드는 카드 (규칙 기반, AI 없음) + 승인(PR) 흐름
//
//   상태:  made(만듦: AI 대전·모험에서 사용) → pending(승인 요청) → approved(승인: 유저 대전에서도 사용) / rejected(반려: AI 대전·모험만)
//   · 만들 때 골드를 내고(CardRules.CUSTOM.GOLD_COST), 만든 사람은 그 카드를 2장 받는다
//   · 서버가 켜질 때 DB 의 카드를 전부 CARD_POOL 에 넣는다 (덱 검사·유저 대전 엔진이 이름으로 찾을 수 있게)
//   · 브라우저는 /api/customcards/pool 로 "승인된 카드 + 내 카드"를 받아 자기 CARD_POOL 에 넣는다 (customboot.js)
//   · 효과 목록(effectcatalog.js)·예산·이름 규칙(cardrules.js)은 브라우저와 같은 파일을 쓴다 → 화면에서 통과한 카드는 서버에서도 통과
const path = require('path');
const express = require('express');
const db = require('./db');
const { requireAuth, requireAdmin } = require('./auth');
const { ensureWallet, walletOut } = require('./wallet');
const { ensureCollection, ensureAtLeast, collectionOf } = require('./collection');
const JS = path.join(__dirname, '..', 'public', 'js');
const E = require(path.join(JS, 'engine.js'));
const CR = require(path.join(JS, 'cardrules.js'));

db.exec(`
CREATE TABLE IF NOT EXISTS custom_cards (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL UNIQUE,
  status       TEXT    NOT NULL DEFAULT 'made',     -- made | pending | approved | rejected
  input_json   TEXT    NOT NULL,                    -- 유저가 고른 값 {name,cost,atk,hp,selections}
  card_json    TEXT    NOT NULL,                    -- 실제 게임 카드 데이터
  lines_json   TEXT    NOT NULL,                    -- 효과별 문장·등급·비용 (검토 화면용)
  budget_json  TEXT    NOT NULL,
  warns_json   TEXT    NOT NULL DEFAULT '[]',
  check_json   TEXT,                                -- 봇 대전 자동 점검 결과
  image        BLOB,                                -- 카드 그림 (브라우저가 작게 줄여 보낸 webp/png/jpeg)
  image_type   TEXT,
  note         TEXT,                                -- 승인·반려 메모
  created_at   INTEGER NOT NULL,
  requested_at INTEGER,
  reviewed_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_custom_cards_user ON custom_cards(user_id, id);
CREATE TABLE IF NOT EXISTS custom_card_versions (    -- 버전 기록 (만들 때 v1, 고칠 때마다 +1) → 승인 페이지의 변경 비교
  card_id      INTEGER NOT NULL REFERENCES custom_cards(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,
  card_json    TEXT    NOT NULL,
  lines_json   TEXT    NOT NULL,
  budget_json  TEXT    NOT NULL,
  status_before TEXT,                               -- 고치기 직전 상태 (made | rejected)
  note_before  TEXT,                                -- 고치기 직전 반려 사유
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (card_id, version)
);
CREATE TABLE IF NOT EXISTS gold_log (               -- 개발자가 바꾼 골드 기록
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id   INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  before     INTEGER NOT NULL,
  after      INTEGER NOT NULL,
  at         INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS custom_card_images (      -- 소환수 그림 (카드 한 장에 여러 개)
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id    INTEGER NOT NULL REFERENCES custom_cards(id) ON DELETE CASCADE,
  image      BLOB    NOT NULL,
  image_type TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_custom_cards_status ON custom_cards(status, id);
`);

const STATUS_LABEL = { made: '만듦', pending: '승인 대기', approved: '승인됨', rejected: '반려됨' };
const creatorOf = uid => { const u = db.prepare('SELECT COALESCE(nickname, username) AS n FROM users WHERE id=?').get(uid); return u ? u.n : '?'; };

// DB 행 → 게임 카드 (CARD_POOL 에 들어가는 모양)
function cardOf(row) {
  const c = JSON.parse(row.card_json);
  c.custom = true; c.customId = row.id; c.customStatus = row.status; c.creator = creatorOf(row.user_id);
  c.flavor = `제작: ${c.creator}` + (row.status === 'approved' ? ' · 승인된 카드' : '');
  if (row.image_type) c.art = `/api/customcards/${row.id}/art`;
  return c;
}
// CARD_POOL 안의 카드 객체를 갱신한다 (같은 객체를 고쳐서, 이미 그 객체를 쥔 곳도 바뀌게)
function syncPool(row) {
  const fresh = cardOf(row), i = E.CARD_POOL.findIndex(c => c.custom && c.customId === row.id);
  if (i < 0) { E.CARD_POOL.push(fresh); return fresh; }
  const cur = E.CARD_POOL[i];
  for (const k of Object.keys(cur)) delete cur[k];
  Object.assign(cur, fresh); return cur;
}
for (const row of db.prepare('SELECT * FROM custom_cards ORDER BY id').all()) syncPool(row);   // 서버 시작: DB 의 카드를 전부 카드 풀에

// 유저 대전에 쓸 수 없는 카드 (승인 전 직접 만든 카드)
function unapprovedIn(list) {
  const bad = new Set();
  for (const n of list || []) { const c = E.CARD_POOL.find(x => x.name === n); if (c && c.custom && c.customStatus !== 'approved') bad.add(n); }
  return [...bad];
}
function unapprovedInDeckOf(uid) {
  const d = db.prepare('SELECT deck_json FROM decks WHERE user_id=?').get(uid);
  if (!d) return [];
  try { return unapprovedIn(JSON.parse(d.deck_json)); } catch (_) { return []; }
}

// ---------- 자동 점검: 이 카드를 넣은 덱으로 봇 대전 ----------
function autoCheck(card0, games = 6) {
  const res = { games, errors: 0, firstError: null, wins: 0, played: 0, avgTurns: 0 };
  let turns = 0;
  const card = { ...JSON.parse(JSON.stringify(card0)), name: '__점검중__' + Math.random().toString(36).slice(2, 8) };   // 같은 이름의 예전 버전과 섞이지 않게 임시 이름으로
  const inPool = false;
  E.CARD_POOL.push(card);
  try {
    for (let g = 0; g < games; g++) {
      const d0 = E.buildRandomDeck(), d1 = E.buildRandomDeck();
      for (let i = 0; i < 4; i++) d0[i] = card.name;                // 테스트 덱이라 4장까지 넣어 자주 나오게
      let s = E.newGame(Math.random, { decks: [d0, d1], freeDeck: [true, false] }), steps = 0;
      while (!s.over && s.turnNo <= 150 && steps++ < 4000) {
        const act = E.BotPlayers.rule.decide(E.viewFor(s, s.turn));
        let r;
        try { r = E.apply(s, act, s.turn); } catch (e) { res.errors++; res.firstError = res.firstError || String(e.message).slice(0, 200); break; }
        if (!r.ok) { res.errors++; res.firstError = res.firstError || String(r.error || '').slice(0, 200); break; }
        if (act && act.type === 'PLAY_CARD' && s.turn === 0) { const c = s.seats[0].hand.find(x => x.id === act.cardId); if (c && c.name === card.name) res.played++; }
        s = r.state;
      }
      turns += s.turnNo;
      if (s.over && s.winner === 0) res.wins++;
    }
  } finally { if (!inPool) { const i = E.CARD_POOL.indexOf(card); if (i >= 0) E.CARD_POOL.splice(i, 1); } }
  res.avgTurns = +(turns / games).toFixed(1);
  const wr = res.wins / games;
  res.verdict = res.errors ? '오류 있음' : wr >= 0.85 ? '너무 강할 수 있음' : wr <= 0.15 ? '약할 수 있음' : '이상 없음';
  return res;
}

// ---------- 출력 모양 ----------
const rowOut = (r, withInput) => ({
  id: r.id, name: r.name, status: r.status, statusLabel: STATUS_LABEL[r.status], creator: creatorOf(r.user_id), userId: r.user_id,
  card: cardOf(r), lines: JSON.parse(r.lines_json), budget: JSON.parse(r.budget_json), warns: JSON.parse(r.warns_json),
  check: r.check_json ? JSON.parse(r.check_json) : null, note: r.note || null, hasArt: !!r.image_type,
  createdAt: r.created_at, requestedAt: r.requested_at || null, reviewedAt: r.reviewed_at || null,
  ...(withInput ? { input: JSON.parse(r.input_json) } : {}),
  ...(withInput === 'versions' ? { versions: versionsOf(r.id) } : {}),
  version: db.prepare('SELECT MAX(version) AS v FROM custom_card_versions WHERE card_id=?').get(r.id).v || 1,
});
function saveVersion(cardId, statusBefore, noteBefore) {
  const r = db.prepare('SELECT card_json, lines_json, budget_json FROM custom_cards WHERE id=?').get(cardId);
  const v = (db.prepare('SELECT MAX(version) AS v FROM custom_card_versions WHERE card_id=?').get(cardId).v || 0) + 1;
  db.prepare('INSERT INTO custom_card_versions(card_id,version,card_json,lines_json,budget_json,status_before,note_before,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(cardId, v, r.card_json, r.lines_json, r.budget_json, statusBefore || null, noteBefore || null, Date.now());
  return v;
}
const versionsOf = cardId => db.prepare('SELECT version, card_json, lines_json, budget_json, status_before, note_before, created_at FROM custom_card_versions WHERE card_id=? ORDER BY version')
  .all(cardId).map(v => ({ version: v.version, card: JSON.parse(v.card_json), lines: JSON.parse(v.lines_json), budget: JSON.parse(v.budget_json), statusBefore: v.status_before, noteBefore: v.note_before, at: v.created_at }));
const COLS = 'id,user_id,name,status,input_json,card_json,lines_json,budget_json,warns_json,check_json,image_type,note,created_at,requested_at,reviewed_at';

// 그림: data URL → {buf, type}. 브라우저가 256px 정도로 줄여 보낸다
function parseImage(d) {
  if (!d) return null;
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(d));
  if (!m) return { error: '그림은 png·jpg·webp 만 올릴 수 있어요.' };
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 250 * 1024) return { error: '그림이 너무 커요. (250KB 이하)' };
  return { buf, type: m[1] };
}
const nameTaken = n => !!db.prepare('SELECT 1 FROM custom_cards WHERE name=?').get(n);

// 소환수 그림: 입력 안의 data URL 을 꺼내 'pending:번호' 로 바꿔 둔다 (카드를 저장한 뒤 진짜 주소로 바꾼다)
function takeTokenImages(selections) {
  const imgs = [], errors = [];
  const walk = t => {
    if (!t || typeof t !== 'object') return;
    if (typeof t.art === 'string' && t.art.startsWith('data:')) {
      const img = parseImage(t.art);
      if (img.error) errors.push(img.error); else { imgs.push(img); t.art = 'pending:' + (imgs.length - 1); }
    } else if (t.art && !/^\/api\/customcards\//.test(String(t.art))) delete t.art;
    for (const c of Array.isArray(t.summons) ? t.summons : []) walk(c && c.token);
  };
  for (const sel of Array.isArray(selections) ? selections : []) walk(sel && sel.token);
  return { imgs, error: errors[0] || null };
}
const replacePending = (json, urls) => json.replace(/"pending:(\d+)"/g, (m, k) => JSON.stringify(urls[Number(k)] || ''));

// ---------- 라우터 ----------
const router = express.Router();
const hits = new Map();
const slowOk = uid => { const t = Date.now(), a = (hits.get(uid) || []).filter(x => t - x < 60000); if (a.length >= 10) return false; a.push(t); hits.set(uid, a); return true; };

// 브라우저 카드 풀에 넣을 카드: 승인된 카드 + 내가 만든 카드 (개발자는 전부)
router.get('/customcards/pool', requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const rows = req.user.isAdmin ? db.prepare('SELECT * FROM custom_cards ORDER BY id').all()
    : db.prepare("SELECT * FROM custom_cards WHERE status='approved' OR user_id=? ORDER BY id").all(req.user.id);
  res.json({ cards: rows.map(cardOf) });
});

// 이름 확인 (입력하는 동안 화면이 묻는다)
router.get('/customcards/name-check', requireAuth, (req, res) => {
  res.json({ problem: CR.nameProblem(String(req.query.name || ''), nameTaken) });
});

// 내가 만든 카드
router.get('/customcards/mine', requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const rows = db.prepare(`SELECT ${COLS} FROM custom_cards WHERE user_id=? ORDER BY id DESC`).all(req.user.id);
  res.json({ cards: rows.map(r => rowOut(r, true)), gold: CR.CUSTOM.GOLD_COST, editGold: CR.CUSTOM.EDIT_GOLD, max: req.user.isAdmin ? null : (CR.CUSTOM.MAX_PER_USER || null) });
});

// 만들기 {name, cost, atk, hp, selections:[{id, params}], image}
router.post('/customcards', requireAuth, (req, res) => {
  const uid = req.user.id, b = req.body || {};
  if (!slowOk(uid)) return res.status(429).json({ error: '너무 빨라요. 잠시 뒤 다시 해 주세요.' });
  delete b.art;                                                  // 카드 그림은 image 로만 받는다
  const ti = takeTokenImages(b.selections);
  if (ti.error) return res.status(400).json({ error: '소환수 ' + ti.error });
  const built = CR.buildCard(b, { nameTaken });
  if (!built.ok) return res.status(400).json({ error: built.problems[0], problems: built.problems, budget: built.budget });
  const img = parseImage(b.image);
  if (img && img.error) return res.status(400).json({ error: img.error });
  if (!req.user.isAdmin && CR.CUSTOM.MAX_PER_USER) {
    const n = db.prepare('SELECT COUNT(*) AS n FROM custom_cards WHERE user_id=?').get(uid).n;
    if (n >= CR.CUSTOM.MAX_PER_USER) return res.status(400).json({ error: `카드는 한 사람당 ${CR.CUSTOM.MAX_PER_USER}장까지 만들 수 있어요.` });
  }
  const check = autoCheck(JSON.parse(JSON.stringify(built.card)));
  if (check.errors) return res.status(400).json({ error: '이 조합은 게임에서 오류가 나요. 효과를 바꿔 주세요.', check });

  ensureWallet(uid); ensureCollection(uid);
  const price = CR.CUSTOM.GOLD_COST;
  db.exec('BEGIN');
  let id;
  try {
    const w = db.prepare('SELECT gold, rev FROM wallets WHERE user_id=?').get(uid);
    if (w.gold < price) { db.exec('ROLLBACK'); return res.status(400).json({ error: `골드가 부족해요. (${price}골드 필요)` }); }
    db.prepare('UPDATE wallets SET gold=gold-?, rev=rev+1, updated_at=? WHERE user_id=?').run(price, Date.now(), uid);
    const input = { name: built.card.name, cost: built.card.cost, atk: built.card.atk, hp: built.card.hp, selections: (b.selections || []).map(s => ({ id: s.id, params: s.params || {}, ...(s.token ? { token: s.token } : {}) })) };
    const info = db.prepare(`INSERT INTO custom_cards(user_id,name,status,input_json,card_json,lines_json,budget_json,warns_json,check_json,image,image_type,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(uid, built.card.name, 'made', JSON.stringify(input), JSON.stringify(built.card), JSON.stringify(built.lines),
      JSON.stringify(built.budget), JSON.stringify(built.warns), JSON.stringify(check), img ? img.buf : null, img ? img.type : null, Date.now());
    id = Number(info.lastInsertRowid);
    if (ti.imgs.length) {                                        // 소환수 그림 저장 → 카드 데이터의 'pending:n' 을 진짜 주소로
      const ins = db.prepare('INSERT INTO custom_card_images(card_id,image,image_type) VALUES (?,?,?)');
      const urls = ti.imgs.map(im => `/api/customcards/img/${Number(ins.run(id, im.buf, im.type).lastInsertRowid)}`);
      db.prepare('UPDATE custom_cards SET card_json=?, input_json=?, lines_json=? WHERE id=?').run(
        replacePending(JSON.stringify(built.card), urls), replacePending(JSON.stringify(input), urls), replacePending(JSON.stringify(built.lines), urls), id);
    }
    saveVersion(id, null, null);
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    if (/UNIQUE/.test(String(e.message))) return res.status(400).json({ error: '이미 있는 카드 이름이에요' });
    throw e;
  }
  const row = db.prepare('SELECT * FROM custom_cards WHERE id=?').get(id);
  const card = syncPool(row);
  ensureAtLeast(uid, card.name, CR.CUSTOM.GIVE_COPIES);
  res.json({ card, item: rowOut(row), wallet: walletOut(ensureWallet(uid)), collection: collectionOf(uid) });
});

// 승인 요청 (PR 열기)
router.post('/customcards/:id/request', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM custom_cards WHERE id=?').get(Number(req.params.id));
  if (!row || row.user_id !== req.user.id) return res.status(404).json({ error: '없는 카드예요.' });
  if (row.status === 'pending') return res.status(409).json({ error: '이미 승인을 기다리고 있어요.' });
  if (row.status === 'approved') return res.status(409).json({ error: '이미 승인된 카드예요.' });
  db.prepare("UPDATE custom_cards SET status='pending', requested_at=?, note=NULL WHERE id=?").run(Date.now(), row.id);
  const r2 = db.prepare('SELECT * FROM custom_cards WHERE id=?').get(row.id); syncPool(r2);
  res.json({ item: rowOut(r2) });
});

// 고치기 (만듦·반려 카드만, 이름 고정, EDIT_GOLD 골드)
//   만듦 → 고쳐도 만듦 (승인 요청 전까지 유저 대전 불가) / 반려 → 고치면 바로 승인 대기(재요청)
//   그림: image 가 data URL 이면 교체, clearImage 면 지움, 둘 다 없으면 그대로
router.put('/customcards/:id', requireAuth, (req, res) => {
  const uid = req.user.id, b = req.body || {};
  if (!slowOk(uid)) return res.status(429).json({ error: '너무 빨라요. 잠시 뒤 다시 해 주세요.' });
  const row = db.prepare('SELECT * FROM custom_cards WHERE id=?').get(Number(req.params.id));
  if (!row || row.user_id !== uid) return res.status(404).json({ error: '없는 카드예요.' });
  if (row.status !== 'made' && row.status !== 'rejected') return res.status(409).json({ error: row.status === 'pending' ? '승인을 기다리는 카드는 고칠 수 없어요.' : '승인된 카드는 고칠 수 없어요.' });
  delete b.art; b.name = row.name;                               // 이름은 고정
  const ti = takeTokenImages(b.selections);
  if (ti.error) return res.status(400).json({ error: '소환수 ' + ti.error });
  const built = CR.buildCard(b, { nameTaken, allowName: row.name });
  if (!built.ok) return res.status(400).json({ error: built.problems[0], problems: built.problems, budget: built.budget });
  const img = b.image ? parseImage(b.image) : null;
  if (img && img.error) return res.status(400).json({ error: img.error });
  const check = autoCheck(built.card);
  if (check.errors) return res.status(400).json({ error: '이 조합은 게임에서 오류가 나요. 효과를 바꿔 주세요.', check });

  const price = CR.CUSTOM.EDIT_GOLD, next = row.status === 'rejected' ? 'pending' : 'made';
  ensureWallet(uid);
  db.exec('BEGIN');
  try {
    const w = db.prepare('SELECT gold FROM wallets WHERE user_id=?').get(uid);
    if (w.gold < price) { db.exec('ROLLBACK'); return res.status(400).json({ error: `골드가 부족해요. (${price}골드 필요)` }); }
    db.prepare('UPDATE wallets SET gold=gold-?, rev=rev+1, updated_at=? WHERE user_id=?').run(price, Date.now(), uid);
    if (!db.prepare('SELECT 1 FROM custom_card_versions WHERE card_id=?').get(row.id)) saveVersion(row.id, null, null);   // 버전 기록이 생기기 전에 만든 카드: 고치기 전 모습을 v1 로 남긴다
    const input = { name: row.name, cost: built.card.cost, atk: built.card.atk, hp: built.card.hp, selections: (b.selections || []).map(x => ({ id: x.id, params: x.params || {}, ...(x.token ? { token: x.token } : {}) })) };
    let cardJ = JSON.stringify(built.card), inputJ = JSON.stringify(input), linesJ = JSON.stringify(built.lines);
    if (ti.imgs.length) {
      const ins = db.prepare('INSERT INTO custom_card_images(card_id,image,image_type) VALUES (?,?,?)');
      const urls = ti.imgs.map(im => `/api/customcards/img/${Number(ins.run(row.id, im.buf, im.type).lastInsertRowid)}`);
      cardJ = replacePending(cardJ, urls); inputJ = replacePending(inputJ, urls); linesJ = replacePending(linesJ, urls);
    }
    db.prepare(`UPDATE custom_cards SET input_json=?, card_json=?, lines_json=?, budget_json=?, warns_json=?, check_json=?, status=?, note=NULL,
      requested_at=CASE WHEN ?='pending' THEN ? ELSE requested_at END, reviewed_at=CASE WHEN ?='pending' THEN NULL ELSE reviewed_at END WHERE id=?`)
      .run(inputJ, cardJ, linesJ, JSON.stringify(built.budget), JSON.stringify(built.warns), JSON.stringify(check), next, next, Date.now(), next, row.id);
    if (img) db.prepare('UPDATE custom_cards SET image=?, image_type=? WHERE id=?').run(img.buf, img.type, row.id);
    else if (b.clearImage) db.prepare('UPDATE custom_cards SET image=NULL, image_type=NULL WHERE id=?').run(row.id);
    saveVersion(row.id, row.status, row.note);
    db.exec('COMMIT');
  } catch (e) { try { db.exec('ROLLBACK'); } catch (_) {} throw e; }
  const r2 = db.prepare('SELECT * FROM custom_cards WHERE id=?').get(row.id);
  const card = syncPool(r2);
  res.json({ card, item: rowOut(r2, true), wallet: walletOut(ensureWallet(uid)) });
});

// 카드 그림 (<img> 가 로그인 쿠키를 같이 보내므로 게임·승인 페이지에서 그대로 보인다)
router.get('/customcards/:id/art', (req, res) => {
  const r = db.prepare('SELECT image, image_type FROM custom_cards WHERE id=?').get(Number(req.params.id));
  if (!r || !r.image_type) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=86400'); res.type(r.image_type).send(Buffer.from(r.image));
});

router.get('/customcards/img/:id', (req, res) => {             // 소환수 그림
  const r = db.prepare('SELECT image, image_type FROM custom_card_images WHERE id=?').get(Number(req.params.id));
  if (!r) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=86400'); res.type(r.image_type).send(Buffer.from(r.image));
});

// ---------- 개발자: 승인 페이지 (review.html) ----------
router.get('/customcards/admin/list', requireAdmin, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const rows = db.prepare(`SELECT ${COLS} FROM custom_cards ORDER BY (status='pending') DESC, COALESCE(requested_at, created_at) DESC LIMIT 300`).all();
  const counts = {}; for (const r of db.prepare('SELECT status, COUNT(*) AS n FROM custom_cards GROUP BY status').all()) counts[r.status] = r.n;
  res.json({ cards: rows.map(r => rowOut(r, 'versions')), counts });
});
router.post('/customcards/admin/:id/recheck', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM custom_cards WHERE id=?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: '없는 카드예요.' });
  const check = autoCheck(cardOf(row), 10);
  db.prepare('UPDATE custom_cards SET check_json=? WHERE id=?').run(JSON.stringify(check), row.id);
  res.json({ check });
});
router.post('/customcards/admin/:id/review', requireAdmin, (req, res) => {
  const decision = req.body && req.body.decision;
  if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'decision 은 approved 또는 rejected 예요.' });
  const row = db.prepare('SELECT * FROM custom_cards WHERE id=?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: '없는 카드예요.' });
  const note = String((req.body && req.body.note) || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 300);
  db.prepare('UPDATE custom_cards SET status=?, note=?, reviewed_at=? WHERE id=?').run(decision, note || null, Date.now(), row.id);
  const r2 = db.prepare('SELECT * FROM custom_cards WHERE id=?').get(row.id); syncPool(r2);
  res.json({ item: rowOut(r2, true) });
});

// ---------- 개발자: 골드 수정 ----------
//   GET  /customcards/admin/users?q=   유저 목록 (닉네임·아이디·골드)
//   POST /customcards/admin/gold {userId, gold}  골드를 이 값으로   |  {userId, add}  더하기(빼기)
//   지갑 저장 번호(rev)를 올리므로, 그 유저가 게임을 켜 둔 채라면 새로고침해야 한다 (자기 자신은 응답의 wallet 을 화면이 바로 받아 쓴다)
router.get('/customcards/admin/users', requireAdmin, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const qq = '%' + String(req.query.q || '').replace(/[%_]/g, '') + '%';
  const rows = db.prepare(`SELECT u.id, u.username, u.nickname, u.is_admin, COALESCE(w.gold, 0) AS gold, w.user_id AS has_wallet
    FROM users u LEFT JOIN wallets w ON w.user_id=u.id WHERE u.username LIKE ? OR COALESCE(u.nickname,'') LIKE ? ORDER BY u.id LIMIT 100`).all(qq, qq);
  const log = db.prepare(`SELECT g.at, g.before, g.after, COALESCE(a.nickname,a.username) AS admin, COALESCE(u.nickname,u.username) AS user
    FROM gold_log g JOIN users a ON a.id=g.admin_id JOIN users u ON u.id=g.user_id ORDER BY g.id DESC LIMIT 20`).all();
  res.json({ users: rows.map(r => ({ id: r.id, username: r.username, nickname: r.nickname, isAdmin: !!r.is_admin, gold: r.gold })), log, me: req.user.id });
});
router.post('/customcards/admin/gold', requireAdmin, (req, res) => {
  const b = req.body || {}, uid = Number(b.userId);
  if (!Number.isInteger(uid) || !db.prepare('SELECT 1 FROM users WHERE id=?').get(uid)) return res.status(404).json({ error: '없는 유저예요.' });
  const before = ensureWallet(uid).gold;
  let after = b.gold !== undefined ? Number(b.gold) : before + Number(b.add);
  if (!Number.isFinite(after)) return res.status(400).json({ error: '숫자를 입력해 주세요.' });
  after = Math.max(0, Math.min(10000000, Math.round(after)));
  db.prepare('UPDATE wallets SET gold=?, rev=rev+1, updated_at=? WHERE user_id=?').run(after, Date.now(), uid);
  db.prepare('INSERT INTO gold_log(admin_id,user_id,before,after,at) VALUES (?,?,?,?,?)').run(req.user.id, uid, before, after, Date.now());
  res.json({ userId: uid, before, after, wallet: walletOut(ensureWallet(uid)) });
});

module.exports = { router, unapprovedIn, unapprovedInDeckOf, autoCheck, cardOf };
