// test-bosscheats.js — v162 보스 치트 16종 + 보스 영웅 능력(지속형/사용형) 엔진 검사
//   node server/test-bosscheats.js
const assert = require('assert');
const path = require('path');
const JS = path.join(__dirname, '..', 'public', 'js');
const E = require(path.join(JS, 'engine.js'));
const C = require(path.join(JS, 'cheats.js'));

const card = n => { const b = E.CARD_POOL.find(c => c.name === n); assert.ok(b, '카드 없음: ' + n); return b; };
// 0번 좌석 차례로 시작하는 판. mods0/mods1 = 치트, bp = [보스 영웅 능력0, 1]
function game(mods0 = {}, mods1 = {}, bp = null) {
  const s = E.newGame(Math.random, { first: 0, mods: [mods0, mods1], bossPowers: bp || undefined });
  s.pending = null;
  for (const P of s.seats) { P.mana = 10; P.maxMana = 10; P.hand = []; P.board = []; P.startIds = []; }
  return s;
}
const give = (s, seat, n, extra = {}) => { const c = { ...structuredClone(card(n)), id: s.nextId++, inDeck: true, ...extra }; s.seats[seat].hand.push(c); return c; };
const put = (s, seat, n, extra = {}) => { const b = card(n), m = { ...structuredClone(b), id: s.nextId++, maxHp: b.hp, attacked: false, summoned: false, ...extra }; s.seats[seat].board.push(m); return m; };
const act = (s, seat, a) => { const r = E.apply(s, a, seat); assert.ok(r.ok, JSON.stringify(a) + ' → ' + r.error); return r; };
const handCost = (s, seat, id) => E.viewFor(s, seat).me.hand.find(c => c.id === id).cost;
const ok = name => console.log('✔ ' + name);

// 1) 메아리 군단 + 죽지 않는 자의 무덤
{ const s = game({ drCopy: 2, drRevive: true }); const c = give(s, 0, '유물 수집가');
  const r = act(s, 0, { type: 'PLAY_CARD', cardId: c.id });
  const B = r.state.seats[0].board;
  assert.strictEqual(B.length, 3, '원본 + 복사본 2');
  assert.ok(B[0].revive, '원본에 환생');
  assert.ok(B.slice(1).every(m => m.atk === 1 && m.hp === 1 && m.isMini && m.name.endsWith('(미니)')), '1/1 미니');
  assert.ok(B.slice(1).every(m => Object.keys(card('유물 수집가')).filter(k => /^death/.test(k)).every(k => m[k] !== undefined)), '복사본도 죽음의 메아리 유지');
  const s2 = game({ drCopy: 1, drRevive: true }); const c2 = give(s2, 0, '들쥐');
  assert.strictEqual(act(s2, 0, { type: 'PLAY_CARD', cardId: c2.id }).state.seats[0].board.length, 1, '죽음의 메아리가 아니면 복사 없음');
  ok('메아리 군단 · 죽지 않는 자의 무덤'); }

// 2) 함성의 잔향: 전투의 함성 하수인을 뽑으면 1/1 복사본
{ const s = game({ bcDrawCopy: 1 }); s.seats[0].deck.push({ ...structuredClone(card('화염 정령')), id: s.nextId++, inDeck: true });
  const r = act(s, 0, { type: 'END_TURN' }); const s2 = act(r.state, 1, { type: 'END_TURN' }).state;
  const h = s2.seats[0].hand; assert.ok(h.some(c => c.name === '화염 정령') && h.some(c => c.name === '화염 정령 (미니)' && c.cost === 1 && c.effect), '미니 복사본(전투의 함성 유지)');
  ok('함성의 잔향'); }

// 3) 무한 굴레
{ const s = game({ infiniteLoop: 1 }); const sp = give(s, 0, '불꽃 화살'), mi = give(s, 0, '들쥐');
  let r = act(s, 0, { type: 'PLAY_CARD', cardId: sp.id, target: { kind: 'hero', seat: 1 } });
  assert.strictEqual(r.state.seats[0].hand.filter(c => c.type === 'minion' && c.id !== mi.id).length, 1, '주문 → 무작위 하수인');
  r = act(r.state, 0, { type: 'PLAY_CARD', cardId: mi.id });
  assert.strictEqual(r.state.seats[0].hand.filter(c => c.type === 'spell').length, 1, '하수인 → 무작위 주문');
  ok('무한 굴레'); }

// 4) 학자 롬메스의 두루마리: 처음 덱에 없던 카드만 비용 -N
{ const s = game({ rommath: 2 }); const a = give(s, 0, '화염구'), b = give(s, 0, '화염구', { inDeck: undefined });
  assert.strictEqual(handCost(s, 0, a.id), 4); assert.strictEqual(handCost(s, 0, b.id), 2);
  ok('학자 롬메스의 두루마리'); }

