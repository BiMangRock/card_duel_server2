// Node(서버)에서는 엔진의 CONFIG 를 전역에 올려 둔다 (브라우저에서는 engine.js 가 먼저 로드되어 이미 전역이다)
if (typeof module !== 'undefined' && typeof require === 'function' && typeof CONFIG === 'undefined') { globalThis.CONFIG = require('./engine.js').CONFIG; }
// v164 숫자 뒤 조사: 숫자를 한국어로 읽은 끝소리로 고른다 (일·삼·육·칠·팔·십·영 = 받침 / 이·사·오·구 = 받침 없음)
const numLast = n => { const d=String(n).replace(/[^0-9]/g,''); return d.slice(-1) || '0'; };
const ga = n => '013678'.includes(numLast(n)) ? '이' : '가';            // (5)가 · (3)이
const ro = n => '036'.includes(numLast(n)) ? '으로' : '로';             // 10으로 · 3으로 · 6으로 · 4로 · 1로·7로·8로(ㄹ 받침)
const CHEAT_TIERS = {            // 배당% → 치트 개수. v98: 치트 값은 모두 고정(켜짐/꺼짐)이고, 난이도는 '몇 개 받느냐'로만 조절한다. (level 은 항상 0)
  150:{count:0, level:-1},
  200:{count:1, level:0},
  300:{count:2, level:0},
  400:{count:3, level:0},
  500:{count:5, level:0},
};
const CHEATS = [   // v98: 값 하나짜리 켜짐/꺼짐 치트. minTier 로 센 치트가 낮은 배당에 뜨지 않게 막는다. group 이 같으면 하나만 뽑는다.
  {id:'hp',              icon:'❤️', name:'강인한 영웅',   minTier:200, levels:[30],    desc:v=>`영웅의 체력이 ${v} 늘어납니다`},
  {id:'startMana',       icon:'💧', name:'앞선 출발',     minTier:200, levels:[3],     desc:v=>`첫 턴부터 마나 ${v}${ro(v)} 시작합니다`,          group:'economy'},
  {id:'manaBonus',       icon:'⛲', name:'마력의 샘',     minTier:200, levels:[1],     desc:v=>`매 턴 마나를 ${v} 더 얻습니다`,             group:'economy'},
  {id:'costDown',        icon:'🏷️', name:'값싼 병력',     minTier:200, levels:[1],     desc:v=>`덱에 있는 하수인의 비용이 (${v}) 줄어듭니다`,        group:'discount'},
  {id:'firstMinion',     icon:'🎟️', name:'무료 입장',     minTier:300, levels:[2],     desc:v=>`매 턴 처음 내는 하수인의 비용이 (${v}) 줄어듭니다`, group:'discount'},
  {id:'spellDown',       icon:'📜', name:'주문 할인',     minTier:300, levels:[1],     desc:v=>`주문의 비용이 (${v}) 줄어듭니다. 생명력으로 내는 주문과 동전은 제외합니다`},
  {id:'refund',          icon:'🔄', name:'마나 환급',     minTier:300, levels:[0.3],   desc:v=>`하수인을 낼 때마다 ${Math.round(v*100)}% 확률로 마나 1을 돌려받습니다`},
  {id:'startHand',       icon:'🃏', name:'풍부한 손패',   minTier:200, levels:[2],     desc:v=>`시작 손패를 ${v}장 더 받습니다. 최대 ${CONFIG.START_HAND_MAX}장까지입니다`, group:'draw'},
  {id:'extraDraw',       icon:'📖', name:'속독',          minTier:300, levels:[2],     desc:v=>`첫 ${v}턴 동안 매 턴 카드를 2장씩 뽑습니다`, group:'draw'},   // 값은 지속 턴 수
  {id:'noFatigue',       icon:'🌙', name:'피로 면역',     minTier:300, levels:[true],  desc:()=>'덱이 비어도 탈진 피해를 받지 않습니다'},
  {id:'startBoard',      icon:'⚔️', name:'선발대',        minTier:200, levels:[2],     desc:v=>`보초병(1/2) ${v}기를 전장에 두고 시작합니다`},
  {id:'buff',            icon:'💪', name:'튼튼한 병력',   minTier:300, levels:[1],     desc:v=>`소환되는 하수인의 체력이 ${v} 늘어납니다`},
  {id:'atkUp',           icon:'🔥', name:'맹공',          minTier:300, levels:[1],     desc:v=>`소환되는 하수인의 공격력이 ${v} 늘어납니다`},
  {id:'shieldAll',       icon:'🔰', name:'강철 갑옷',     minTier:400, levels:[true],  desc:()=>'소환되는 하수인이 보호막을 가집니다'},
  {id:'chargeAll',       icon:'🐎', name:'돌진 부대',     minTier:400, levels:[true],  desc:()=>'소환되는 하수인이 돌진을 가집니다. 낸 턴에 바로 영웅을 공격할 수 있습니다'},
  {id:'legion',          icon:'🛡️', name:'군단',          minTier:300, levels:[1],     desc:v=>`하수인을 낼 때 1/1 「병사」 ${v}기를 함께 소환합니다. 전장에 빈 자리가 있을 때만 소환됩니다`},
  {id:'reinforce',       icon:'📨', name:'후속 지원',     minTier:300, levels:[true],  desc:()=>'내 하수인이 죽으면 그 카드의 복사본 1장을 손패로 가져옵니다. 턴마다 한 번만 발동합니다'},
  {id:'armor',           icon:'🪨', name:'강철 피부',     minTier:200, levels:[1],     desc:v=>`영웅이 받는 피해가 ${v} 줄어듭니다`},
  {id:'thorns',          icon:'🌵', name:'가시 갑옷',     minTier:300, levels:[1],     desc:v=>`내 영웅을 공격한 하수인이 ${v} 피해를 입습니다`},
  {id:'regen',           icon:'🌿', name:'재생',          minTier:300, levels:[2],     desc:v=>`내 턴이 시작될 때마다 영웅의 체력을 ${v} 회복합니다`},
  {id:'burn',            icon:'☄️', name:'영웅 일격',     minTier:400, levels:[1],     desc:v=>`내 턴이 시작될 때마다 상대 영웅에게 ${v} 피해를 줍니다. 첫 턴에는 발동하지 않습니다`},
  {id:'phoenix',         icon:'🕊️', name:'불굴',          minTier:500, levels:[10],    desc:v=>`영웅이 쓰러지면 한 번만 체력 ${v}${ro(v)} 되살아납니다`},
  {id:'startArmor',      icon:'🧱', name:'방어도 시작',   minTier:200, levels:[4],     desc:v=>`방어도 ${v}${ro(v)} 시작합니다`},
  {id:'handUp',          icon:'📚', name:'도서관',        minTier:200, levels:[2],     desc:v=>`손패를 ${v}장 더 들 수 있어 카드가 덜 소각됩니다`},
  {id:'bloodHeal',       icon:'🩸', name:'혈기 가속',     minTier:300, levels:[1],     desc:v=>`혈기 룬 카드를 낼 때마다 영웅의 체력을 ${v} 회복합니다`},
  {id:'frostArmor',      icon:'❄️', name:'냉기 갑옷',     minTier:300, levels:[1],     desc:v=>`냉기 룬 카드를 낼 때마다 방어도를 ${v} 얻습니다`},
  {id:'unholyCorpse',    icon:'💀', name:'부정한 부활',   minTier:300, levels:[1],     desc:v=>`부정 룬 카드를 낼 때마다 시체를 ${v} 얻습니다`},
  {id:'spellCopy',       icon:'🪞', name:'카드 복사',     minTier:400, levels:[true],  desc:()=>'매 턴 처음 쓰는 주문의 복사본 1장을 손패로 가져옵니다. 손패가 가득 차 있으면 소각됩니다'},
  {id:'doubleBattlecry', icon:'🔁', name:'메아리',        minTier:400, levels:[true],  desc:()=>'전투의 함성이 두 번 발동합니다'},
  // ---- v162 보스 전용 (배팅 판에는 나오지 않음). global = 양쪽 모두에게 적용되는 규칙, active = 보스 영웅 능력으로 '사용형'이 가능 (기본 비용) ----
  {id:'drCopy',        icon:'👻', name:'메아리 군단',        bossOnly:true, levels:[1], range:[1,3],  desc:v=>`죽음의 메아리 하수인을 낼 때마다 1/1 복사본 ${v}기를 함께 소환합니다. 복사본도 같은 능력을 가집니다`},
  {id:'drRevive',      icon:'⚰️', name:'죽지 않는 자의 무덤', bossOnly:true, levels:[true],            desc:()=>'죽음의 메아리 하수인을 낼 때마다 그 하수인에게 환생을 부여합니다'},
  {id:'bcDrawCopy',    icon:'📣', name:'함성의 잔향',        bossOnly:true, levels:[1], range:[1,3],  desc:v=>`전투의 함성 하수인을 뽑을 때마다 1/1 복사본 ${v}장을 손패로 가져옵니다. 복사본도 같은 능력을 가집니다`},
  {id:'infiniteLoop',  icon:'♾️', name:'무한 굴레',          bossOnly:true, levels:[1], range:[1,3],  desc:v=>`주문을 쓸 때마다 무작위 하수인 ${v}장을, 하수인을 낼 때마다 무작위 주문 ${v}장을 손패로 가져옵니다`},
  {id:'rommath',       icon:'📜', name:'학자 롬메스의 두루마리', bossOnly:true, levels:[1], range:[1,5], desc:v=>`처음 덱에 없던 카드의 비용이 (${v}) 줄어듭니다. 게임이 끝날 때까지 유지됩니다`},
  {id:'youMe',         icon:'🤝', name:'너도? 나도?',        bossOnly:true, global:true, levels:[true], desc:()=>'[양쪽] 각 영웅이 발견한 뒤, 고르지 않은 카드들을 상대에게 줍니다'},
  {id:'recycle',       icon:'♻️', name:'재사용하기',          bossOnly:true, levels:[1], range:[1,10], desc:v=>`아군 하수인이 죽을 때마다 방어도를 ${v} 얻습니다`},
  {id:'recycle2',      icon:'♻️', name:'재사용하기 (상급)',   bossOnly:true, levels:[1], range:[1,10], desc:v=>`하수인이 죽을 때마다 방어도를 ${v} 얻습니다. 하수인이 죽을 때마다 얻는 방어도가 1씩 늘어납니다`},   // 실제로는 적 하수인이 죽어도 발동 (설명에는 적지 않음)
  {id:'spellOverload', icon:'⚡', name:'주문 과부하',        bossOnly:true, levels:[1], range:[0,10], desc:v=>`내 주문의 비용이 (${v})${ga(v)} 됩니다. 주문을 쓰면 다음 턴에 과부하 (1)이 걸립니다`},
  {id:'spellFive',     icon:'🔮', name:'균일가 주문',        bossOnly:true, global:true, levels:[5], range:[0,10], desc:v=>`[양쪽] 모든 주문의 비용이 (${v})${ga(v)} 됩니다. 동전은 제외합니다`},
  {id:'bloodToll',     icon:'🩸', name:'피의 통행료',        bossOnly:true, global:true, levels:[true], desc:()=>'[양쪽] 하수인을 내면 그 비용만큼 자기 영웅이 피해를 입습니다. 방어도가 먼저 막아 줍니다'},
  {id:'graveKeeper',   icon:'🪦', name:'무덤지기',           bossOnly:true, levels:[1], range:[1,3],  active:{cost:2, text:v=>`이번 게임에서 죽은 내 하수인 ${v}기를 되살립니다`}, desc:v=>`내 턴이 시작될 때마다 이번 게임에서 죽은 내 하수인 ${v}기를 되살립니다`},
  {id:'ironLegion',    icon:'🏰', name:'철벽 군단',          bossOnly:true, levels:[true],            active:{cost:2, text:()=>'지금 내 하수인 모두에게 도발을 부여합니다'}, desc:()=>'내 하수인이 모두 도발을 가집니다'},
  {id:'gambler',       icon:'🎰', name:'도박사의 손',        bossOnly:true, levels:[1], range:[1,3],  active:{cost:2, text:v=>`손패의 무작위 카드 ${v}장의 비용이 (0)이 됩니다`}, desc:v=>`내 턴이 시작될 때마다 손패의 무작위 카드 ${v}장의 비용이 (0)이 됩니다`},
  {id:'mirror',        icon:'🪞', name:'거울의 방',          bossOnly:true, levels:[true],            desc:()=>'상대가 주문을 쓰면 그 복사본을 내 손패로 가져옵니다'},
  {id:'bloodPact',     icon:'🩸', name:'피의 계약',          bossOnly:true, levels:[true],            desc:()=>'마나가 모자라면 부족한 만큼 생명력으로 대신 냅니다'},
];
// v162 보스 편집 화면의 ▲▼ 범위 (기존 치트). [최소, 최대, 단위]. 켜짐/꺼짐 치트(true)는 범위 없음
const CHEAT_RANGE = {hp:[5,100,5], startMana:[1,10,1], manaBonus:[1,5,1], costDown:[1,5,1], firstMinion:[1,10,1], spellDown:[1,5,1], refund:[0.1,1,0.1],
  startHand:[1,5,1], extraDraw:[1,30,1], startBoard:[1,7,1], buff:[1,10,1], atkUp:[1,10,1], legion:[1,3,1], armor:[1,5,1], thorns:[1,10,1], regen:[1,10,1],
  burn:[1,10,1], phoenix:[1,60,1], startArmor:[1,50,1], handUp:[1,10,1], bloodHeal:[1,5,1], frostArmor:[1,5,1], unholyCorpse:[1,5,1]};
