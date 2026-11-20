// sound.js — 효과음 · 배경음악 · 분위기음
//   ui.js 는 고치지 않는다. ui.js 의 연출 함수(showEffect · showSpellCast · flyDraw …)를 감싸서 그 순간에 소리를 낸다.
//   소리 파일: /sounds/sfx (효과음, 같은 소리 여러 개 중 무작위) · /sounds/bgm (배경음악) · /sounds/amb (컷신 분위기음)
//   출처: Kenney 오디오 묶음(CC0) · Pixabay · Freesound — public/sounds/CREDITS.txt
//   설정(음소거 · 음악 · 효과음 크기)은 이 기기에 저장. 메뉴 위쪽 🔊 버튼, 대전 중엔 전투 기록의 [소리] 체크
const Sound = (() => {
  'use strict';
  const BASE = '/sounds/';
  // 효과음: 이름 → [파일 개수, 기본 크기]
  const SFX = {
    draw: [8, .5], place: [4, .7], thud: [5, .6], hit: [5, .95], hit_hero: [5, 1], death: [5, .45],
    shield_break: [5, .7], shield: [5, .5], freeze: [5, .6], armor: [5, .55], heal: [6, .45], buff: [5, .4],
    hero_power: [3, .55], turn: [3, .5], error: [4, .4], click: [5, .22], shuffle: [1, .55], fan: [2, .55],
    discover: [3, .55], fatigue: [2, .55], trait: [3, .4], heal2: [2, .55], gold: [2, .55], bet: [6, .55], pack: [2, .65],
    spell: [3, .4], win: [1, .8], lose: [1, .8],
    // 타격감: 휘두르기 · 베기 · 영웅 신음 · 부서지며 죽기
    swing: [1, .5], slash: [1, .6], hurt: [2, .45], crumble: [2, .7], wood: [5, .6], slime: [2, .6],
    // 속성별 주문 명중 (같은 속성 안에서 무작위)
    sp_fire: [3, .75], sp_frost: [3, .75], sp_lightning: [1, .75], sp_arcane: [2, .7], sp_holy: [3, .75],
    sp_shadow: [5, .75], sp_nature: [3, .75], sp_poison: [4, .75],
  };
  // 주문 명중: 속성(ui.js 의 fxKindOf 와 같은 이름) → 겹쳐 낼 소리들 [이름, {크기, 음높이}]
  const SPELL_HIT = {
    fire: [['sp_fire']],
    frost: [['sp_frost']],
    lightning: [['sp_lightning']],
    arcane: [['sp_arcane']],
    holy: [['sp_holy']],
    shadow: [['sp_shadow']],
    fel: [['sp_shadow'], ['sp_fire', { rate: .85, vol: .45 }]],          // 지옥 = 어둠 + 낮은 불길
    blood: [['sp_poison', { rate: .85 }], ['sp_shadow', { vol: .4 }]],   // 혈기 = 끈적한 소리 + 어둠
    poison: [['sp_poison']],
    nature: [['sp_nature'], ['wood', { vol: .4 }]],
    spark: [['sp_arcane', { vol: .8 }]],
  };
  const BGM = { menu: 'menu', battle: 'battle', boss: 'boss', story: 'story' };
  // 컷신 배경 이름 → 분위기음 (없으면 음악만)
  const AMB_OF = [
    [/bbq|drinking|pocha|dance_circle|game_table|karaoke|cafe|lunch|toast|bottle_catch|s3_cheer|s3_highfive/, 'crowd'],
    [/campus_spring|campus_pond|sunrise_street|front_door_morning|s3_gate|pole_dawn/, 'forest'],
    [/alley|rain_walk|busstop_rain|walk_sober|taxi|pole$|cvs_dawn|bootcamp|portal_leave|result_night|letter_future/, 'wind'],
    [/exam|omr|007_target|notice_close/, 'dungeon'],
    [/blackout|crash|^dark$/, 'mine'],
  ];

  // ---------- 설정 ----------
  const KEY = 'cardDuel.sound.v1';
  const DEF = { mute: false, music: 0.5, sfx: 0.8 };
  let opt = { ...DEF };
  try { Object.assign(opt, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) {}
  const saveOpt = () => { try { localStorage.setItem(KEY, JSON.stringify(opt)); } catch (_) {} };

  // ---------- 오디오 그래프: 효과음 / 음악 / 분위기음 각각 크기 조절 ----------
  let ac = null, gMaster, gSfx, gMusic, gAmb;
  function ctx() {
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try {
      ac = new AC();
      gMaster = ac.createGain(); gMaster.connect(ac.destination);
      gSfx = ac.createGain(); gSfx.connect(gMaster);
      gMusic = ac.createGain(); gMusic.connect(gMaster);
      gAmb = ac.createGain(); gAmb.connect(gMaster);
      applyVol();
    } catch (_) { ac = null; }
    return ac;
  }
  function applyVol() {
    if (!ac) return;
    const t = ac.currentTime;
    gMaster.gain.setTargetAtTime(opt.mute ? 0 : 1, t, 0.05);
    gSfx.gain.setTargetAtTime(opt.sfx, t, 0.05);
    gMusic.gain.setTargetAtTime(opt.music * 0.55, t, 0.15);
    gAmb.gain.setTargetAtTime(opt.music * 0.8, t, 0.15);
  }

  // ---------- 효과음 ----------
  const buf = new Map();      // 'hit_3' → AudioBuffer | Promise
  function load(file) {
    if (buf.has(file)) return buf.get(file);
    const p = fetch(BASE + 'sfx/' + file + '.mp3').then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
      .then(a => new Promise((res, rej) => ac.decodeAudioData(a, res, rej)))
      .then(b => { buf.set(file, b); return b; })
      .catch(() => { buf.set(file, null); return null; });
    buf.set(file, p);
    return p;
  }
  function preloadSfx() { if (!ctx()) return; for (const [k, [n]] of Object.entries(SFX)) for (let i = 1; i <= n; i++) load(k + '_' + i); }
  const lastAt = new Map();   // 같은 소리가 한꺼번에 몰리면(광역 피해 등) 몇 개만
  // play('hit', {vol, rate, gap})  vol: 기본 크기에 곱함 · rate: 음 높이(1=원래) · gap: 같은 소리 최소 간격(ms)
  function play(name, o = {}) {
    try {
      if (opt.mute || !opt.sfx) return;
      const def = SFX[name]; if (!def || !ctx() || ac.state !== 'running') return;
      const now = performance.now(), gap = o.gap != null ? o.gap : 45;
      if (now - (lastAt.get(name) || -1e9) < gap) return;
      lastAt.set(name, now);
      const file = name + '_' + (1 + Math.floor(Math.random() * def[0]));
      const go = b => {
        if (!b) return;
        const s = ac.createBufferSource(), g = ac.createGain();
        s.buffer = b;
        s.playbackRate.value = (o.rate || 1) * (o.exact ? 1 : 0.94 + Math.random() * 0.12);   // 매번 음 높이를 살짝 다르게
        g.gain.value = def[1] * (o.vol != null ? o.vol : 1);
        s.connect(g); g.connect(gSfx); s.start(ac.currentTime + (o.delay || 0) / 1000);
      };
      const b = buf.get(file);
      if (b && !(b instanceof Promise)) go(b); else load(file).then(go);
    } catch (_) {}
  }

  // ---------- 배경음악 (스트리밍 · 곡 바꿀 때 크로스페이드) ----------
  const tracks = {};   // name → {el, g}
  let curMusic = null, duck = 1;
  function trackOf(name) {
    if (tracks[name]) return tracks[name];
    const el = new Audio(BASE + 'bgm/' + name + '.mp3');
    el.loop = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
    const g = ac.createGain(); g.gain.value = 0;
    try { ac.createMediaElementSource(el).connect(g); g.connect(gMusic); }
    catch (_) { el.volume = opt.music * 0.55; }   // 연결이 안 되는 브라우저: 요소 볼륨으로
    return (tracks[name] = { el, g });
  }
  function music(name) {
    if (name === curMusic || !ctx()) return;
    const t = ac.currentTime;
    if (curMusic && tracks[curMusic]) {
      const old = tracks[curMusic];
      old.g.gain.cancelScheduledValues(t); old.g.gain.setTargetAtTime(0, t, 0.5);
      setTimeout(() => { if (curMusic !== old.name) try { old.el.pause(); } catch (_) {} }, 2500);
    }
    curMusic = name;
    if (!name) return;
    const tr = trackOf(name); tr.name = name;
    if (tr.el.paused) { if (tr.el.ended || tr.el.currentTime > tr.el.duration - 1) tr.el.currentTime = 0; tr.el.play().catch(() => {}); }
    tr.g.gain.cancelScheduledValues(t); tr.g.gain.setTargetAtTime(duck, t, 0.6);
  }
  function setDuck(v, ms) {   // 승리·패배 음악이 나오는 동안 배경음악을 줄인다
    duck = v; const tr = curMusic && tracks[curMusic];
    if (tr && ac) tr.g.gain.setTargetAtTime(v, ac.currentTime, 0.2);
    if (ms) setTimeout(() => setDuck(1), ms);
  }

  // ---------- 분위기음 (컷신 장면마다, 이음매 없이 반복) ----------
  const ambBuf = new Map(); let amb = null;   // {name, src, g}
  function ambience(name) {
    if (!ctx() || (amb && amb.name === name) || (!amb && !name)) return;
    const t = ac.currentTime;
    if (amb) { const a = amb; a.g.gain.setTargetAtTime(0, t, 0.6); setTimeout(() => { try { a.src.stop(); } catch (_) {} }, 3000); amb = null; }
    if (!name) return;
    const want = name;
    const get = ambBuf.get(name) || fetch(BASE + 'amb/' + name + '.mp3').then(r => r.arrayBuffer())
      .then(a => new Promise((res, rej) => ac.decodeAudioData(a, res, rej))).catch(() => null);
    ambBuf.clear(); ambBuf.set(name, get);   // 디코딩된 소리는 하나만 기억 (메모리)
    Promise.resolve(get).then(b => {
      if (!b || (amb && amb.name === want) || curAmbWanted !== want) return;
      const src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = b; src.loop = true; src.loopStart = 0.05; src.loopEnd = b.duration - 0.05;   // mp3 앞뒤 여백 건너뛰기
      g.gain.value = 0; src.connect(g); g.connect(gAmb); src.start();
      g.gain.setTargetAtTime(1, ac.currentTime, 0.8);
      amb = { name: want, src, g };
    });
  }
  let curAmbWanted = null;

  // ---------- 지금 어떤 화면인지 보고 음악·분위기음을 고른다 ----------
  function storyBgName() {
    const el = document.querySelector('.cs-bg.show, .as-bg.show'); if (!el) return null;
    const m = /([^\/"]+?)(?:\.\w+)?"?\)?$/.exec(el.style.backgroundImage || ''); return m ? m[1] : '';
  }
  function scene() {   // v166 수능 보스(suneung.js)가 정한 음악이 있으면 그것을
    const base = scene0(), inStory = !!document.querySelector('.cs-bg, .as-bg');
    let ov = null; try { if (typeof window.SuneungBgm === 'function') ov = window.SuneungBgm(inStory, inStory ? storyBgName() : null); } catch (_) {}
    if (ov && ov.music !== undefined) return { music: ov.music, amb: ov.amb !== undefined ? ov.amb : base.amb };
    return base;
  }
  function scene0() {
    const inStory = !!document.querySelector('.cs-bg, .as-bg');
    if (inStory) {
      const bg = storyBgName() || '';
      const hit = AMB_OF.find(([re]) => re.test(bg));
      const amb = hit ? hit[1] : null;
      return { music: amb === 'crowd' ? BGM.battle : BGM.story, amb };   // 술자리·카페 장면은 주점 음악 + 웅성거림
    }
    const menu = document.getElementById('menu');
    if (menu && !menu.classList.contains('hidden')) return { music: BGM.menu, amb: null };
    const g = typeof game !== 'undefined' ? game : null;
    const big = g && (g.mode === 'adventure' || (g.mode === 'bet' && g.tier >= 400));   // 모험 보스 · 고배당(치트 3개 이상) 배팅
    return { music: big ? BGM.boss : BGM.battle, amb: null };
  }
  function tick() {
    if (!ac || ac.state !== 'running') return;
    try { const s = scene(); music(s.music); curAmbWanted = s.amb; ambience(s.amb); } catch (_) {}
  }

  // ---------- 처음 누를 때 소리 켜기 (브라우저 자동재생 제한) ----------
  function unlock() {
    if (!ctx()) return;
    if (ac.state !== 'running') ac.resume().then(() => { preloadSfx(); tick(); }).catch(() => {});
    else tick();
  }
  ['pointerdown', 'keydown', 'touchend'].forEach(e => document.addEventListener(e, unlock, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend().catch(() => {}); else ac.resume().then(tick).catch(() => {});
  });
  setInterval(tick, 700);

  // ---------- 게임 연출에 소리 붙이기 (원래 함수는 그대로 실행) ----------
  function attackerAtk(ev) {   // 공격하는 하수인(또는 영웅)의 공격력
    try {
      const S = Host.state.seats[ev.seat];
      const m = S.board.find(x => x.id === ev.attackerId);
      if (m) return m.atk || 0;
      return (S.hero && (S.hero.atk || 0)) + ((S.weapon && S.weapon.atk) || 0);
    } catch (_) { return 2; }
  }
  const MY_SEAT = () => (typeof MY !== 'undefined' ? MY : 0);
  const watching = () => { try { return !!(game && (game.spectate || game.replay)); } catch (_) { return false; } };
  let overSeen = null;
  function onEvent(ev) {
    if (!ev) return;
    switch (ev.type) {
      case 'summon': play('place'); play('thud', { vol: .8, delay: 30 }); break;
      case 'death': play('crumble', { gap: 90 }); play('thud', { vol: .5, rate: .8, gap: 90 }); break;
      case 'heal': play('heal2', { gap: 150 }); break;
      case 'buff': case 'handBuff': case 'heroAtk': case 'statSet': case 'deckBuff': play('buff', { gap: 120 }); break;
      case 'shieldGain': play('shield', { gap: 120 }); break;
      case 'freeze': play('freeze', { gap: 120 }); break;
      case 'armor': case 'armorLater': play('armor'); break;
      case 'silence': case 'transform': play('trait', { rate: 1.4, vol: .8 }); break;
      case 'mana': case 'crystal': case 'nextMana': play('buff', { rate: .8, vol: .7 }); break;
      case 'recall': case 'bounce': case 'toDeck': play('draw'); break;
      case 'heroPower': play('hero_power'); break;
      case 'turn_start': if (ev.seat === MY_SEAT() && !watching()) play('turn', { exact: true }); break;
      case 'game_over': {
        const key = (typeof game !== 'undefined' && game) || 1; if (overSeen === key) break; overSeen = key;
        if (ev.winner == null) break;
        const won = ev.winner === MY_SEAT();
        setDuck(0.15, 6500); play(won ? 'win' : 'lose', { exact: true, delay: 250 }); break;
      }
    }
  }
  function wrap(name, after, before) {   // 전역 함수 name 을 감싼다. before(...args) 는 실행 전, after(result, ...args) 는 끝난 뒤
    const f = window[name]; if (typeof f !== 'function') return;
    const w = function (...a) {
      try { if (before) before.apply(this, a); } catch (_) {}
      const r = f.apply(this, a);
      if (after) { if (r && typeof r.then === 'function') return r.then(v => { try { after(v, ...a); } catch (_) {} return v; }); try { after(r, ...a); } catch (_) {} }
      return r;
    };
    window[name] = w;
  }
  function hook() {
    wrap('showEffect', null, ev => onEvent(ev));
    // 공격: 달려갈 때 휙 → 부딪히는 순간 퍽(펀치 + 쿵 + 베기를 겹쳐서). 공격력이 클수록 무겁게
    wrap('lungeApproach', (_, ev) => {
      if (!ev) return;
      const hero = ev.target && ev.target.kind === 'hero', atk = attackerAtk(ev);
      const heavy = atk >= 5, mid = atk >= 3;
      play(hero ? 'hit_hero' : 'hit', { vol: 1, gap: 0 });
      play('thud', { vol: heavy ? 1 : .75, rate: heavy ? .75 : .95, gap: 0 });
      if (mid || hero) play('slash', { vol: heavy ? .8 : .55, gap: 0 });
      if (heavy) play('fatigue', { vol: .35, rate: 1.2, gap: 0 });
      if (hero && mid) play('hurt', { vol: .7, gap: 600, delay: 60 });
    }, ev => { if (ev) play('swing', { gap: 0 }); });
    // 그 밖의 피해: 주문·투사체는 속성별 명중 소리, 나머지는 타격음 (fxPlay 는 투사체가 닿는 순간 불린다)
    wrap('fxPlay', null, (ev, ctx, shot) => {
      if (!ev || ev.type !== 'damage' || ev.cause === 'combat' || ev.immune) return;
      if (ev.absorbed) { play('shield_break'); return; }
      if (!(ev.amount > 0)) return;
      const hero = ev.target && ev.target.kind === 'hero';
      let kind = null;
      try {
        if (shot && shot.kind) kind = shot.kind;
        else if (typeof fxIsSpellDmg === 'function' && fxIsSpellDmg(ev, ctx)) kind = fxKindOf(ctx.name, ctx.school);
      } catch (_) {}
      if (kind) {
        const aoe = ctx && ctx.aoe, layers = SPELL_HIT[kind] || SPELL_HIT.spark;
        for (const [nm, o] of layers) play(nm, Object.assign({ gap: 110 }, o, { vol: (o && o.vol || 1) * (aoe ? .8 : 1) }));
        play(hero ? 'hit_hero' : 'hit', { vol: .5, gap: 110 });
      } else {
        play(hero ? 'hit_hero' : 'hit', { vol: ev.amount >= 5 ? 1 : .8, gap: 70 });
        play('thud', { vol: .5, gap: 70 });
      }
      if (hero && ev.amount >= 3) play('hurt', { vol: .6, gap: 600, delay: 60 });
    });
    wrap('showSpellCast', null, ev => { if (ev && ev.card && ev.card.fatigue) play('fatigue'); else play('spell'); });
    wrap('flyDraw', null, (seat, n) => { for (let i = 0; i < Math.min(n || 1, 4); i++) play('draw', { delay: i * 110, gap: 0 }); });
    wrap('showBurn', null, () => play('death', { rate: 1.35, vol: .6 }));
    wrap('mullAnimate', null, () => play('shuffle'));
    wrap('warn', null, msg => { if (msg) play('error', { gap: 300 }); });
    wrap('confirmBet', null, () => play('bet'));
    wrap('finishGame', null, () => {   // 혹시 game_over 이벤트를 못 봤으면 여기서 승패 소리
      try { if (game && !game.settled && overSeen !== game && Host.state.over) onEvent({ type: 'game_over', winner: Host.state.winner }); } catch (_) {}
    });
    wrap('flashTrait', null, nm => {
      try { if (typeof oppTraits === 'function' && oppTraits().some(t => t.name === nm)) play('trait', { gap: 900 }); } catch (_) {}
    });
    // 골드가 늘면 동전 소리 (처음 불러올 때는 빼고)
    let gold = null; const t0 = Date.now();
    wrap('updateWallet', () => {
      try { const g = Economy.get().gold; if (gold != null && g > gold && Date.now() - t0 > 5000) play('gold'); gold = g; } catch (_) {}
    });
    // 창이 뜰 때: 멀리건 · 발견 · 카드팩
    const onShow = { mulliganModal: () => play('fan'), discoverModal: () => play('discover'), packModal: () => play('pack') };
    for (const [id, fn] of Object.entries(onShow)) {
      const el = document.getElementById(id); if (!el) continue;
      let was = el.classList.contains('show');
      new MutationObserver(() => { const now = el.classList.contains('show'); if (now && !was) { try { fn(); } catch (_) {} } was = now; })
        .observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    // 버튼 누르는 소리
    document.addEventListener('click', e => {
      const b = e.target && e.target.closest && e.target.closest('button, .menu-btn, .mm-mode, [role="button"]');
      if (b && !b.disabled) play('click', { gap: 60 });
    }, true);
  }

  // ---------- 설정 화면 ----------
  function setOpt(p) { Object.assign(opt, p); saveOpt(); applyVol(); syncUI(); if (!opt.mute) unlock(); }
  function syncUI() {
    const b = document.getElementById('sndBtn'); if (b) b.innerHTML = `<img src="/images/ui/${opt.mute ? 'btn_sound_off' : 'btn_sound_on'}.webp" alt="${opt.mute ? '소리 꺼짐' : '소리 켜짐'}" draggable="false">`;   // v166 그림 버튼
    const c = document.getElementById('optSound'); if (c) c.checked = !opt.mute;
    const p = document.getElementById('sndPanel'); if (!p) return;
    p.querySelector('[data-k="mute"]').checked = !opt.mute;
    p.querySelector('[data-k="music"]').value = Math.round(opt.music * 100);
    p.querySelector('[data-k="sfx"]').value = Math.round(opt.sfx * 100);
  }
  function buildUI() {
    const css = document.createElement('style');
    css.textContent = `
#sndBtn{background:transparent;border:1px solid rgba(201,162,39,.5);color:var(--gold,#c9a227);border-radius:999px;padding:.15rem .55rem;font-size:.85rem;cursor:pointer;line-height:1.2}
#sndPanel{position:fixed;z-index:9000;min-width:13rem;background:rgba(20,18,31,.97);border:1px solid var(--gold-d,#8a6d1b);border-radius:.7rem;padding:.7rem .85rem;color:var(--parch,#efe3c2);font-size:.85rem;box-shadow:0 8px 30px rgba(0,0,0,.5)}
#sndPanel[hidden]{display:none}
#sndPanel label{display:flex;align-items:center;gap:.5rem;margin:.35rem 0;white-space:nowrap}
#sndPanel input[type=range]{flex:1;accent-color:var(--gold,#c9a227)}
#sndPanel input[type=checkbox]{accent-color:var(--gold,#c9a227)}
#sndPanel .t{width:3.6rem}`;
    document.head.appendChild(css);
    const top = document.getElementById('menuTop');
    if (top) {
      const b = document.createElement('button'); b.type = 'button'; b.id = 'sndBtn'; b.title = '소리 설정';
      top.insertBefore(b, top.firstChild);
      const p = document.createElement('div'); p.id = 'sndPanel'; p.hidden = true;
      p.innerHTML = `<label><input type="checkbox" data-k="mute"> 소리 켜기</label>
<label><span class="t">🎵 음악</span><input type="range" min="0" max="100" data-k="music"></label>
<label><span class="t">🔔 효과음</span><input type="range" min="0" max="100" data-k="sfx"></label>`;
      document.body.appendChild(p);
      b.onclick = e => {
        e.stopPropagation();
        if (!p.hidden) { p.hidden = true; return; }
        p.hidden = false; const r = b.getBoundingClientRect(); p.style.top = (r.bottom + 6) + 'px'; p.style.left = Math.max(8, Math.min(r.left, innerWidth - p.offsetWidth - 8)) + 'px';
      };
      p.addEventListener('click', e => e.stopPropagation());
      document.addEventListener('click', () => { p.hidden = true; });
      p.querySelector('[data-k="mute"]').onchange = e => setOpt({ mute: !e.target.checked });
      p.querySelector('[data-k="music"]').oninput = e => setOpt({ music: e.target.value / 100 });
      p.querySelector('[data-k="sfx"]').oninput = e => setOpt({ sfx: e.target.value / 100 });
      p.querySelector('[data-k="sfx"]').onchange = () => play('hit', { gap: 0 });   // 크기를 바꾸면 들려 준다
    }
    // 대전 화면: 전투 기록 머리의 [화면 흔들림] 옆에 [소리]
    const shake = document.getElementById('optShake');
    if (shake && shake.parentElement) {
      const l = document.createElement('label'); l.className = 'log-opt'; l.title = '효과음·음악 켜기/끄기 (크기는 처음 화면 위쪽 🔊)';
      l.innerHTML = '<input type="checkbox" id="optSound"> 소리';
      shake.parentElement.after(l);
      l.querySelector('input').onchange = e => setOpt({ mute: !e.target.checked });
    }
    syncUI();
  }

  function init() { try { hook(); buildUI(); } catch (e) { console.warn('[sound]', e); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  return { play, music, ambience, set: setOpt, get: () => ({ ...opt }), debug: () => ({ state: ac && ac.state, music: curMusic, amb: amb && amb.name, scene: scene() }) };
})();
window.Sound = Sound;
