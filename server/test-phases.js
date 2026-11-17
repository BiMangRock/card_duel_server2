// test-phases.js — v166 보스 페이즈(체력 66·33·15%) · 도중에 능력 얻기 · 고유 능력 N수 선언
//   node server/test-phases.js
const assert = require('assert');
const path = require('path');
const JS = path.join(__dirname, '..', 'public', 'js');
const E = require(path.join(JS, 'engine.js'));
const C = require(path.join(JS, 'cheats.js'));

let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const POOL = C.phaseGainPool();
function game(opts = {}) {
  return E.newGame(rng, { first: 0, phases: [null, { at: [66, 33, 15], armor: 5, pool: opts.pool || POOL }], uniques: [null, opts.unique || null], heroPowers: ['fireblast', 'armorUp'], ...opts.extra });
}
// 플레이어(좌석 0)의 영웅 능력 「화염 작렬」로 보스 영웅을 때리는 대신, 체력을 직접 깎고 아무 행동(턴 종료)으로 판정을 돌린다
function hitBossTo(s, hp) { s.seats[1].hp = hp; s.seats[1].armor = 0; return E.apply(s, { type: 'END_TURN' }, s.turn); }

// 1) 풀: 시작할 때만 작동하는 치트 · 룬 · 피로 면역은 없다
for (const id of ['hp', 'startMana', 'startHand', 'startBoard', 'startArmor', 'costDown', 'extraDraw', 'bloodHeal', 'frostArmor', 'unholyCorpse', 'noFatigue'])
  assert(!POOL.some(g => g.kind === 'cheat' && g.id === id), '풀에서 빠져야 함: ' + id);
assert(POOL.some(g => g.kind === 'cheat' && g.global), '양쪽 규칙도 후보');
assert(POOL.some(g => g.kind === 'hero') && POOL.some(g => g.kind === 'active'), '영웅 능력 · 사용형 능력도 후보');

// 2) 선을 넘을 때만, 선마다 한 번
{
  let s = game(); assert.strictEqual(s.seats[1].phases.done, 0);
  let r = hitBossTo(s, 20); s = r.state;              // 30의 66% = 19 → 20은 아직
  assert.strictEqual(s.seats[1].phases.done, 0, '20은 아직 1페이즈 아님');
  r = hitBossTo(s, 19); s = r.state;
  assert.strictEqual(s.seats[1].phases.done, 1, '19 → 1페이즈');
  const ev = r.events.filter(e => e.type === 'bossPhase');
  assert.strictEqual(ev.length, 1); assert.strictEqual(ev[0].idx, 0); assert.strictEqual(ev[0].armor, 5);
  assert(s.seats[1].armor >= 5, '방어도 +5');
  r = hitBossTo(s, 19); s = r.state;
  assert.strictEqual(r.events.filter(e => e.type === 'bossPhase').length, 0, '같은 선은 한 번만');
  r = hitBossTo(s, 3); s = r.state;                     // 한 번에 33%·15% 두 선을 넘음
  const ev2 = r.events.filter(e => e.type === 'bossPhase');
  assert.deepStrictEqual(ev2.map(e => e.idx), [1, 2], '두 선을 같이 넘으면 차례로');
  assert.strictEqual(s.seats[1].phases.done, 3);
  assert.strictEqual(s.seats[1].phaseGains.length, 3);
}

// 3) 죽으면(게임 끝) 페이즈 없음
{
  let s = game(); s.seats[1].hp = 0; const r = E.apply(s, { type: 'END_TURN' }, s.turn);
  assert.strictEqual(r.events.filter(e => e.type === 'bossPhase').length, 0, '죽은 보스는 페이즈 없음');
}

// 4) 얻은 것의 종류별 적용
const only = kind => POOL.filter(g => g.kind === kind);
{ // 치트 → 지속 능력 자리 + mods 켜짐, 양쪽 규칙이면 두 좌석 모두
  const g = POOL.find(x => x.kind === 'cheat' && x.id === 'spellFive');
  let s = game({ pool: [g] }); const r = hitBossTo(s, 10); s = r.state;
  assert.strictEqual(s.seats[1].mods.spellFive, 5); assert.strictEqual(s.seats[0].mods.spellFive, 5, '양쪽 규칙은 플레이어에게도');
  assert(s.seats[1].bossPower && !s.seats[1].bossPower.active && s.seats[1].heroPower === null, '비용 없는 지속 능력으로 영웅 능력 자리에');
  const v = E.viewFor(s, 0); assert(v.opp.heroPower && v.opp.heroPower.passive, '화면에도 지속 능력으로 보임');
}
{ // 사용형 능력 → 버튼으로 쓸 수 있음
  const g = POOL.find(x => x.kind === 'active' && x.id === 'ironLegion');
  let s = game({ pool: [g] }); s = hitBossTo(s, 15).state;
  assert(s.seats[1].bossPower && s.seats[1].bossPower.active && s.seats[1].bossPower.cost === 2);
}
{ // 일반 영웅 능력 → 바뀜, 지금과 같은 능력은 뽑지 않음
  let s = game({ pool: only('hero') }); s = hitBossTo(s, 15).state;
  assert(s.seats[1].heroPower && s.seats[1].heroPower !== 'armorUp', '다른 영웅 능력으로 바뀜'); assert(!s.seats[1].bossPower);
}
{ // 앞서 얻은 치트는 영웅 능력이 바뀌어도 계속 켜짐 · 이미 켜진 치트는 다시 안 뽑힘
  const regen = POOL.find(x => x.kind === 'cheat' && x.id === 'regen'), hp = POOL.find(x => x.kind === 'hero' && x.id === 'steadyShot');
  let s = game({ pool: [regen, hp] });
  s = hitBossTo(s, 19).state; s = hitBossTo(s, 9).state; s = hitBossTo(s, 4).state;
  assert.strictEqual(s.seats[1].mods.regen, 2, '재생은 계속 켜짐');
  assert.strictEqual(s.seats[1].phaseGains.filter(g => g.id === 'regen').length, 1, '같은 치트는 한 번만');
}

