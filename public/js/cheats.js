// Node(서버)에서는 엔진의 CONFIG 를 전역에 올려 둔다 (브라우저에서는 engine.js 가 먼저 로드되어 이미 전역이다)
if (typeof module !== 'undefined' && typeof require === 'function' && typeof CONFIG === 'undefined') { globalThis.CONFIG = require('./engine.js').CONFIG; }
const CHEAT_TIERS = {            // 배당% → 치트 개수. v98: 치트 값은 모두 고정(켜짐/꺼짐)이고, 난이도는 '몇 개 받느냐'로만 조절한다. (level 은 항상 0)
  150:{count:0, level:-1},
  200:{count:1, level:0},
  300:{count:2, level:0},
  400:{count:3, level:0},
  500:{count:5, level:0},
};
const CHEATS = [   // v98: 값 하나짜리 켜짐/꺼짐 치트. minTier 로 센 치트가 낮은 배당에 뜨지 않게 막는다. group 이 같으면 하나만 뽑는다.
  {id:'hp',              icon:'❤️', name:'강인한 영웅',   minTier:200, levels:[30],    desc:v=>`영웅 체력 +${v}`},
  {id:'startMana',       icon:'💧', name:'앞선 출발',     minTier:200, levels:[3],     desc:v=>`첫 턴부터 마나 ${v}`,          group:'economy'},
  {id:'manaBonus',       icon:'⛲', name:'마력의 샘',     minTier:200, levels:[1],     desc:v=>`매 턴 마나 +${v}`,             group:'economy'},
  {id:'costDown',        icon:'🏷️', name:'값싼 병력',     minTier:200, levels:[1],     desc:v=>`덱의 하수인 비용 −${v}`,        group:'discount'},
  {id:'firstMinion',     icon:'🎟️', name:'무료 입장',     minTier:300, levels:[2],     desc:v=>`매 턴 처음 내는 하수인 비용 −${v}`, group:'discount'},
  {id:'spellDown',       icon:'📜', name:'주문 할인',     minTier:300, levels:[1],     desc:v=>`주문 비용 −${v} (생명력 주문·동전 제외)`},
  {id:'refund',          icon:'🔄', name:'마나 환급',     minTier:300, levels:[0.3],   desc:v=>`하수인을 낼 때마다 ${Math.round(v*100)}% 확률로 마나 1 환급`},
  {id:'startHand',       icon:'🃏', name:'풍부한 손패',   minTier:200, levels:[2],     desc:v=>`시작 손패 +${v}장 (최대 ${CONFIG.START_HAND_MAX}장)`, group:'draw'},
  {id:'extraDraw',       icon:'📖', name:'속독',          minTier:300, levels:[2],     desc:v=>`첫 ${v}턴 동안 매 턴 카드 2장 뽑기`, group:'draw'},   // 값은 지속 턴 수
  {id:'noFatigue',       icon:'🌙', name:'피로 면역',     minTier:300, levels:[true],  desc:()=>'덱이 비어도 탈진 피해를 받지 않는다'},
  {id:'startBoard',      icon:'⚔️', name:'선발대',        minTier:200, levels:[2],     desc:v=>`시작 필드에 보초병(1/2) ${v}기`},
  {id:'buff',            icon:'💪', name:'튼튼한 병력',   minTier:300, levels:[1],     desc:v=>`소환되는 하수인 체력 +${v}`},
  {id:'atkUp',           icon:'🔥', name:'맹공',          minTier:300, levels:[1],     desc:v=>`소환되는 하수인 공격력 +${v}`},
  {id:'shieldAll',       icon:'🔰', name:'강철 갑옷',     minTier:400, levels:[true],  desc:()=>'소환되는 하수인이 보호막을 가진다'},
  {id:'chargeAll',       icon:'🐎', name:'돌진 부대',     minTier:400, levels:[true],  desc:()=>'소환되는 하수인이 돌진을 가진다 (낸 턴에 바로 영웅 공격 가능)'},
  {id:'legion',          icon:'🛡️', name:'군단',          minTier:300, levels:[1],     desc:v=>`하수인을 낼 때 1/1 「병사」 ${v}기를 함께 소환 (빈 자리가 있을 때)`},
  {id:'reinforce',       icon:'📨', name:'후속 지원',     minTier:300, levels:[true],  desc:()=>'내 하수인이 죽으면 그 카드의 복사본 1장을 손패로 (턴당 1회)'},
  {id:'armor',           icon:'🪨', name:'강철 피부',     minTier:200, levels:[1],     desc:v=>`영웅이 받는 피해 −${v}`},
  {id:'thorns',          icon:'🌵', name:'가시 갑옷',     minTier:300, levels:[1],     desc:v=>`내 영웅을 공격한 하수인이 ${v} 피해를 입는다`},
  {id:'regen',           icon:'🌿', name:'재생',          minTier:300, levels:[2],     desc:v=>`내 턴 시작마다 영웅 체력 +${v}`},
  {id:'burn',            icon:'☄️', name:'영웅 일격',     minTier:400, levels:[1],     desc:v=>`내 턴 시작마다 상대 영웅에게 ${v} 피해 (첫 턴 제외)`},
  {id:'phoenix',         icon:'🕊️', name:'불굴',          minTier:500, levels:[10],    desc:v=>`영웅이 쓰러지면 1회 한정으로 체력 ${v}(으)로 부활`},
  {id:'startArmor',      icon:'🧱', name:'방어도 시작',   minTier:200, levels:[4],     desc:v=>`시작부터 방어도 ${v}`},
  {id:'handUp',          icon:'📚', name:'도서관',        minTier:200, levels:[2],     desc:v=>`손패 상한 +${v}장 (소각이 줄어든다)`},
  {id:'bloodHeal',       icon:'🩸', name:'혈기 가속',     minTier:300, levels:[1],     desc:v=>`혈기 룬 카드를 낼 때마다 영웅 체력 +${v}`},
  {id:'frostArmor',      icon:'❄️', name:'냉기 갑옷',     minTier:300, levels:[1],     desc:v=>`냉기 룬 카드를 낼 때마다 방어도 +${v}`},
  {id:'unholyCorpse',    icon:'💀', name:'부정한 부활',   minTier:300, levels:[1],     desc:v=>`부정 룬 카드를 낼 때마다 시체 +${v}`},
  {id:'spellCopy',       icon:'🪞', name:'카드 복사',     minTier:400, levels:[true],  desc:()=>'매 턴 처음 쓰는 주문의 복사본 1장을 손패로 (가득 차면 소각)'},
  {id:'doubleBattlecry', icon:'🔁', name:'메아리',        minTier:400, levels:[true],  desc:()=>'전투의 함성이 두 번 발동'},
  // ---- v162 보스 전용 (배팅 판에는 나오지 않음). global = 양쪽 모두에게 적용되는 규칙, active = 보스 영웅 능력으로 '사용형'이 가능 (기본 비용) ----
  {id:'drCopy',        icon:'👻', name:'메아리 군단',        bossOnly:true, levels:[1], range:[1,3],  desc:v=>`죽음의 메아리 하수인을 낼 때마다 1/1 복사본 ${v}기를 소환 (능력 유지)`},
  {id:'drRevive',      icon:'⚰️', name:'죽지 않는 자의 무덤', bossOnly:true, levels:[true],            desc:()=>'죽음의 메아리 하수인을 낼 때마다 환생 부여'},
  {id:'bcDrawCopy',    icon:'📣', name:'함성의 잔향',        bossOnly:true, levels:[1], range:[1,3],  desc:v=>`전투의 함성 하수인을 뽑을 때마다 1/1 복사본 ${v}장을 손으로 (능력 유지)`},
  {id:'infiniteLoop',  icon:'♾️', name:'무한 굴레',          bossOnly:true, levels:[1], range:[1,3],  desc:v=>`주문을 쓸 때마다 무작위 하수인 ${v}장을, 하수인을 낼 때마다 무작위 주문 ${v}장을 손으로`},
  {id:'rommath',       icon:'📜', name:'학자 롬메스의 두루마리', bossOnly:true, levels:[1], range:[1,5], desc:v=>`처음 덱에 없던 카드의 비용이 (${v}) 감소 (게임 내내)`},
  {id:'youMe',         icon:'🤝', name:'너도? 나도?',        bossOnly:true, global:true, levels:[true], desc:()=>'[양쪽] 각 영웅이 발견한 뒤, 고르지 않은 카드들을 상대에게 줍니다'},
  {id:'recycle',       icon:'♻️', name:'재사용하기',          bossOnly:true, levels:[1], range:[1,10], desc:v=>`아군 하수인이 죽은 뒤 방어도 +${v}`},
  {id:'recycle2',      icon:'♻️', name:'재사용하기 (상급)',   bossOnly:true, levels:[1], range:[1,10], desc:v=>`하수인이 죽은 뒤 방어도 +${v}. 하수인이 죽을 때마다 강화됩니다`},   // 실제로는 적 하수인이 죽어도 발동 (설명에는 적지 않음)
  {id:'spellOverload', icon:'⚡', name:'주문 과부하',        bossOnly:true, levels:[1], range:[0,10], desc:v=>`내 주문의 비용이 (${v})이 됩니다. 주문을 시전한 뒤 과부하 (1)`},
  {id:'spellFive',     icon:'🔮', name:'균일가 주문',        bossOnly:true, global:true, levels:[5], range:[0,10], desc:v=>`[양쪽] 모든 주문의 비용이 (${v})이 됩니다 (동전 제외)`},
  {id:'bloodToll',     icon:'🩸', name:'피의 통행료',        bossOnly:true, global:true, levels:[true], desc:()=>'[양쪽] 하수인을 낸 뒤 그 비용만큼 자기 영웅이 피해를 입습니다 (방어도가 먼저 막음)'},
  {id:'graveKeeper',   icon:'🪦', name:'무덤지기',           bossOnly:true, levels:[1], range:[1,3],  active:{cost:2, text:v=>`이번 게임에서 죽은 내 하수인 ${v}기를 되살립니다`}, desc:v=>`내 턴 시작마다 이번 게임에서 죽은 내 하수인 ${v}기를 되살립니다`},
  {id:'ironLegion',    icon:'🏰', name:'철벽 군단',          bossOnly:true, levels:[true],            active:{cost:2, text:()=>'지금 내 하수인 모두에게 도발 부여'}, desc:()=>'내 하수인이 모두 도발을 가집니다'},
  {id:'gambler',       icon:'🎰', name:'도박사의 손',        bossOnly:true, levels:[1], range:[1,3],  active:{cost:2, text:v=>`손패의 무작위 카드 ${v}장의 비용이 (0)이 됩니다`}, desc:v=>`내 턴 시작마다 손패의 무작위 카드 ${v}장의 비용이 (0)이 됩니다`},
  {id:'mirror',        icon:'🪞', name:'거울의 방',          bossOnly:true, levels:[true],            desc:()=>'상대가 주문을 쓰면 그 복사본을 내 손으로 가져옵니다'},
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

if (typeof module !== 'undefined') { module.exports = { CHEAT_TIERS, CHEATS, cheatValue, cheatCandidates, rollCheats, cheatRange, cheatValueFor, cleanCheatVals, cleanBossPower, bossPowerOf }; }