// 5) 너도? 나도? (양쪽): 발견하고 남은 2장이 상대 손으로 — 보스(1번)에게만 걸어도 0번에게 적용
{ const s = game({}, { youMe: true }); assert.ok(s.seats[0].mods.youMe, '양쪽 규칙이 0번에도');
  const c = give(s, 0, '주문 발견'); let r = act(s, 0, { type: 'PLAY_CARD', cardId: c.id });
  assert.ok(r.state.pending && r.state.pending.options.length === 3, '발견 창');
  r = act(r.state, 0, { type: 'CHOOSE', index: 1 });
  assert.strictEqual(r.state.seats[1].hand.length, 2, '고르지 않은 2장 → 상대');
  assert.strictEqual(r.state.seats[0].hand.length, 1);
  ok('너도? 나도?'); }

// 6) 재사용하기 / 상급
{ const s = game({ recycle: 2 }); const m = put(s, 0, '들쥐'), d = put(s, 1, '견습 검사'); m.hp = 1; m.attacked = false;
  let r = act(s, 0, { type: 'ATTACK', attackerId: m.id, target: { kind: 'minion', seat: 1, id: d.id } });
  assert.strictEqual(r.state.seats[0].armor, 2, '아군 사망 → 방어도 2');
  const s2 = game({}, { recycle2: 1 }); const a = put(s2, 0, '견습 검사'), b = put(s2, 1, '견습 검사'), c = put(s2, 1, '견습 검사');
  r = act(s2, 0, { type: 'ATTACK', attackerId: a.id, target: { kind: 'minion', seat: 1, id: b.id } });   // 둘 다 죽음
  assert.strictEqual(r.state.seats[1].armor, 1 + 2, '상급: 적·아군 상관없이 1, 2 …');
  assert.strictEqual(r.state.seats[1].recycleN, 3);
  ok('재사용하기 · 상급'); }

// 7) 주문 과부하 / 8) 균일가 주문(양쪽)
{ const s = game({ spellOverload: 1 }); const c = give(s, 0, '화염구');
  assert.strictEqual(handCost(s, 0, c.id), 1);
  const r = act(s, 0, { type: 'PLAY_CARD', cardId: c.id, target: { kind: 'hero', seat: 1 } });
  assert.strictEqual(r.state.seats[0].mana, 9); assert.strictEqual(r.state.seats[0].overloadNext, 1);
  const s2 = game({}, { spellFive: 5 }); const a = give(s2, 0, '불꽃 화살'), b = give(s2, 1, '화염구'), coin = { ...structuredClone(E.CARD_POOL.find(x => x.effect && x.effect.type === 'mana') || { type: 'spell', name: '동전', cost: 0, effect: { type: 'mana', value: 1 } }), id: s2.nextId++ };
  s2.seats[0].hand.push(coin);
  assert.strictEqual(handCost(s2, 0, a.id), 5); assert.strictEqual(handCost(s2, 1, b.id), 5); assert.strictEqual(handCost(s2, 0, coin.id), 0, '동전 제외');
  ok('주문 과부하 · 균일가 주문'); }

// 9) 피의 통행료(양쪽): 실제로 낸 비용만큼, 방어도가 먼저
{ const s = game({}, { bloodToll: true }); s.seats[0].armor = 1; const c = give(s, 0, '견습 검사');
  const r = act(s, 0, { type: 'PLAY_CARD', cardId: c.id });
  assert.strictEqual(r.state.seats[0].armor, 0); assert.strictEqual(r.state.seats[0].hp, 30 - 1, '2 피해 중 1은 방어도');
  ok('피의 통행료'); }

// 10) 무덤지기 / 11) 철벽 군단 / 12) 도박사의 손 (지속형)
{ const s = game({}, { graveKeeper: 1, ironLegion: true, gambler: 1 }); s.seats[1].grave = [{ name: '견습 검사', taunt: false }];
  s.seats[1].deck.push({ ...structuredClone(card('화염구')), id: s.nextId++, inDeck: true });
  const r = act(s, 0, { type: 'END_TURN' }); const P = r.state.seats[1];
  assert.ok(P.board.some(m => m.name === '견습 검사' && m.taunt), '되살아남 + 도발');
  assert.ok(P.hand.some(c => c.cost === 0), '손패 1장 비용 0');
  ok('무덤지기 · 철벽 군단 · 도박사의 손'); }

// 13) 거울의 방
{ const s = game({}, { mirror: true }); const c = give(s, 0, '불꽃 화살');
  const r = act(s, 0, { type: 'PLAY_CARD', cardId: c.id, target: { kind: 'hero', seat: 1 } });
  assert.ok(r.state.seats[1].hand.some(x => x.name === '불꽃 화살' && x.cost === card('불꽃 화살').cost));
  ok('거울의 방'); }

