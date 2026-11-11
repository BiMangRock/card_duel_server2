// policy_v3.js — 학습 모델(v3) 추론. 학습 프로젝트(card_rl2)의 game\features3.js + game\rl_bot.js 를 브라우저용으로 옮긴 것 (v161)
//  - 계산은 학습 쪽과 한 글자도 다르지 않게 유지한다. 학습 쪽 features3.js / rl_bot.js 가 바뀌면 이 파일도 같이 고친다.
//  - 모델 종류: deep (DQN · Deep SARSA · PPO) / linear (몬테카를로 · SARSA)
//  - v3 는 영웅 능력(HERO_POWER)과 하수인 놓을 자리(pos)까지 모델이 직접 고른다
//  - 번호표: 아래 REG3_0 = 학습 쪽 game\card_registry.json. 학습 쪽 번호표가 바뀌면 보스 편집 화면의 [번호표 불러오기]로 새 파일을 넣는다
//  - 브라우저(ui.js 가 PolicyNetV3 로 씀) · Node(검증 스크립트: module.exports) 공용
(function(root){
  'use strict';
  const REG3_0 = {"caps":{"names":1024,"effs":512,"kws":384,"hps":32},"names":["들쥐","책벌레","은빛 신병","돌담 견습병","견습 검사","방패병","약초꾼","훈련 교관","빛나는 파수병","매의 눈 궁수","숲 늑대","화염 정령","부족의 주술사","수정 골렘","강철 파수대장","떠돌이 치유사","돌 골렘","용병대장","대지 정령","빛의 수호자","불사조","늙은 사자","벼락 마법사","시간의 마법사","서리 거인","폭풍 부르는 자","심판관","고대 용","고대의 수호룡","날쌘 척후병","대마법학자 롬메스","주문 직조사","회귀의 사서","유물 수집가","성소의 수습사제","명암의 사도","분열하는 점액","요그사론","대마법 보호막","탈란지의 최후의 저항","냉혹한 겨울","치유의 빛","침묵","불꽃 화살","지식의 서","수호의 장벽","급습","처형","불의 비","첫 번째 불꽃","매서운 한파","눈보라","냉기 돌풍","신비술사의 고서","주머니 차원","주문술사의 흐름","비전 수호자","서리","복제","강화","회수","변이","번개","화염구","대폭발","주문 발견","피의 서약","불꽃 점괘","사냥개 떼","철벽 소집","혼돈의 주문서","고대의 축복","숲의 지원군","일식","금단의 과일","번개 개화","생물학 프로젝트","대지의 비늘","급속 성장","등산용 간식","키틴질 껍질","퇴비 만들기","새로운 경지","숲의 영혼","야생의 포효","휘둘러치기","줄이기","흉포한 울음소리","대지의 수호","덱 탐색","공중활강","육성","딱정벌레술","숨겨진 오아시스","영원의 불화살","아달의 수호자","시간대 수선","가시가 돋친 탈것","분파","저지해라!","아마라의 이야기","데자뷔","번개 폭풍","뒤틀린 황천","일거리가 있다던데","물 공급지","적자생존","야생의 선물","궁극의 역병","퍼져나가는 역병","톨비르 대적","신비한 양초맨","되감기","극한 반복","박학다식","마나 흡수","열광의 덱","점화","얼음 회오리","초신성","은하계 투영 구슬","왕의 축복","망자 되살리기","방부 의식","유령 출몰","빛폭탄","영혼의 절규","패거리","소멸","파괴의 정기","선조의 부름","용의자 줄 세우기","방패 올리기","태양샘","교도소 마나스톰","대마법사 안토니다스","속임수 토템","대마법사 바르고스","로데브","노움 쩝쩝이","흉측한 허물","흡혈","피의 역병","공기 누출","혈기술사","마우와 파우","그훈","전장의 강령술사","소리치는 요들러","악성 공포물","어둠가시 바느질꾼","시체 폭발","피의 기록관 말라코르","거머리 어미 발토라","피의 소용돌이","시초자","분노의 여사제","신화의 공포","타락심장 심문관","고대의 공허 사냥개","원한 맺힌 소환사","가젯잔 경매인","비전 거인","엄폐","별 관측자","지저왕","지진발","하드로녹스","아비아나","티란투스","잊힌 왕 쿤","왕궁정원사","뱀사육사","공허의 영혼","카인 선퓨리","강철나무 골렘","여름의 평화수호자","늘푸른 수사슴","재생의 드루이드","토이란투스","날개 달린 수호자","독사 떼","실탄 장전","성게 가시","사스퀙","골드린","왕 크루쉬","밴조사우루스","에메리스","불꽃꼬리 전사","주문사수","깊은물 기원사","바르덴 던그래스프","요그사론의 종복","진눈깨비 스케이터","시프","회색 현자 앵무새","대규모 변이","용소환사 알라나","화염용","불굴의 토레스","태양지기 타림","성기사 에드릭","안녕극단","정신의 창조술사","세데크 장막직공","영혼 채찍","생각 훔치기","정신 분열","천상의 정신","대주교 베네딕투스","암흑의 정수","그훈의 피","흑요석 석상","대규모 부활","무덤괴수","칼날 부채","타르막","얼굴 수집가","소냐 워터댄서","엘프 음악가","무역왕 갤리윅스","전력 질주","환영의 물약","오메가 조립 시설","겁에 질린 조합원","용의 포효","대장군 분","앙심","다리우스 크롤리","대지조각가 이프","토르톨라","문제아","두억시니","해일","걸어 다니는 샘","눈사태 수호자","퇴화","불안정한 진화","깊은무쇠 트로그","교단 수련사","보석 박힌 딱정벌레","비겁한 밀고자","안녕로봇","데스윙","광염의 피락","해방된 분노 이샤라즈","허기진 포식자","부상당한 크발디르","부정한 알","불안정한 프로토타입","검 제작의 대가","공작 켈레세스","곰팡이술사","깔깔대는 발명가","기사대장","누더기골렘","공격대장","공중급수체","나무정령","지하군주","마력 깃든 까마귀","부화장 도우미","비명익룡 알","엘룬의 예언자","오늘의 월척","브롤 베어맨틀","그물거미","여명회 파수병","채광 사상자","평등","대사제 데칼","병력 소집","신의 은총","거품로봇","창심장 파수병","부두 토템","거대한 토템 아이스오르","불꽃의 토템","물 공급 토템","스테레오 토템","죄악석 토템","토템 골렘","돌장인","칼바람 폭풍소환사","바람의 군주 알아키르","다리 떠는 옆자리 수험생","훌쩍거리는 앞자리 (비염 빌런)","시험지 팍팍 넘기는 N수생","엄격한 복도 순찰 감독관","샤프심 똑 부러진 수능 샤프","체증을 유발하는 보온도시락","아랍어 로또 괴물 (5교시의 악령)","OMR 카드 밀려쓰기","4교시 탐구영역 응시 규정 위반","듣기평가 시간 비행기 소음 통제 실패","수정테이프 빌리기 (손들기)","가채점표 멘탈 붕괴","비문학 3연타 (철학+경제+양자역학)","종료령 5분 전 (마킹 타임어택)","물수능 컷 폭발","멘붕의 카페 알바생","야간 편의점 근무자","일당 15만 원의 유혹","불판 세척 특공대","마의 T자 코스","파격적인 탈색 3연타","안경 탈출 수술","헬스장 3개월 등록","방구석 통기타","청춘의 내일로 티켓","당당한 주민등록증","인생 첫 술","롤 다이아 승급전: 캐리 머신","PC방 30시간 올나잇 파티","봉인 해제: 무한 백수 라이프","F폭격기 교수님","발표 10분 전 잠수탄 조원","군기반장 복학생","수강신청 대참사와 8시간 우주공강","숙취 속 월요일 아침 9시 출석 체크","핫식스+레드불 붕붕드링크의 부작용","본가로 직배송된 학사경고 통지서","과잠 뽕에 취한 새내기","전공 벽에 부딪힌 2학년","영혼까지 갈려 나가는 사망년","츄리닝 삼디다스 취준 화석","입대 직전의 광기","독박 쓴 조장","전공 필수에서 마주친 전 CC","외계어 전공 강의","증원 요청 읍소 메일","21학점의 무리수","10년 만에 개편된 족보","후배의 밥약 공격","필름 끊긴 멋진 선배","지식 밑천 드러난 선배","입영 통지서","지독한 겜태기","어색해진 3대3 미팅","영혼 탈곡된 동아리 회장","출석 안 부르는 천사 교수님","PPT의 신 & 발표 장인","캠퍼스 명예 총장 길고양이","단골 술집 욕쟁이 이모님","과방 붙박이 만물상","의욕 넘치는 전역 복학생","과방 소파에서의 쪽잠","연구실의 군주 지도교수","수강신청 서버 대폭발","코딩테스트","지옥의 중간고사","조별과제 내부분열","SNS 속 동기들의 합격 수기","쇼츠 알고리즘","심각한 진로 방황","기사 자격증 시험","스트레스성 폭식","번아웃","카페인 과다복용","마감 효과","계절학기 재수강","학사경고장","두꺼운 수험서","3초만 더 보기","첫 연애!","꿀교양 줍줍","휴학","교환학생의 꿈","공모전 나가기","캠퍼스 잔디밭 돗자리","수강신청 올클","판 엎기: 자퇴서 제출","자취방의 거대 쓰레기 산","전과 / 편입 엑소더스","졸업 유예자 멍서스","황금 시간표","잔디밭 낮잠터","당당한 혼밥러, 키키","노련한 4학년 조장","교수님의 관용","캡스톤 걸작 메카","특허 출원된 조수 메카","소형 기계","무한동력 논문 발표!","아직 작동중!","서류 전형 합격!","최종 면접 올패스","마지막 벚꽃길","4학년","학사모 던지기","밤샘 종강 총회","캠퍼스의 신선, 판다렌 선배","어엿한 사회 초년생","학사모","졸업 사정회","수석 졸업생 발굽","학위수여식의 총장님"],"effs":["adalGuardian","adjBuffCry","adultId","advisorCry","airLeak","alana","alienLecture","amaraTale","ancestors","arcaneGuardian","arcaneTome","armorCry","ascend","avalancheFreeze","bcBlackKnight","bcCrystal","bcGameBore","bcPeek","bcSeniority","bcSilence","bcSilenceAdj","bcWipeOthers","benedictus","bleach","blindDate","blizzard","bloodDiscover","bloodDrain","bloodPlague","bloodSip","bloodVortex","bloom","bolt","bubbleCry","buff","bulletLoad","burnoutOne","caffeineOD","capFill","capToss","carapace","chaos","choice","cleave","codingTest","coldFront","comboDraw","compost","confuse","copy","copyDragons","corpseBlast","courseCrash","cover","crystal","crystalBuff","cutCrash","damage","damageDiscover","darkEssence","deathwing","decalCry","deckBuff","deckDiscover","destroyAll","destroyMinion","devolve","devour","discover","discoverCost","divineFavor","divineSpirit","docPass","doubleHand","dragonRoar","draw","drawDiscard","drawSpellArmor","dropOut","eclipse","edric","eggrollCry","electivePick","endParty","enemySweepDraw","energyDrink","enhance","enlist","enrollAll","equality","essence","eternalBolt","exchangeCry","execute","exodus","faceCollector","fanKnives","finalPass","firstFlame","firstLove","forestSoul","freeze","frenzyDeck","frostWarden","frostbite","fruit","furyCry","gadgetCry","gainMana","galaxyOrb","gang","gapSemester","giveShield","glide","goldenSchedule","gradReview","grantBuff","growth","grudge","guardian","gym","hackathon","handDiscover","hangover","haste","hatchCry","heal","healHoly","holdLine","iceTornado","ignite","illusionPotion","kuhn","laborRush","lasik","learned","leechSummon","lightBomb","lineUp","loopDiscover","lotto","machinesCry","malakor","manaDrain","manaOne","manastorm","massDeathSummonCost","massElusive","massEnhance","massRaise","massTransform","mealSteal","mentalBreak","mercyNext","mindBlast","mindCopy","mindSteal","mortarboard","muster","mutinyAll","naeilro","natureCast","neet","noSpellNext","notesRevamp","omegaFacility","omrSwap","originator","overCredit","parrot","pcbang","peaceDraw","picnicMat","pocketDimension","pptCry","probation","pyroar","rain","raiseDead","raiseShield","recall","recastLog","recycle","repeatAll","repeatLast","replayOne","resurrect","retake","revealSummon","rewind","roar","rookieCry","rushAllyCry","scale","scatter","seedDeck","selfHurt","serverCrash","shieldCry","shortsPeek","shrink","silence","sleetFreeze","snack","snitch","snsEnvy","sofaNap","soulScream","soulWhip","spellFlow","spellHunt","spellPoison","spellTax","spiritsCry","splitCopy","spreadPlague","stoneCry","stormCry","summon","sunwell","supernova","survival","sweep","tCourseBc","tapeHeal","tarim","tarmak","tauntDiscover","tauntDiscoverBc","textTriple","thornMount","timeMend","transform","ultPlague","upgradeMinion","valedictorian","valtora","vanishAll","voidSoul","warnNotice","wildGift","wipe","wormCry","yodel","yogg"],"kws":["shield","taunt","charge","revive","rush","deathCopy","deathGain","onAttackCopy","lifeCost","twin","overload","lifesteal","dynCost","onSpellFireball","endCast","elusive","endRecast","endAttack","leechBoost","endCorpses","startSpend","endRaise","endCopy","endScatter","endBait","spellAura","endSteal","onSpellDraw","spellburst","deathArmor","deathBuffAll","deathGrave","costOne","endLotus","endViper","ignoreTaunt","needArmor","reviveFull","hunter","beastDouble","onAttackBeast","onSpellScatter","endCastMin","mini","spellDmgSchools","shieldAura","deathMachines","spellWeave","endDeckCopy","deathKill","echo","sonya","gally","crowley","endArmorSummon","tortola","endBully","windfury","trogg","fireImmune","endDeckSummon","infuse","eggChicken","deathProto","endSword","deathAdjBuff","deathAoe","atkAura","deathSummon","lordGrow","deathPtero","pteroEgg","copyLow","fishHeal","onSpellBeast","deathBeast","endSpellGain","endTotemBuff","adjAtkAura","endAdjBuff","endHandBuff","endSelfHp","onAttackPing","endSniff","cardLimit","poison","deathPoisonShot","deathLunch","startCafe","onHurtDrunk","cantAttack","tCourse","endDecay","guitarLeft","killRefresh","ghostLeech","deathFace","onHurtHeal","startSelfHurt","deathCaffeine","stealth","hideGrow","endHeroHurt","guardAll","dmgCapOne","deathKillAlly","freshScare","freshBuffEnd","endSelfHpLoss","statusAura","quote","endRandHp","deathGadget","vetArmor","midtermEnd","shortsCurse","wanderAura","licenseEnd","bingeEnd","deadlineDmg","deathSelfFace","trashAura","deferGrad","locNap","kiki","deathCards","locBlossom","summoned","attacked","deathGhoul","auraGiven","frozen","startHeal","shieldHits","caffeineDoom","capLv","deathDraw","probation","timidPerm","echoTemp","confused","obese","resting","burnout","mutiny","tempAtk","eggBonus","isMini","endDrain","stealthTemp","tb","wfUsed","hatchLeft","infect","deathStego","freezeNext","caffeineOD","stunned","spellDmg"],"hps":["fireblast","armorUp","recruit","lesserHeal","dagger","lifeTap","steadyShot","shapeshift","totem","inspire","frostTouch","cram","nag"],"struct":["type","name","cost","atk","hp","maxHp","effect","school","runes","rc","tribe","rarity","id","scope","unlock","inDeck","text","art","img","desc","flavor"]};
  const ACTION_TYPES = ['END_TURN', 'PLAY_CARD', 'ATTACK', 'CHOOSE', 'TARGET', 'HERO_ATTACK', 'HERO_POWER'];
  const TK = { NONE: 0, HERO_ME: 1, HERO_OPP: 2, MINION_ME: 3, MINION_OPP: 4, HAND: 5 };
  const N_TK = 6, N_POS = 9;
  const GRP = { HAND: 0, MY_BOARD: 1, OPP_BOARD: 2, OTHER: 3 };
  const F0 = 32, G_TOTAL = 128;
  const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
  const r4 = v => Math.round(v * 1e4) / 1e4;
  let REG = REG3_0, regSource = '내장', ALIASES = {};

  function sha1hex(str) {
    const bytes = new TextEncoder().encode(str), l = bytes.length, nb = (((l + 8) >> 6) + 1) << 6;
    const buf = new Uint8Array(nb); buf.set(bytes); buf[l] = 0x80;
    const dv = new DataView(buf.buffer); dv.setUint32(nb - 8, Math.floor(l * 8 / 4294967296)); dv.setUint32(nb - 4, (l * 8) >>> 0);
    let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0; const w = new Uint32Array(80);
    for (let o = 0; o < nb; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 80; i++) { const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]; w[i] = ((x << 1) | (x >>> 31)) >>> 0; }
      let a = h0, b = h1, c = h2, d = h3, e = h4;
      for (let i = 0; i < 80; i++) {
        let f, k;
        if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999; } else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
        else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; } else { f = b ^ c ^ d; k = 0xCA62C1D6; }
        const t = ((((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0); e = d; d = c; c = ((b << 30) | (b >>> 2)) >>> 0; b = a; a = t;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
    }
    return [h0, h1, h2, h3, h4].map(x => x.toString(16).padStart(8, '0')).join('');
  }
  function prefixHash(reg, counts) {
    return sha1hex(JSON.stringify([reg.names.slice(0, counts.names), reg.effs.slice(0, counts.effs), reg.kws.slice(0, counts.kws), reg.hps.slice(0, counts.hps)])).slice(0, 16);
  }

  // 하수인 카드 내기를 자리별로 펼친 합법 행동 목록 (features3.js expandLegal 그대로)
  function expandLegal(view, usePos = true) {
    const legal = view.legal || [];
    if (!usePos || view.pending) return legal;
    const n = view.me.board.length;
    if (n === 0) return legal;
    const handType = new Map(view.me.hand.map(c => [c.id, c.type]));
    const out = [];
    for (const a of legal) {
      if (a.type === 'PLAY_CARD' && handType.get(a.cardId) === 'minion') {
        for (let p = 0; p <= n; p++) out.push({ ...a, pos: p });
      } else out.push(a);
    }
    return out;
  }

  // (features3.js makeFeaturizer 그대로. 파일 읽기만 빼고 번호표를 인자로 받는다)
  function makeFeaturizer(reg, cardPool, heroPowerIds) {
    const caps = reg.caps, aliases = ALIASES;
    const nameId = new Map(reg.names.map((n, i) => [n, i + 1]));
    const effId = new Map(reg.effs.map((t, i) => [t, i + 1]));
    const hpId = new Map(reg.hps.map((t, i) => [t, i + 1]));
    const kws = reg.kws;
    const idOfName = n => nameId.get(aliases[n] || n) || 0;
    const missNames = (cardPool || []).filter(c => !aliases[c.name] && !nameId.has(c.name)).map(c => c.name);
    const missHp = (heroPowerIds || []).filter(h => !hpId.has(h));
    const DEATH = ['deathCopy', 'deathGain', 'deathArmor', 'deathBuffAll', 'deathGrave'];
    const TRIG = ['spellburst', 'spellAura', 'onSpellDraw', 'onSpellFireball', 'endCast', 'endRecast', 'endAttack',
      'endCorpses', 'endScatter', 'endBait', 'endSteal', 'startSpend', 'leechBoost', 'rc', 'runes'];
    function entity(c, where, idx, ctx) {
      const e = c.effect;
      const canAtk = where === 1 && num(c.atk) > 0 && !c.attacked && !c.frozen && !c.cantAttack && !c.stunned && !c.resting && !c.confused
        && (!c.summoned || c.charge || c.rush) ? 1 : 0;
      const x = [
        num(c.cost) / 10, num(c.atk) / 10, num(c.hp) / 10, num(c.maxHp) / 10,
        c.type === 'minion' ? 1 : 0, c.type === 'spell' ? 1 : 0,
        c.shield ? 1 : 0, c.taunt ? 1 : 0, c.charge ? 1 : 0, c.rush ? 1 : 0,
        c.lifesteal ? 1 : 0, c.elusive ? 1 : 0, c.revive ? 1 : 0,
        DEATH.some(k => c[k]) ? 1 : 0, c.onAttackCopy ? 1 : 0, c.twin ? 1 : 0,
        num(c.overload) / 5, num(c.lifeCost) / 5, e ? num(e.value) / 10 : 0,
        c.attacked ? 1 : 0, c.summoned ? 1 : 0, c.frozen ? 1 : 0,
        c.dynCost ? 1 : 0, TRIG.some(k => c[k]) ? 1 : 0,
        (where === 1 || where === 2) ? (idx + 1) / 7 : 0,
        num(c.maxHp) > num(c.hp) ? 1 : 0,
        canAtk,
        where === 0 && num(c.cost) <= ctx.mana ? 1 : 0,
        c.stealth ? 1 : 0, c.poison ? 1 : 0,
        idOfName(c.name) === 0 ? 1 : 0,
        0,
      ];
      const kw = [];
      for (let s = 0; s < kws.length; s++) {
        const v = c[kws[s]];
        if (!v) continue;
        kw.push([s, typeof v === 'number' ? Math.max(-1, Math.min(1, v / 5)) : 1]);
      }
      return { nm: idOfName(c.name), ef: (e && effId.get(e.type)) || 0, x, kw };
    }
    function globalVec(view, nLegal) {
      const me = view.me, op = view.opp, p = view.pending;
      const g = [
        me.hp / 30, num(me.armor) / 20, num(me.mana) / 10, num(me.maxMana) / 10,
        me.hand.length / 10, num(me.deckCount) / 30, num(me.heroAtk) / 10, me.heroAttacked ? 1 : 0,
        num(me.fatigue) / 5, num(me.corpses) / 10, num(me.overloadNext) / 5, num(me.locked) / 5,
        me.board.length / 7, (me.grave ? me.grave.length : 0) / 10, me.eclipse ? 1 : 0, num(me.spellTax) / 5,
        op.hp / 30, num(op.armor) / 20, num(op.mana) / 10, num(op.maxMana) / 10,
        num(op.handCount) / 10, num(op.deckCount) / 30, num(op.heroAtk) / 10, num(op.fatigue) / 5,
        num(op.corpses) / 10, op.board.length / 7, op.eclipse ? 1 : 0,
        Math.min(view.turnNo, 60) / 60, view.first === view.seat ? 1 : 0,
        p && p.kind === 'discover' ? 1 : 0, p && p.kind === 'target' ? 1 : 0,
        nLegal / 30,
        p && p.kind === 'choice' ? 1 : 0, p && p.kind === 'pocketDimension' ? 1 : 0, p && p.kind === 'fruit' ? 1 : 0,
        num(me.maxHp) / 30, num(op.maxHp) / 30, num(me.plays) / 5, me.playLimit != null ? 1 : 0,
        me.noSpell ? 1 : 0, me.heroFrozen ? 1 : 0, op.heroFrozen ? 1 : 0, me.hangover ? 1 : 0,
        (me.dormant ? me.dormant.length : 0) / 3, (op.dormant ? op.dormant.length : 0) / 3, num(me.nextMana) / 5,
        me.heroPower && !me.heroPower.used && num(me.mana) >= num(me.heroPower.cost) ? 1 : 0,
        me.heroPower && me.heroPower.used ? 1 : 0, op.heroPower && op.heroPower.used ? 1 : 0,
      ];
      while (g.length < 64) g.push(0);
      const hcap = caps.hps;
      const myH = new Array(hcap).fill(0), opH = new Array(hcap).fill(0);
      const mi = me.heroPower ? (hpId.get(me.heroPower.id) || 0) : 0, oi = op.heroPower ? (hpId.get(op.heroPower.id) || 0) : 0;
      if (mi < hcap) myH[mi] = 1; if (oi < hcap) opH[oi] = 1;
      g.push(...myH, ...opH);
      while (g.length < G_TOTAL) g.push(0);
      return g.slice(0, G_TOTAL).map(r4);
    }
    function encode(view, legal) {
      legal = legal || expandLegal(view);
      const ents = [], grp = [];
      const hand = new Map(), mine = new Map(), theirs = new Map();
      const ctx = { mana: num(view.me.mana) };
      const add = (c, g, where, idx, map) => { if (map && c.id != null) map.set(c.id, ents.length); ents.push(entity(c, where, idx, ctx)); grp.push(g); return ents.length - 1; };
      view.me.hand.forEach((c, i) => add(c, GRP.HAND, 0, i, hand));
      const myIdx = view.me.board.map((c, i) => add(c, GRP.MY_BOARD, 1, i, mine));
      view.opp.board.forEach((c, i) => add(c, GRP.OPP_BOARD, 2, i, theirs));
      const p = view.pending;
      const optIdx = p && p.options ? p.options.map((c, i) => add(c || {}, GRP.OTHER, 3, i, null)) : [];
      const pendCard = p && p.card ? add(p.card, GRP.OTHER, 3, 0, null) : -1;
      const at = [], src = [], tgt = [], tk = [], pos = [], lft = [], rgt = [];
      const seat = view.seat;
      const tgtOf = t => {
        if (!t) return [-1, TK.NONE];
        if (t.kind === 'hero') return [-1, t.seat === seat ? TK.HERO_ME : TK.HERO_OPP];
        if (t.kind === 'minion') {
          if (t.seat === seat) return [mine.has(t.id) ? mine.get(t.id) : -1, TK.MINION_ME];
          return [theirs.has(t.id) ? theirs.get(t.id) : -1, TK.MINION_OPP];
        }
        if (t.kind === 'hand') return [t.seat === seat && hand.has(t.id) ? hand.get(t.id) : -1, TK.HAND];
        return [-1, TK.NONE];
      };
      for (const l of legal) {
        const ti = Math.max(0, ACTION_TYPES.indexOf(l.type));
        let s = -1;
        if (l.type === 'PLAY_CARD') s = hand.has(l.cardId) ? hand.get(l.cardId) : -1;
        else if (l.type === 'ATTACK') s = mine.has(l.attackerId) ? mine.get(l.attackerId) : -1;
        else if (l.type === 'CHOOSE') s = optIdx[l.index] != null ? optIdx[l.index] : -1;
        else if (l.type === 'TARGET') s = pendCard;
        const [t, k] = tgtOf(l.target);
        at.push(ti); src.push(s); tgt.push(t); tk.push(k);
        if (l.pos != null) {
          pos.push(Math.min(N_POS - 1, l.pos + 1));
          lft.push(l.pos > 0 && myIdx[l.pos - 1] != null ? myIdx[l.pos - 1] : -1);
          rgt.push(myIdx[l.pos] != null ? myIdx[l.pos] : -1);
        } else { pos.push(0); lft.push(-1); rgt.push(-1); }
      }
      const x = [], kwi = [], kws_ = [], kwv = [];
      ents.forEach((e, i) => {
        for (const v of e.x) x.push(r4(v));
        for (const [s, v] of e.kw) { kwi.push(i); kws_.push(s); kwv.push(r4(v)); }
      });
      return { g: globalVec(view, legal.length), nm: ents.map(e => e.nm), ef: ents.map(e => e.ef), x, f0: F0, kwi, kws: kws_, kwv, grp, at, src, tgt, tk, pos, lft, rgt };
    }
    const F = F0 + caps.kws;
    function encodeDense(view, legal) {
      const o = encode(view, legal);
      const n = o.nm.length;
      const dense = new Float64Array(n * F);
      for (let i = 0; i < n; i++) for (let j = 0; j < F0; j++) dense[i * F + j] = o.x[i * F0 + j];
      for (let k = 0; k < o.kwi.length; k++) dense[o.kwi[k] * F + F0 + o.kws[k]] = o.kwv[k];
      return { ...o, x: dense };
    }
    const counts = { names: reg.names.length, effs: reg.effs.length, kws: reg.kws.length, hps: reg.hps.length };
    const meta = { F, F0, G: G_TOTAL, nameCount: caps.names, effCount: caps.effs, nTypes: ACTION_TYPES.length, nTk: N_TK, nPos: N_POS, fmt: 'v3', reg: { ...counts, hash: prefixHash(reg, counts) } };
    function compat(m) {
      if (m.fmt !== 'v3') return `형식이 다른 모델입니다 (${m.fmt || 'v1'})`;
      for (const k of ['F', 'F0', 'G', 'nameCount', 'effCount', 'nTypes', 'nTk', 'nPos']) {
        if (m[k] !== meta[k]) return `모델의 ${k}(${m[k]})가 현재 설정(${meta[k]})과 다릅니다`;
      }
      const r = m.reg;
      if (!r) return '번호표 정보가 없는 모델입니다';
      if (r.names > counts.names || r.effs > counts.effs || r.kws > counts.kws || r.hps > counts.hps) return '모델이 지금 번호표보다 더 많은 항목을 알고 있습니다 (학습 쪽 game\\card_registry.json 을 [번호표 불러오기]로 넣으세요)';
      if (prefixHash(reg, r) !== r.hash) return '번호표 앞부분이 모델 학습 때와 다릅니다 (학습 쪽 game\\card_registry.json 을 [번호표 불러오기]로 넣으세요)';
      return null;
    }
    return { encode, encodeDense, meta, compat, missNames, missHp };
  }

  // ---- 점수 계산 (rl_bot.js 그대로) ----
  function linear(x, W, b, outDim, inDim) {
    const y = new Float64Array(outDim);
    for (let o = 0; o < outDim; o++) { let s = b ? b[o] : 0; const base = o * inDim; for (let i = 0; i < inDim; i++) s += W[base + i] * x[i]; y[o] = s; }
    return y;
  }
  const relu = a => { for (let i = 0; i < a.length; i++) if (a[i] < 0) a[i] = 0; return a; };
  const tensorsOf = j => { const T = {}; for (const k in j.tensors) T[k] = Float64Array.from(j.tensors[k]); return T; };
  function deepScorer(j) {
    const T = tensorsOf(j), m = j.meta;
    const { D, S, A, Q, H, NE, EE } = j.dims;
    const F = m.F, G = m.G, nT = m.nTypes, nK = m.nTk, nP = m.nPos;
    const AIN = nT + nK + nP + 4 * D;
    function encodeEnt(nm, ef, x, off) {
      const inp = new Float64Array(F + NE + EE);
      for (let i = 0; i < F; i++) inp[i] = x[off + i];
      const a = T['name_emb.weight'], b = T['eff_emb.weight'];
      for (let i = 0; i < NE; i++) inp[F + i] = a[nm * NE + i];
      for (let i = 0; i < EE; i++) inp[F + NE + i] = b[ef * EE + i];
      const h = relu(linear(inp, T['ent1.weight'], T['ent1.bias'], D, F + NE + EE));
      return relu(linear(h, T['ent2.weight'], T['ent2.bias'], D, D));
    }
    return function scores(o) {
      const n = o.nm.length, enc = [];
      for (let i = 0; i < n; i++) enc.push(encodeEnt(o.nm[i], o.ef[i], o.x, i * F));
      const pools = [new Float64Array(D), new Float64Array(D), new Float64Array(D)];
      for (let i = 0; i < n; i++) { const g = o.grp[i]; if (g >= 0 && g < 3) for (let d = 0; d < D; d++) pools[g][d] += enc[i][d] / 5; }
      const sin = new Float64Array(G + 3 * D);
      for (let i = 0; i < G; i++) sin[i] = o.g[i];
      for (let g = 0; g < 3; g++) for (let d = 0; d < D; d++) sin[G + g * D + d] = pools[g][d];
      const s = relu(linear(relu(linear(sin, T['st1.weight'], T['st1.bias'], H, G + 3 * D)), T['st2.weight'], T['st2.bias'], S, H));
      const out = [];
      for (let k = 0; k < o.at.length; k++) {
        const ain = new Float64Array(AIN);
        ain[o.at[k]] = 1; ain[nT + o.tk[k]] = 1; ain[nT + nK + o.pos[k]] = 1;
        const base = nT + nK + nP;
        const put = (idx, slot) => { if (idx >= 0) for (let d = 0; d < D; d++) ain[base + slot * D + d] = enc[idx][d]; };
        put(o.src[k], 0); put(o.tgt[k], 1); put(o.lft[k], 2); put(o.rgt[k], 3);
        const a = relu(linear(ain, T['act1.weight'], T['act1.bias'], A, AIN));
        const qin = new Float64Array(S + A); qin.set(s, 0); qin.set(a, S);
        const q = relu(linear(qin, T['q1.weight'], T['q1.bias'], Q, S + A));
        out.push(linear(q, T['q2.weight'], T['q2.bias'], 1, Q)[0]);
      }
      return out;
    };
  }
  const SMALL_IDX = [0, 16, 2, 3, 27, 12, 25];
  function linearScorer(j) {
    const T = tensorsOf(j), m = j.meta;
    const F = m.F, F0_ = m.F0, G = m.G;
    const DS = G + 3 * F0_ + 1, DSS = SMALL_IDX.length + 1;
    const wA = T['wA'], wB = T['wB'], wC = T['wC'], wD = T['wD'], wE = T['wE'], wG = T['wG'], wH = T['wH'];
    const eS = T['emb_src.weight'], eT = T['emb_tgt.weight'], eE = T['emb_eff.weight'];
    const bias = T['bias'][0];
    return function scores(o) {
      const n = o.nm.length;
      const sv = new Float64Array(DS);
      for (let i = 0; i < G; i++) sv[i] = o.g[i];
      const cnt = [0, 0, 0];
      for (let i = 0; i < n; i++) { const g = o.grp[i]; if (g >= 0 && g < 3) { cnt[g]++; for (let f = 0; f < F0_; f++) sv[G + g * F0_ + f] += o.x[i * F + f]; } }
      for (let g = 0; g < 3; g++) if (cnt[g]) for (let f = 0; f < F0_; f++) sv[G + g * F0_ + f] /= cnt[g];
      sv[DS - 1] = 1;
      const ss = new Float64Array(DSS); ss[0] = 1; SMALL_IDX.forEach((gi, k) => { ss[k + 1] = o.g[gi]; });
      const out = [];
      for (let k = 0; k < o.at.length; k++) {
        let q = bias;
        const at = o.at[k], tk = o.tk[k], ps = o.pos[k], s = o.src[k], t = o.tgt[k], l = o.lft[k], r = o.rgt[k];
        for (let i = 0; i < DS; i++) q += wA[at * DS + i] * sv[i];
        for (let i = 0; i < DSS; i++) q += wB[tk * DSS + i] * ss[i];
        if (s >= 0) for (let f = 0; f < F; f++) { const v = o.x[s * F + f]; if (v) for (let i = 0; i < DSS; i++) q += wC[f * DSS + i] * v * ss[i]; }
        if (t >= 0) for (let f = 0; f < F; f++) { const v = o.x[t * F + f]; if (v) for (let i = 0; i < DSS; i++) q += wD[f * DSS + i] * v * ss[i]; }
        const DE = 1 + 2 * F0_;
        q += wE[ps * DE];
        if (l >= 0) for (let f = 0; f < F0_; f++) q += wE[ps * DE + 1 + f] * o.x[l * F + f];
        if (r >= 0) for (let f = 0; f < F0_; f++) q += wE[ps * DE + 1 + F0_ + f] * o.x[r * F + f];
        if (s >= 0) for (let f = 0; f < F0_; f++) q += wG[at * F0_ + f] * o.x[s * F + f];
        if (t >= 0) for (let f = 0; f < F0_; f++) q += wH[at * F0_ + f] * o.x[t * F + f];
        const nmS = s >= 0 ? o.nm[s] : 0, nmT = t >= 0 ? o.nm[t] : 0, efS = s >= 0 ? o.ef[s] : 0;
        for (let i = 0; i < DSS; i++) q += (s >= 0 ? eS[nmS * DSS + i] + eE[efS * DSS + i] : 0) * ss[i] + (t >= 0 ? eT[nmT * DSS + i] : 0) * ss[i];
        out.push(q);
      }
      return out;
    };
  }

  // ---- 바깥에서 쓰는 것 ----
  const env = () => ({ pool: root.CARD_POOL || (typeof CARD_POOL !== 'undefined' ? CARD_POOL : []), hps: root.HERO_POWER_IDS || (typeof HERO_POWER_IDS !== 'undefined' ? HERO_POWER_IDS : []) });
  let fzCache = null;
  const featurizer = () => (fzCache && fzCache.reg === REG) ? fzCache.fz : (fzCache = { reg: REG, fz: makeFeaturizer(REG, env().pool, env().hps) }).fz;
  // 모델 JSON → 봇 {decide(view), info, kind}. 호환되지 않으면 이유를 담은 Error. fallback(view) = 추론 중 오류일 때 대신 쓸 봇
  function make(j, fallback) {
    if (!j || !j.meta || !j.tensors) throw new Error('모델 파일 형식이 아닙니다 (학습이 저장한 model.json / best.json 이어야 합니다)');
    const kind = j.kind || 'deep';
    if (kind === 'deep' && !j.dims) throw new Error('신경망 모델인데 dims 정보가 없습니다');
    const FZ = featurizer(), why = FZ.compat(j.meta); if (why) throw new Error(why);
    const scores = kind === 'linear' ? linearScorer(j) : deepScorer(j);
    const usePos = j.meta.usePos !== false;
    return {
      info: j.info || {}, kind, fmt: 'v3',
      decide(view) {
        if (!view.legal || !view.legal.length) return { type: 'END_TURN' };
        try {
          const legal = expandLegal(view, usePos);
          const q = scores(FZ.encodeDense(view, legal));
          let best = 0;
          for (let i = 1; i < q.length; i++) if (q[i] > q[best]) best = i;
          return legal[best];
        } catch (e) { console.warn('모델(v3) 추론 오류 → 대체 봇', e); return fallback ? fallback.decide(view) : view.legal[0]; }
      },
      _scores: (view, legal) => scores(FZ.encodeDense(view, legal || expandLegal(view, usePos))),
    };
  }
  const isRegistry = r => !!(r && Array.isArray(r.names) && Array.isArray(r.effs) && Array.isArray(r.kws) && Array.isArray(r.hps) && r.caps && r.caps.hps);
  function setRegistry(r, label) {
    if (!isRegistry(r)) throw new Error('v3 번호표(card_registry.json, 영웅 능력 hps 포함)가 아닙니다');
    REG = r; regSource = label || '불러옴'; fzCache = null;
  }
  function regInfo() {
    let warn = ''; try { const fz = featurizer(); const n = fz.missNames.length + fz.missHp.length; if (n) warn = ` · 번호표에 없는 카드 ${fz.missNames.length}장/영웅 능력 ${fz.missHp.length}개는 모델에게 '모르는 카드'로 보임`; } catch (e) {}
    return `v3 번호표(${regSource}): 카드 ${REG.names.length} · 효과 ${REG.effs.length} · 키워드 ${REG.kws.length} · 영웅 능력 ${REG.hps.length}${warn}`;
  }
  const api = { make, setRegistry, isRegistry, regInfo, expandLegal, makeFeaturizer, prefixHash, REG3_0 };
  root.PolicyNetV3 = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