// 5) 도중에 얻은 치트가 실제로 작동하는지 (영웅 일격: 보스 턴 시작마다 상대 영웅 피해)
{
  const burn = POOL.find(x => x.kind === 'cheat' && x.id === 'burn');
  let s = game({ pool: [burn] }); s = hitBossTo(s, 15).state;   // 플레이어 턴 종료 → 보스 턴 시작
  assert.strictEqual(s.seats[1].mods.burn, 1);
  const hp0 = s.seats[0].hp; s = E.apply(s, { type: 'END_TURN' }, s.turn).state; s = E.apply(s, { type: 'END_TURN' }, s.turn).state;
  assert(s.seats[0].hp < hp0, '도중에 얻은 영웅 일격이 다음 보스 턴부터 작동');
}

// 6) N수 선언: 덱이 비면 탈진 대신 전설·특급 카드
{
  let s = game({ unique: 'nsuDeclare' }); assert.strictEqual(s.seats[1].unique, 'nsuDeclare');
  s.seats[1].deck = []; s.seats[1].hand = []; const hp0 = s.seats[1].hp;
  const r = E.apply(s, { type: 'END_TURN' }, s.turn); s = r.state;   // 보스 턴 시작 → 1장 뽑기
  assert.strictEqual(s.seats[1].fatigue || 0, 0, '탈진 없음'); assert(s.seats[1].hp >= hp0, '탈진 피해 없음');
  const got = r.events.find(e => e.type === 'generated' && e.src && e.src.name === 'N수 선언');
  assert(got, 'N수 선언 이벤트'); const c = s.seats[1].hand.find(x => x.name === got.name);
  assert(c && (c.rarity === '전설' || c.rarity === '특급'), '전설·특급 카드'); assert(!c.scope || c.scope === 'normal', '일반 카드 풀');
  assert(E.NSU_POOL().length > 50, '후보 약 90종');
}
{ // 고유 능력이 없으면 원래대로 탈진
  let s = game(); s.seats[1].deck = []; const r = E.apply(s, { type: 'END_TURN' }, s.turn);
  assert(r.events.some(e => e.type === 'fatigue' && e.seat === 1), '고유 능력 없으면 탈진');
}
{ // 손패가 가득이면 소각
  let s = game({ unique: 'nsuDeclare' }); s.seats[1].deck = []; while (s.seats[1].hand.length < E.CONFIG.MAX_HAND) s.seats[1].hand.push({ type: 'spell', name: '동전', cost: 0, effect: { type: 'mana', value: 1 }, id: s.nextId++ });
  const r = E.apply(s, { type: 'END_TURN' }, s.turn); const g = r.events.find(e => e.type === 'generated' && e.src && e.src.name === 'N수 선언');
  assert(g && g.burned, '손패 가득 → 소각');
}

// 7) 보스 데이터: 고유 능력 정리 (옛 데이터의 수능 보스는 기본 N수 선언, 끈 것은 그대로)
assert.deepStrictEqual(C.cleanUnique({ id: 'ynu_suneung' }), { unique: 'nsuDeclare' });
assert.deepStrictEqual(C.cleanUnique({ id: 'ynu_suneung', unique: '' }), { unique: '' });
assert.deepStrictEqual(C.cleanUnique({ id: 'ynu_1', unique: 'nsuDeclare' }), { unique: 'nsuDeclare' });
assert.deepStrictEqual(C.cleanUnique({ id: 'ynu_1', unique: 'hack' }), { unique: '' });

// 8) 봇끼리 끝까지 (페이즈 + N수 선언이 켜진 채 오류 없이 끝나는지)
{
  const { BotPlayers } = E; let done = 0;
  for (let k = 0; k < 20; k++) {
    let s = game({ unique: 'nsuDeclare' }); let n = 0;
    while (!s.over && n++ < 600) {
      const seat = s.pending ? s.pending.seat : s.turn; const a = BotPlayers.rule2.decide(E.viewFor(s, seat));
      let r = E.apply(s, a, seat); if (!r.ok) r = E.apply(s, { type: 'END_TURN' }, seat); assert(r.ok, '행동 실패: ' + r.error); s = r.state;
    }
    assert(s.over, '끝까지 진행'); done++;
  }
  console.log('봇 대전', done, '판 OK');
}
// v170 수능 보스가 실제로 쓰는 후보: 등급표(최상·상·중급) 27개만, 영웅 능력(신병 소집 등)은 없음, 고르게 뽑힘
{
  const PP = C.phasePickPool();
  assert.strictEqual(PP.length, 27);
  assert(!PP.some(g => g.kind === 'hero'), '영웅 능력은 후보 아님');
  assert(PP.some(g => g.kind === 'active' && g.id === 'gambler') && PP.some(g => g.kind === 'cheat' && g.id === 'manaBonus'));
  const seen = new Set();
  for (let i = 0; i < 300; i++) { let s = game({ pool: PP }); s = hitBossTo(s, 19).state; seen.add(s.seats[1].phaseGains[0].kind + ':' + s.seats[1].phaseGains[0].id); }
  assert(seen.size >= 20, '여러 가지가 고르게 나옴: ' + seen.size);
  assert([...seen].every(k => C.PHASE_PICK.has(k)));
}
console.log('test-phases OK');