// ---- v162 보스 데이터 정리 (브라우저 BossBook.clean 과 서버 bosses.js 가 같이 쓴다) ----
// cheatVals: {치트 id: 수치} — 숫자 치트만, 범위 안으로
function cleanCheatVals(v){ const out={}; if(!v || typeof v!=='object') return out;
  for(const c of CHEATS){ if(!(c.id in v) || !cheatRange(c)) continue; out[c.id]=cheatValueFor(c, v); } return out; }
// 보스 영웅 능력 = 'cheat:<치트 id>' 이면 powerMode('passive' | 'active', 사용형이 있는 치트만 active) · powerCost(0~10) 를 정리해서 돌려준다
function cleanBossPower(b){ const m=/^cheat:([A-Za-z0-9_]+)$/.exec(String((b && b.heroPower) || '')), c=m && CHEATS.find(x=>x.id===m[1]);
  if(!c) return null;
  const active=b.powerMode==='active' && !!c.active, cost=Number(b.powerCost);
  return {heroPower:'cheat:'+c.id, powerMode:active?'active':'passive', powerCost:active ? Math.max(0, Math.min(10, Math.floor(isFinite(cost) && b.powerCost!=='' && b.powerCost!=null ? cost : c.active.cost))) : 0}; }
// 보스 → 엔진의 bossPowers 한 칸 {id, value, active, cost, name, icon, text} (영웅 능력이 치트가 아니면 null)
function bossPowerOf(b){ const p=cleanBossPower(b); if(!p) return null; const c=CHEATS.find(x=>'cheat:'+x.id===p.heroPower), v=cheatValueFor(c, b.cheatVals), active=p.powerMode==='active';
  return {id:c.id, value:v, active, cost:p.powerCost, name:c.name, icon:c.icon||'✦', text:active ? c.active.text(v) : c.desc(v)}; }