// 14) 피의 계약
{ const s = game({ bloodPact: true }); s.seats[0].mana = 1; const c = give(s, 0, '화염구');
  assert.ok(E.viewFor(s, 0).legal.some(a => a.type === 'PLAY_CARD' && a.cardId === c.id), '마나가 모자라도 낼 수 있음');
  const r = act(s, 0, { type: 'PLAY_CARD', cardId: c.id, target: { kind: 'hero', seat: 1 } });
  assert.strictEqual(r.state.seats[0].mana, 0); assert.strictEqual(r.state.seats[0].hp, 30 - 3);
  const s2 = game({ bloodPact: true }); s2.seats[0].mana = 0; s2.seats[0].hp = 4; const c2 = give(s2, 0, '화염구');
  assert.ok(!E.viewFor(s2, 0).legal.some(a => a.type === 'PLAY_CARD' && a.cardId === c2.id), '죽을 만큼은 못 냄');
  const s3 = game(); s3.seats[0].mana = 1; const c3 = give(s3, 0, '화염구');
  assert.ok(!E.viewFor(s3, 0).legal.some(a => a.type === 'PLAY_CARD' && a.cardId === c3.id), '치트 없으면 그대로');
  ok('피의 계약'); }

// 15) 보스 영웅 능력: 사용형(비용 지정) / 지속형
{ const s = game({}, {}, [{ id: 'graveKeeper', value: 1, active: true, cost: 3, name: '무덤지기', icon: '🪦', text: 't' }, null]);
  const P = s.seats[0]; assert.strictEqual(P.heroPower, null); assert.ok(!P.mods.graveKeeper, '사용형이면 치트는 꺼짐');
  assert.ok(!E.viewFor(s, 0).legal.some(a => a.type === 'HERO_POWER'), '무덤이 비면 못 씀');
  P.grave = [{ name: '견습 검사', taunt: false }];
  const v = E.viewFor(s, 0); assert.ok(v.legal.some(a => a.type === 'HERO_POWER')); assert.strictEqual(v.me.heroPower.cost, 3); assert.ok(v.me.heroPower.boss && !v.me.heroPower.passive);
  assert.strictEqual(E.heroPowerChoice(v).type, 'HERO_POWER', '봇도 사용');
  const r = act(s, 0, { type: 'HERO_POWER', target: null });
  assert.strictEqual(r.state.seats[0].mana, 7); assert.ok(r.state.seats[0].board.some(m => m.name === '견습 검사'));
  assert.ok(r.events.some(e => e.type === 'heroPower' && e.id === 'boss_graveKeeper'));
  assert.ok(!E.viewFor(r.state, 0).legal.some(a => a.type === 'HERO_POWER'), '턴에 한 번');
  const s2 = game({}, {}, [null, { id: 'spellFive', value: 3, active: false, cost: 0, name: '균일가 주문', icon: '🔮', text: 't' }]);
  assert.strictEqual(s2.seats[1].mods.spellFive, 3); assert.strictEqual(s2.seats[0].mods.spellFive, 3, '지속형 양쪽 규칙도 양쪽에');
  const v2 = E.viewFor(s2, 0); assert.ok(v2.opp.heroPower.passive);
  const s3 = game({}, {}, [{ id: 'mirror', value: true, active: true, cost: 1, name: 'x' }, null]);
  assert.ok(s3.seats[0].bossPower && !s3.seats[0].bossPower.active, '사용형이 없는 능력은 지속형으로');
  ok('보스 영웅 능력 (사용형 · 지속형)'); }

// 16) 치트 수치 조절 범위
{ const f = id => C.CHEATS.find(c => c.id === id);
  assert.strictEqual(C.cheatValueFor(f('armor'), { armor: 3 }), 3); assert.strictEqual(C.cheatValueFor(f('armor'), { armor: 99 }), 5);
  assert.strictEqual(C.cheatValueFor(f('armor'), {}), 1); assert.strictEqual(C.cheatValueFor(f('drRevive'), { drRevive: 5 }), true);
  assert.ok(!C.cheatCandidates(500).some(c => C.CHEATS.find(x => x.id === c.id).bossOnly), '배팅 판에는 보스 전용 치트가 안 나옴');
  ok('치트 수치 범위'); }

// 17) 모든 치트를 켠 채 봇끼리 많이 붙여도 오류 없음
{ const ids = C.CHEATS.map(c => c.id); let errors = 0, games = 0;
  for (let g = 0; g < 120; g++) {
    const pick = () => { const m = {}; for (const id of ids) if (Math.random() < 0.25) m[id] = C.cheatValue(C.CHEATS.find(c => c.id === id), 0); return m; };
    const bp = Math.random() < 0.5 ? [null, { id: ['graveKeeper', 'gambler', 'ironLegion'][g % 3], value: 1, active: true, cost: 2, name: 'b' }] : null;
    let s = E.newGame(Math.random, { mods: [pick(), pick()], bossPowers: bp || undefined, heroPowers: [E.randomHeroPower(), E.randomHeroPower()] }); games++;
    for (let k = 0; k < 600 && !s.over; k++) {
      const bot = s.turn === 0 ? E.BotPlayers.rule : E.BotPlayers.rule2;
      const r = E.apply(s, bot.decide(E.viewFor(s, s.turn)), s.turn);
      if (!r.ok) { errors++; break; } s = r.state;
    }
  }
  assert.strictEqual(errors, 0, '봇 대전 중 잘못된 행동');
  ok(`치트 무작위 조합 봇 대전 ${games}판`); }
console.log('test-bosscheats: 모두 통과');
