// test-codex.js — v163 특성 도감: 이긴 판의 특성 → 처음이면 100골드, 두 번째부터는 횟수만 (임시 DB)
process.env.DB_PATH = ':memory:';
const assert = require('assert');
const http = require('http');
const path = require('path');
const express = require('express');
const JS = path.join(__dirname, '..', 'public', 'js');
const { PROGRESS } = require(path.join(JS, 'progress.js'));
const { CHEATS } = require(path.join(JS, 'cheats.js'));
const auth = require('./auth'), saves = require('./saves'), progress = require('./progress'), db = require('./db');

const app = express(); app.use(express.json());
app.use('/api', auth.router); app.use('/api', saves.router); app.use('/api', progress.router);
const server = http.createServer(app).listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const call = async (method, url, body) => {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; return { status: res.status, data: await res.json().catch(() => ({})) };
  };
  try {
    await call('POST', '/api/signup', { username: 'codex1', nickname: 'codex1', password: 'password1' });
    let r = await call('GET', '/api/save'); let rev = r.data.wallet.rev, gold = r.data.wallet.gold;
    r = await call('GET', '/api/progress');
    assert.deepStrictEqual(r.data.codex.got, {}); assert.strictEqual(r.data.codex.total, CHEATS.length); assert.strictEqual(r.data.codex.gold, 100);
    const win = { games: 1, wins: 1, cheatWins: 1 };

    // 이긴 판: 새 특성 2개 + 가짜 id 는 무시 → 200골드
    r = await call('POST', '/api/quests/report', { stats: win, rev, beaten: ['armor', 'recycle2', 'bogus', 'armor'] });
    assert.strictEqual(r.status, 200, JSON.stringify(r.data));
    assert.deepStrictEqual(r.data.codexNew.map(x => x.id).sort(), ['armor', 'recycle2']);
    assert.strictEqual(r.data.wallet.gold - gold >= 200, true);
    const questGold = r.data.completed.reduce((t, q) => t + q.gold, 0);
    assert.strictEqual(r.data.wallet.gold, gold + 200 + questGold);
    assert.ok(r.data.codex.got.armor && r.data.codex.got.recycle2);
    gold = r.data.wallet.gold; rev = r.data.wallet.rev;

    // 같은 특성을 또 이김 → 골드 없음, 이긴 횟수만
    r = await call('POST', '/api/quests/report', { stats: win, rev, beaten: ['armor'] });
    assert.strictEqual(r.data.codexNew.length, 0); assert.strictEqual(r.data.codex.got.armor.wins, 2);
    gold = r.data.wallet.gold; rev = r.data.wallet.rev;

    // 진 판에 특성을 보내도 도감에 안 들어감
    r = await call('POST', '/api/quests/report', { stats: { games: 1, wins: 0, cheatWins: 1 }, rev, beaten: ['mirror'] });
    assert.strictEqual(r.data.codexNew.length, 0); assert.ok(!r.data.codex.got.mirror);
    rev = r.data.wallet.rev;

    // 오래된 저장 번호 → 409
    r = await call('POST', '/api/quests/report', { stats: win, rev: rev - 1, beaten: ['mirror'] });
    assert.strictEqual(r.status, 409);

    // 퀘스트: 특성 있는 상대 2승 (cheat2) — 오늘 퀘스트에 넣어 두고 확인
    const uid = db.prepare("SELECT id FROM users WHERE username='codex1'").get().id;
    db.prepare('UPDATE player_progress SET quests_json=? WHERE user_id=?').run(JSON.stringify([{ id: 'cheat2', prog: 0, done: false }]), uid);
    r = await call('POST', '/api/quests/report', { stats: win, rev, beaten: ['mirror'] }); rev = r.data.wallet.rev;
    assert.strictEqual(r.data.quests.list[0].prog, 1);
    r = await call('POST', '/api/quests/report', { stats: win, rev, beaten: [] }); rev = r.data.wallet.rev;
    assert.strictEqual(r.data.quests.list[0].prog, 1, '특성 없는 승리는 세지 않음');
    r = await call('POST', '/api/quests/report', { stats: win, rev, beaten: ['armor'] });
    assert.ok(r.data.completed.some(q => q.id === 'cheat2' && q.gold === 70), JSON.stringify(r.data.completed));
    console.log('test-codex: 모두 통과');
  } catch (e) { console.error(e); process.exitCode = 1; }
  finally { server.close(); }
});