// → [최소, 최대, 단위] 또는 null(숫자가 없는 치트)
function cheatRange(c){ if(!c || typeof c.levels[0]!=='number') return null; if(c.range) return [c.range[0], c.range[1], c.range[2]||1]; return CHEAT_RANGE[c.id] || [1, Math.max(10, c.levels[0]*5), 1]; }
// 보스가 정한 값(vals[id])을 범위 안으로. 없거나 이상하면 기본값
function cheatValueFor(c, vals){
  const def=cheatValue(c,0), r=cheatRange(c); if(!r) return def;
  const v=Number(vals && vals[c.id]); if(!isFinite(v)) return def;
  const k=Math.round((Math.min(r[1], Math.max(r[0], v))-r[0])/r[2]); return Math.round((r[0]+k*r[2])*1000)/1000;
}
const cheatValue = (c, level) => c.levels[Math.min(Math.max(level,0), c.levels.length-1)];
function cheatCandidates(tier){
  const t=CHEAT_TIERS[tier]; if(!t || t.count<=0) return [];
  return CHEATS.filter(c=>!c.bossOnly && c.minTier<=tier).map(c=>{ const v=cheatValue(c, t.level); return {id:c.id, icon:c.icon||'', name:c.name, value:v, desc:c.desc(v), group:c.group||null}; });
}
// → {mods:{...}, list:[{id,name,desc}]}
function rollCheats(tier, rng=Math.random){
  const t=CHEAT_TIERS[tier], out={mods:{}, list:[]};
  if(!t || t.count<=0) return out;
  const pool=cheatCandidates(tier);
  for(let i=pool.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
  const usedGroups=new Set();
  for(const c of pool){
    if(out.list.length>=t.count) break;
    if(c.group && usedGroups.has(c.group)) continue;
    if(c.group) usedGroups.add(c.group);
    out.mods[c.id]=c.value; out.list.push({id:c.id, icon:c.icon, name:c.name, desc:c.desc});
  }
  return out;
}

// ---- v166 보스 페이즈에서 얻을 수 있는 것 (엔진 newGame 의 opts.phases[좌석].pool) ----
//  게임 도중에 넣으면 아무 효과가 없는 '시작할 때만' 치트, 룬 치트(룬 카드가 없는 보스 덱), N수 선언과 겹치는 피로 면역은 뺀다
const PHASE_EXCLUDE = new Set(['hp', 'startMana', 'startHand', 'startBoard', 'startArmor', 'costDown', 'extraDraw', 'bloodHeal', 'frostArmor', 'unholyCorpse', 'noFatigue']);
function phaseGainPool(){
  const E = (typeof HERO_POWERS !== 'undefined') ? { HERO_POWERS, HERO_POWER_IDS, HP_COST } : require('./engine.js');
  const out = [];
  for (const id of E.HERO_POWER_IDS) { const h = E.HERO_POWERS[id]; out.push({ kind: 'hero', id, name: h.name, icon: h.icon, text: h.text, cost: E.HP_COST }); }
  for (const c of CHEATS) {
    const v = cheatValue(c, 0);
    if (c.active) out.push({ kind: 'active', id: c.id, value: v, cost: c.active.cost, name: c.name, icon: c.icon || '✦', text: c.active.text(v) });
    if (!PHASE_EXCLUDE.has(c.id)) out.push({ kind: 'cheat', id: c.id, value: v, name: c.name, icon: c.icon || '✦', text: c.desc(v), global: !!c.global });
  }
  return out;
}
// v170 수능 보스가 폭주할 때 실제로 뽑는 후보 (등급표의 최상급·상급·중급만 — 「신병 소집」처럼 보스에게 도움 안 되는 건 뺀다)
//   사용형: 무덤지기 · 도박사의 손 / 지속(비용 없음): 아래 목록. 이 중에서 똑같은 확률로 하나
const PHASE_PICK = new Set([
  'active:graveKeeper', 'active:gambler',
  'cheat:manaBonus', 'cheat:spellOverload', 'cheat:spellCopy', 'cheat:gambler', 'cheat:graveKeeper',                                  // 최상급
  'cheat:spellDown', 'cheat:mirror', 'cheat:infiniteLoop', 'cheat:burn', 'cheat:shieldAll', 'cheat:chargeAll', 'cheat:phoenix',     // 상급
  'cheat:regen', 'cheat:armor', 'cheat:firstMinion', 'cheat:legion', 'cheat:reinforce', 'cheat:buff', 'cheat:atkUp', 'cheat:doubleBattlecry',
  'cheat:rommath', 'cheat:recycle2', 'cheat:ironLegion', 'cheat:youMe', 'cheat:bloodPact',                                             // 중급
]);
const phasePickPool = () => phaseGainPool().filter(g => PHASE_PICK.has(g.kind + ':' + g.id));
// v166 보스 고유 능력 (보스 편집 화면). 값이 없던 옛 저장 데이터의 수능 보스는 N수 선언을 기본으로
const UNIQUE_LIST = [{ id: 'nsuDeclare', name: 'N수 선언', icon: '📚', text: '덱이 비면 탈진 피해 대신, 카드를 뽑을 때마다 무작위 전설·특급 카드를 얻습니다' }];
function cleanUnique(b){
  const u = b && b.unique;
  if (u === undefined || u === null) return { unique: (b && b.id === 'ynu_suneung') ? 'nsuDeclare' : '' };
  return { unique: UNIQUE_LIST.some(x => x.id === u) ? u : '' };
}
const uniqueOf = b => { const u = cleanUnique(b).unique; return UNIQUE_LIST.find(x => x.id === u) || null; };

if (typeof module !== 'undefined') { module.exports = { CHEAT_TIERS, CHEATS, cheatValue, cheatCandidates, rollCheats, cheatRange, cheatValueFor, cleanCheatVals, cleanBossPower, bossPowerOf, PHASE_EXCLUDE, phaseGainPool, PHASE_PICK, phasePickPool, UNIQUE_LIST, cleanUnique, uniqueOf }; }
