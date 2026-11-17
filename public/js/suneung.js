// suneung.js — v166 수능 보스 연출
//   · 교시 전환 페이즈: 보스 체력 66% · 33% · 15% 를 넘으면 (엔진 bossPhase 이벤트)
//       같은 입학(모험) 안에서 처음이면 그 교시 컷신(cutscene.js suneung_math · suneung_english · suneung_lang2) → 교시 배너
//       이미 봤으면 교시 배너만. 배너 끝에 보스가 얻은 것(방어도 +5 · 새 능력)을 보여 준다
//   · 카드 첫 등장 연출 (한 판에 카드마다 한 번): 5교시의 악령 · 물수능 컷 폭발 · OMR 카드 밀려쓰기
//   · 엔딩 크레딧 (이길 때마다, 개발자 보스 건너뛰기 포함): 본령 + 퇴실 방송 → 회색 회상 S1~S5 → Special Thanks → 보상 화면
//       건너뛰기는 누구나 언제든 (바로 보상 화면)
//   · 수능 브금: 전야 슬리피우드 · 아침 프렌즈스토리 · 시험(필적 확인란 · 1교시 · 교시 컷신) 세레니티 · 보스전 파풀라투스 → 5교시 혼테일
//   그림: /images/suneung (배경 3장 · 회상 S1~S5 · Kenney 파티클 CC0) · 소리: /sounds/ending · /sounds/bgm
const SuneungFx = (() => {
  'use strict';
  const BOSS_ID = 'ynu_suneung';
  const IMG = '/images/suneung/', FXI = IMG + 'fx/', SND = '/sounds/ending/';
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const G = () => (typeof game !== 'undefined' ? game : null);
  const isSuneung = b => !!b && b.id === BOSS_ID;
  const inSuneungGame = () => { const g = G(); return !!(g && g.mode === 'adventure' && isSuneung(g.boss) && !g.replay && !g.spectate); };
  const oppSeat = () => (typeof OPP !== 'undefined' ? OPP : 1);

  // ===================== 교시 =====================
  const PHASES = [
    { at: 66, cut: 'suneung_math', no: '2교시', subj: '수학 영역', time: '오전 10:30', clock: [10, 30], cast: '지금부터 2교시 수학 영역 시험을 시작하겠습니다.' },
    { at: 33, cut: 'suneung_english', no: '3교시', subj: '영어 영역', time: '오후 1:10', clock: [13, 10], cast: '지금부터 3교시 영어 영역 듣기 평가를 시작하겠습니다.' },
    { at: 15, cut: 'suneung_lang2', no: '4교시', subj: '한국사/탐구 영역', time: '오후 2:50', clock: [14, 50], cast: '지금부터 4교시 한국사, 탐구 영역 시험을 시작하겠습니다.', last: true },   // v168 실제 수능 순서
  ];
  const START_CLOCK = [8, 40];
  // 엔진 newGame 의 opts.phases[보스 좌석]. 수능 보스만
  function phasesFor(boss) {
    if (!isSuneung(boss) || typeof phasePickPool !== 'function') return null;
    preload();
    return { at: PHASES.map(p => p.at), armor: 5, pool: phasePickPool() };
  }

  // v167 컷신 선택 → 보스전 시작: 컨디션(전야 · 아침 · 쉬는 시간 선택의 합)
  //   2 이상 = 내가 카드 1장을 더 들고 시작 / −1 이하 = 보스가 방어도 3을 얻고 시작
  function storyBonus() {
    try { if (!window.StoryState || StoryState.cur !== 'suneung') return null; const c = StoryState.get().cond || 0;
      if (c >= 2) return { good: true, kind: 'card', text: '컨디션 최상: 카드 1장을 더 들고 시작' };
      if (c <= -1) return { good: false, kind: 'armor', text: '컨디션 난조: 보스가 방어도 3을 얻고 시작' };
    } catch (_) {}
    return null;
  }
  function applyStartBonus(state) {
    const b = storyBonus(); if (!b || !state) return null;
    if (b.kind === 'card') { const P = state.seats[0]; if (P && P.deck && P.deck.length) P.hand.push(P.deck.shift()); }
    if (b.kind === 'armor') { const P = state.seats[1]; if (P) P.armor = (P.armor || 0) + 3; }
    return b;
  }

  // 「같은 입학에서 본 교시」: 입학(런) 시작 시각별로 이 기기에 기억. 런이 없는 개발자 시험 대전은 이 페이지를 연 동안만
  const devSeen = new Set();
  function seenKey() {
    const g = G(); const run = g && g.boss && g.boss.chapter && typeof runOf === 'function' ? runOf(g.boss.chapter) : null;
    if (!run || !run.startedAt || (g && g.devTest)) return null;
    const u = window.CURRENT_USER; const who = u && (u.username || u.id) ? String(u.username || u.id) : 'guest';
    return `cardDuel.snPhase.${who}.${run.startedAt}`;
  }
  function wasSeen(idx) {
    const k = seenKey(); if (!k) return devSeen.has(idx);
    try { return (JSON.parse(localStorage.getItem(k) || '[]') || []).includes(idx); } catch (_) { return false; }
  }
  function markSeen(idx) {
    const k = seenKey(); if (!k) { devSeen.add(idx); return; }
    try { const a = JSON.parse(localStorage.getItem(k) || '[]') || []; if (!a.includes(idx)) a.push(idx); localStorage.setItem(k, JSON.stringify(a)); } catch (_) {}
  }

  // ===================== 공통 화면 =====================
  let root = null;
  function open(cls) {
    close(true);
    root = document.createElement('div'); root.id = 'snFx'; root.className = cls || '';
    root.innerHTML = '<div class="sn-stage"></div><div class="sn-ui"></div>';
    document.body.appendChild(root);
    void root.offsetWidth; root.classList.add('on');
    return root;
  }
  function close(now) {
    const r = root; if (!r) return Promise.resolve(); root = null;
    if (now) { r.remove(); return Promise.resolve(); }
    r.classList.remove('on'); return wait(450).then(() => r.remove());
  }
  const stageOf = r => r.querySelector('.sn-stage'), uiOf = r => r.querySelector('.sn-ui');
  function el(parent, cls, html, tag) { const e = document.createElement(tag || 'div'); if (cls) e.className = cls; if (html != null) e.innerHTML = html; parent.appendChild(e); return e; }
  // 파티클 한 개: x·y·size 는 무대 기준 % (size 는 무대 너비의 %)
  function particle(parent, name, x, y, size, o = {}) {
    const p = document.createElement('img'); p.className = 'sn-p' + (o.cls ? ' ' + o.cls : ''); p.alt = ''; p.src = FXI + name + '.png';
    p.style.left = x + '%'; p.style.top = y + '%'; p.style.width = size + '%';
    if (o.tint) p.style.filter = o.tint; if (o.delay) p.style.animationDelay = o.delay + 'ms'; if (o.dur) p.style.animationDuration = o.dur + 'ms';
    if (o.rot != null) p.style.setProperty('--r', o.rot + 'deg');
    if (o.dx != null) p.style.setProperty('--dx', o.dx + '%'); if (o.dy != null) p.style.setProperty('--dy', o.dy + '%');
    parent.appendChild(p); return p;
  }
  const TINT = {
    purple: 'brightness(.9) sepia(1) hue-rotate(225deg) saturate(5)',
    gold: 'sepia(1) saturate(4) hue-rotate(-12deg) brightness(1.15)',
    red: 'sepia(1) saturate(6) hue-rotate(-45deg) brightness(.95)',
    yellow: 'sepia(1) saturate(5) hue-rotate(5deg) brightness(1.2)',
    amber: 'brightness(.55) sepia(1) saturate(7) hue-rotate(-8deg)',
  };
  function sfx(name, o) { try { if (window.Sound) Sound.play(name, o || {}); } catch (_) {} }
  function vol(kind) { try { const o = window.Sound ? Sound.get() : { mute: false, music: .5, sfx: .8 }; return o.mute ? 0 : Math.max(0, Math.min(1, kind === 'music' ? o.music : o.sfx)); } catch (_) { return .5; } }
  function playAudio(src, v, startAt) {
    try { const a = new Audio(src); a.volume = Math.max(0, Math.min(1, v)); if (startAt) a.currentTime = startAt; a.play().catch(() => {}); return a; } catch (_) { return null; }
  }
  function fadeAudio(a, to, ms) {
    if (!a) return Promise.resolve();
    return new Promise(res => { const from = a.volume, t0 = performance.now();
      const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); try { a.volume = Math.max(0, Math.min(1, from + (to - from) * k)); } catch (_) {}
        if (k < 1) requestAnimationFrame(step); else { if (to === 0) try { a.pause(); } catch (_) {} res(); } };
      step(); });
  }
  // 누르면 넘기기: minMs 이후의 누름만. 끝나면 resolve
  function holdOrTap(r, ms, minMs) {
    return new Promise(res => {
      const t0 = Date.now(); let done = false;
      const fin = () => { if (done) return; done = true; r.removeEventListener('pointerdown', tap); document.removeEventListener('keydown', key, true); res(); };
      const tap = () => { if (Date.now() - t0 >= (minMs || 0)) fin(); };
      const key = e => { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); tap(); } };
      r.addEventListener('pointerdown', tap); document.addEventListener('keydown', key, true);
      setTimeout(fin, ms);
    });
  }
  function typeText(node, text, cps) {
    if (reduce()) { node.textContent = text; return Promise.resolve(); }
    return new Promise(res => { let i = 0; const step = () => { node.textContent = text.slice(0, ++i); if (i < text.length) setTimeout(step, 1000 / (cps || 28)); else res(); }; step(); });
  }

  // ---- 시험장 앞쪽 벽 (교시 배너 · 퇴실 방송 공용): 배경 · 시계 · 스피커 음파 · 칠판 글씨 · 방송 자막 ----
  //  그림 좌표 (bg_front 1600×900 기준 %): 시계 중심 55.2·24.8 · 스피커 91.6·12.5 · 가운데 칠판 54.5·49
  function frontWall(r, from, to) {
    const st = stageOf(r);
    el(st, 'sn-bg', null).style.backgroundImage = `url("${IMG}bg_front.webp")`;
    el(st, 'sn-vig', null);
    const ck = el(st, 'sn-clock', '<i class="h"></i><i class="m"></i><b></b>');
    setClock(ck, from || START_CLOCK, true);
    if (to) setTimeout(() => setClock(ck, to), 350);
    return { ck, st };
  }
  function setClock(ck, [h, m], instant) {
    const hh = ck.querySelector('.h'), mm = ck.querySelector('.m');
    if (instant) { hh.style.transition = mm.style.transition = 'none'; }
    // 바늘이 앞으로만 돌도록 누적 각도
    const totalMin = h * 60 + m, prev = Number(ck.dataset.min || totalMin);
    const delta = instant ? 0 : Math.max(0, totalMin - prev);
    const hBase = Number(ck.dataset.ha || ((prev % 720) / 2)), mBase = Number(ck.dataset.ma || ((prev % 60) * 6));
    const ha = hBase + delta / 2, ma = mBase + delta * 6;
    hh.style.transform = `rotate(${ha}deg)`; mm.style.transform = `rotate(${ma}deg)`;
    ck.dataset.min = totalMin; ck.dataset.ha = ha; ck.dataset.ma = ma;
    if (instant) { void ck.offsetWidth; hh.style.transition = mm.style.transition = ''; }
  }
  function speakerPulse(st, n) {
    for (let i = 0; i < (n || 3); i++) particle(st, 'circle_02', 91.6, 12.5, 7, { cls: 'sn-ring', tint: TINT.amber, delay: i * 420 });
  }
  function castBox(ui, text) {
    const b = el(ui, 'sn-cast', '<span class="sn-nm">📢 방송</span><p class="sn-tx"></p>');
    return typeText(b.querySelector('.sn-tx'), text, 26);
  }

  // ===================== 교시 전환 (페이즈) =====================
  async function phase(ev) {
    if (!ev || ev.seat !== oppSeat() || !inSuneungGame()) return;
    const p = PHASES[ev.idx]; if (!p) return;
    if (p.last) preloadEnding();
    try {
      if (!wasSeen(ev.idx) && window.Cutscene && Cutscene.has(p.cut)) { markSeen(ev.idx); await Cutscene.play(p.cut); }
    } catch (e) { console.warn('[suneung] cutscene', e); }
    await banner(p, ev);
  }
  function gainChip(g) {
    if (!g) return '';
    const kind = g.kind === 'cheat' ? (g.global ? '나에게도 적용' : '지속 능력') : '영웅 능력';
    const art = g.kind === 'hero' ? (typeof hpArtOf === 'function' && hpArtOf(g.id)) : `/images/cheats/${g.id}.webp`;
    return `<div class="sn-gain${g.global ? ' global' : ''}"><span class="sn-ic"${art ? ` style="background-image:url('${esc(art)}')"` : ''}>${art ? '' : esc(g.icon || '✦')}</span>
      <span class="tx"><small>${esc(kind)}</small><b>${esc(g.icon || '')} ${esc(g.name)}</b><em>${esc(String(g.text || '').replace(/^\[양쪽\]\s*/, ''))}</em></span></div>`;
  }
  async function banner(p, ev) {
    const prev = ev.idx > 0 ? PHASES[ev.idx - 1].clock : START_CLOCK;
    const r = open('phase' + (p.last ? ' last' : ''));
    const { st } = frontWall(r, prev, p.clock);
    const ui = uiOf(r);
    if (p.last) { for (let i = 0; i < 4; i++) particle(st, 'smoke_0' + [1, 4, 7, 1][i], 15 + i * 24, 92, 34, { cls: 'sn-fog', tint: TINT.purple, delay: i * 200 }); el(st, 'sn-redtint', null); }
    particle(st, 'twirl_02', 55.2, 24.8, 11, { cls: 'sn-twirl', tint: TINT.yellow });
    speakerPulse(st, 3);
    const board = el(st, 'sn-board', `<small class="sn-myeong">${esc(p.no)}</small><b class="sn-myeong">${esc(p.subj)}</b><span>${esc(p.time)}</span>`);
    playAudio(SND + 'bell1.mp3', vol('sfx') * .85);
    await wait(250); board.classList.add('show');
    castBox(ui, p.cast);
    await wait(1100);
    const gains = el(ui, 'sn-gains', `<div class="sn-gain armor"><span class="sn-ic">🛡</span><span class="tx"><small>보스 강화</small><b>방어도 +${ev.armor || 0}</b></span></div>${gainChip(ev.gain)}`);
    void gains.offsetWidth; gains.classList.add('show'); sfx('armor'); if (ev.gain) setTimeout(() => sfx('trait'), 260);
    if (p.last) setTimeout(() => sfx('sp_shadow'), 200);
    await holdOrTap(r, 4300, 500);
    await close();
  }

  // ===================== 카드 첫 등장 연출 (한 판에 카드마다 한 번) =====================
  const CARD_FX = {
    '아랍어 로또 괴물 (5교시의 악령)': introLotto,
    '물수능 컷 폭발': introCutCrash,
    'OMR 카드 밀려쓰기': introOmr,
  };
  async function onPlay(ev) {
    if (!ev || ev.seat !== oppSeat() || !inSuneungGame()) return;
    const fn = CARD_FX[ev.name]; if (!fn) return;
    const g = G(); g.snCardFx = g.snCardFx || []; if (g.snCardFx.includes(ev.name)) return; g.snCardFx.push(ev.name);
    try { await fn(); } catch (e) { console.warn('[suneung] card fx', e); await close(true); }
  }
  function titleBlock(ui, kicker, big, sub, cls) {
    return el(ui, 'sn-title ' + (cls || ''), `<small class="sn-myeong">${esc(kicker)}</small><b class="sn-myeong">${esc(big)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`);
  }
  async function introLotto() {
    const r = open('sn-k lotto'), st = stageOf(r), ui = uiOf(r);
    el(st, 'sn-bg dusk', null).style.backgroundImage = `url("${IMG}bg_dusk.webp")`;
    el(st, 'sn-vig strong', null);
    particle(st, 'magic_02', 50, 52, 40, { cls: 'sn-spin', tint: TINT.purple });
    particle(st, 'light_01', 50, 52, 46, { cls: 'sn-glow', tint: TINT.purple });
    for (let i = 0; i < 6; i++) particle(st, ['smoke_01', 'smoke_04', 'smoke_07'][i % 3], 8 + i * 17, 86 + (i % 2) * 6, 30, { cls: 'sn-fog', tint: TINT.purple, delay: i * 120 });
    const card = el(st, 'sn-bigcard', ''); card.style.backgroundImage = 'url("/images/ynu/ynu_lotto.jpg")';
    sfx('sp_shadow'); sfx('trait', { rate: .7 });
    await wait(200); card.classList.add('show');
    const t = titleBlock(ui, '제2외국어 영역 아랍어', '5교시의 악령', '전설 등장', 'purple');
    await wait(500); t.classList.add('show'); r.classList.add('shake');
    for (let i = 0; i < 7; i++) particle(st, i % 2 ? 'star_06' : 'star_04', 30 + Math.random() * 40, 25 + Math.random() * 50, 6 + Math.random() * 6, { cls: 'sn-twinkle', tint: TINT.gold, delay: 150 + i * 160 });
    await holdOrTap(r, 2900, 700);
    await close();
  }
  async function introCutCrash() {
    const r = open('sn-k crash'), st = stageOf(r), ui = uiOf(r);
    el(st, 'sn-bg desk', null).style.backgroundImage = `url("${IMG}bg_desk.webp")`;
    el(st, 'sn-vig', null);
    const rows = [['국어', 131, 96], ['수학', 128, 94], ['영어', '-', '-'], ['한국사', '-', '-'], ['탐구', 66, 95]];
    const rep = el(st, 'sn-report', `<div class="hd sn-myeong">대학수학능력시험 성적통지표</div>
      <div class="who"><span>성명</span><b>강민수</b><span>수험번호</span><b>12345678</b></div>
      <table><thead><tr><th>영역</th><th>표준점수</th><th>백분위</th><th>등급</th></tr></thead>
      <tbody>${rows.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td><td class="gr"><i>1</i></td></tr>`).join('')}</tbody></table>
      <div class="ft">한국교육과정평가원</div>`);
    await wait(150); rep.classList.add('show');
    await wait(700);
    particle(st, 'star_06', 66, 55, 30, { cls: 'sn-flash', tint: TINT.red });
    for (let i = 0; i < 3; i++) particle(st, 'scorch_0' + (1 + i % 2), 55 + i * 9, 40 + i * 14, 16, { cls: 'sn-burn', tint: TINT.red, delay: i * 90 });
    particle(st, 'dirt_03', 66, 55, 34, { cls: 'sn-debris', tint: 'brightness(.6)' });
    r.classList.add('shake'); sfx('sp_fire'); sfx('hit_hero', { rate: .8 });
    rep.querySelectorAll('.gr i').forEach((g, k) => setTimeout(() => { g.textContent = '3'; g.parentElement.classList.add('down'); }, 80 + k * 70));
    const t = titleBlock(ui, '전설 주문', '물수능 컷 폭발', '1등급 컷이 무너졌다', 'red');
    t.classList.add('show');
    await holdOrTap(r, 2900, 700);
    await close();
  }
  async function introOmr() {
    const r = open('sn-k omr'), st = stageOf(r), ui = uiOf(r);
    el(st, 'sn-bg desk', null).style.backgroundImage = `url("${IMG}bg_desk.webp")`;
    el(st, 'sn-vig', null);
    const ans = [3, 1, 4, 2, 5, 2, 3, 1];   // 16~23번에 찍은 답
    const nos = [16, 17, 18, 19, 20, 21, 22, 23];
    const omr = el(st, 'sn-omr', `<div class="hd"><b class="sn-myeong">답 안 지</b><span>컴퓨터용 사인펜만 사용</span></div>
      <div class="grid">${nos.map((n, i) => `<div class="row${n === 20 ? ' r20' : ''}"><span class="no">${n}</span>${[1, 2, 3, 4, 5].map(k => `<span class="bb">${k}</span>`).join('')}</div>`).join('')}</div>`);
    // 마킹: 각 줄의 답 자리에 검은 칠 (줄 높이 % 단위로 움직인다)
    const grid = omr.querySelector('.grid');
    const rowsEl = [...grid.querySelectorAll('.row')];
    // 칠할 자리 = 그 줄의 a번 동그라미 (화면에 그려진 위치를 재서 그대로 덮는다. 회전·확대와 상관없이 grid 기준 좌표)
    const place = (m, row, a) => { const bb = row < rowsEl.length ? rowsEl[row].querySelectorAll('.bb')[a - 1] : null;
      if (bb) { m.style.left = bb.offsetLeft + 'px'; m.style.top = (rowsEl[row].offsetTop + bb.offsetTop) + 'px'; m.style.width = bb.offsetWidth + 'px'; m.style.height = bb.offsetHeight + 'px'; }
      else { m.style.top = (rowsEl[rowsEl.length - 1].offsetTop + rowsEl[0].offsetHeight) + 'px'; m.classList.add('out'); } };
    const marks = ans.map((a, i) => { const m = el(grid, 'sn-mk', null); place(m, i, a); return m; });
    await wait(150); omr.classList.add('show');
    await wait(650);
    // 20번부터 한 칸씩 밀림
    marks.forEach((m, i) => { if (i >= 4) place(m, i + 1, ans[i]); });
    particle(st, 'trace_02', 50, 62, 26, { cls: 'sn-streak', tint: 'brightness(.25)', rot: 90 });
    particle(st, 'scratch_01', 60, 60, 16, { cls: 'sn-scratch', tint: TINT.red });
    sfx('draw', { rate: .6 }); setTimeout(() => sfx('error'), 300);
    await wait(450); grid.querySelector('.r20').classList.add('empty');
    const bub = el(ui, 'sn-hand', '어…? 20번 마킹할 자리가 왜 비어있지…');
    const t = titleBlock(ui, '전설 주문', 'OMR 카드 밀려쓰기', '답안지가 한 칸씩 밀렸다', 'red');
    t.classList.add('show'); setTimeout(() => bub.classList.add('show'), 250);
    await holdOrTap(r, 3100, 700);
    await close();
  }

  // ===================== 엔딩 크레딧 =====================
  const SCENES = [
    { id: 's1', iv: 800, fx: 'zoom108', lines: [['야간자율학습', '졸다 깬 횟수: 세다가 포기'], ['야자 째고 도망간 횟수', '3회']] },
    { id: 's2', iv: 800, fx: 'still', lines: [['여름 등교', '셔츠가 마른 날: 0일']] },
    { id: 's3', iv: 600, fx: 'pan', lines: [['급식실 달리기', '1등 한 적 있음 (자랑 아님)']] },
    { id: 's4', iv: 800, fx: 'hand', lines: [['점심시간 축구', '골은 기억 안 나고 땀만 기억남']] },
    { id: 's5', iv: 800, fx: 'zoomS5', lines: [['매점 왕복', '쉬는 시간 10분의 승부'], ['지각했지만 안 걸린 횟수', '11회']] },
  ];
  const THANKS = [
    { role: '같이 야자 째던 친구들', names: ['민수 · 지훈 · 태양 · 준호 · 서진'] },
    { role: '방송부', names: ['방송부원들'] },
    { role: '담임 선생님', names: ['3학년 7반 박정훈 선생님'] },
    { role: '급식실', names: ['급식 이모님'] },
  ];
  const THANKS_LAST = '엄마, 아빠';
  const T = { cast: 1200, gray: 7000, song: 8000, scene0: 8500, sceneLen: 6000, roll: 8500, hold: 1500, songFade: 1500 };
  let endingOn = false, endingQueued = false; const after = [];
  function queueEnding() {
    if (endingQueued || endingOn) return; endingQueued = true;
    preloadEnding();
    setTimeout(() => { ending().finally(() => { endingQueued = false; }); }, 2600);   // 승리 효과음이 지나간 뒤
  }
  const endingActive = () => endingOn || endingQueued;
  function afterEnding(fn) { if (!endingActive()) { try { fn(); } catch (_) {} return; } after.push(fn); }

  async function ending() {
    if (endingOn) return; endingOn = true;
    preloadEnding();
    const r = open('ending'), st = stageOf(r), ui = uiOf(r);
    const timers = []; const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    let song = null, bell = null, skipped = false, resolveDone;
    const done = new Promise(res => { resolveDone = res; });
    // --- 1막: 본령 + 퇴실 방송 (시험장 앞쪽 벽, 컬러) ---
    const wall = el(st, 'sn-wall', null);
    const fw = frontWall({ querySelector: () => wall }, [17, 5], [17, 40]);
    speakerPulse(wall, 4);
    bell = playAudio(SND + 'bell2.mp3', vol('music') * .9);
    at(T.cast, () => { castBox(ui, '수고하셨습니다. 문제지와 답안지를 제출하고 퇴실하세요.'); });
    // --- 2막: 회상 (회색) ---
    el(r, '', `<svg width="0" height="0" style="position:absolute"><filter id="snHazeF" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.008 0.06" numOctaves="2" seed="3" result="t"><animate attributeName="baseFrequency" dur="3s" values="0.008 0.06;0.009 0.075;0.008 0.06" repeatCount="indefinite"/></feTurbulence><feDisplacementMap in="SourceGraphic" in2="t" scale="9" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`);
    const world = el(r, 'sn-world', null);
    const scenesEl = el(world, 'sn-scenes', null);
    SCENES.forEach(s => {
      const sc = el(scenesEl, 'sn-scene', null); sc.dataset.id = s.id;
      const cam = el(sc, 'sn-cam', null);
      'abcde'.split('').forEach(f => { const im = el(cam, '', null, 'img'); im.alt = ''; im.src = `${IMG}ending/${s.id}_${f}.jpg`; });
      if (s.id === 's2') el(cam, 'sn-haze', null);
      if (s.id === 's1') el(sc, 'sn-flicker', null);
    });
    el(world, 'sn-vig2', null); el(world, 'sn-grain', null);
    const shade = el(r, 'sn-shade', null);
    const credits = SCENES.map(s => el(r, 'sn-credit', s.lines.map(([a, b]) => `<p><strong>${esc(a)}</strong><em>·····</em>${esc(b)}</p>`).join('')));
    const dim = el(r, 'sn-tdim', null);
    const tw = el(r, 'sn-thanks-wrap', null);
    const th = el(tw, 'sn-thanks', `<div class="head">SPECIAL THANKS</div>${THANKS.map(g => `<div class="grp"><div class="role">${esc(g.role)}</div>${g.names.map(n => `<div class="sn-name">${esc(n)}</div>`).join('')}</div>`).join('')}<div class="last sn-myeong">${esc(THANKS_LAST)}</div>`);
    el(r, 'sn-bar top', null); el(r, 'sn-bar bot', null);
    const skip = el(r, 'sn-skip', '건너뛰기 ▸▸', 'button'); skip.type = 'button';
    let cur = -1;
    const setFrame = (i, f) => { const sc = scenesEl.children[i]; const imgs = sc.querySelectorAll('img'); imgs.forEach((im, k) => im.classList.toggle('on', k === f)); const h = sc.querySelector('.sn-haze'); if (h) h.style.backgroundImage = `url("${imgs[f].src}")`; };
    const showScene = i => {
      const sc = scenesEl.children[i]; sc.classList.add('on', 'fx-' + SCENES[i].fx); setFrame(i, 0);
      if (cur >= 0) { const old = scenesEl.children[cur]; credits[cur].classList.remove('on'); shade.classList.remove('on'); setTimeout(() => old.classList.remove('on'), 420); }
      cur = i;
    };
    at(T.gray, () => { r.classList.add('gray'); });
    at(T.song, () => { song = playAudio(SND + 'cheonggaeguri.mp3', 0); if (song) fadeAudio(song, vol('music') * .9, 2000); });
    SCENES.forEach((s, i) => {
      const t0 = T.scene0 + i * T.sceneLen;
      at(t0, () => { if (i === 0) { r.classList.add('recall'); fadeAudio(bell, 0, 800); } showScene(i); });
      for (let f = 1; f < 5; f++) at(t0 + f * s.iv, () => setFrame(i, f));
      at(t0 + 4000, () => { credits[i].classList.add('on'); shade.classList.add('on'); });
    });
    const tThanks = T.scene0 + SCENES.length * T.sceneLen;
    at(tThanks, () => {
      credits[4].classList.remove('on'); shade.classList.remove('on'); dim.classList.add('on');
      const last = th.querySelector('.last'), H = r.clientHeight;
      const endY = -(H / 2 + last.offsetTop + last.offsetHeight / 2);
      th.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${endY}px)` }], { duration: T.roll, easing: 'cubic-bezier(.25,0,.35,1)', fill: 'forwards' });
    });
    const tEnd = tThanks + T.roll + T.hold;
    // v167 크레딧이 멈춘 뒤 내 성적통지표 (컷신에서 푼 문제로 등급). 문제를 하나도 안 풀었으면 건너뛴다
    const rep = reportCard();
    if (rep) {
      at(tEnd, () => { const box = el(r, 'sn-stage sn-endrep', rep); box.style.zIndex = 9; requestAnimationFrame(() => box.querySelector('.sn-report').classList.add('show')); fadeAudio(song, vol('music') * .55, 800); });
      at(tEnd + 4800, () => finish(false));
    } else at(tEnd, () => finish(false));
    async function finish(bySkip) {
      if (skipped) return; skipped = true; timers.forEach(clearTimeout);
      await Promise.all([fadeAudio(song, 0, bySkip ? 600 : T.songFade), fadeAudio(bell, 0, 400)]);
      await close(); resolveDone();
    }
    skip.onclick = e => { e.stopPropagation(); finish(true); };
    r.addEventListener('keydown', e => { if (e.key === 'Escape') finish(true); });
    try { await done; } finally {
      endingOn = false;
      const fns = after.splice(0); fns.forEach(fn => { try { fn(); } catch (_) {} });
    }
  }

  // v168 성적통지표: 이번 판에 실제로 푼 과목만 칸으로 (StoryState flag sn_results, cutscene.js GAMES.gichul)
  //   맞힌 배점 비율로 등급 · 백분위 · 표준점수를 그럴듯하게 만든다. 영어 · 한국사는 실제처럼 등급만
  const gradeOfR = r => r >= .9 ? 1 : r >= .75 ? 2 : r >= .6 ? 3 : r >= .5 ? 4 : r >= .4 ? 5 : r >= .3 ? 6 : r >= .2 ? 7 : r >= .1 ? 8 : 9;
  function scoreOf(e) {
    const r = e.max ? e.got / e.max : 0, g = gradeOfR(r), abs = e.area === '영어' || e.area === '한국사';
    const std = abs ? '-' : (e.area === '국어' || e.area === '수학') ? Math.round(70 + r * 75) : Math.round(30 + r * 42);
    const pct = abs ? '-' : Math.max(1, Math.min(99, Math.round(4 + r * 95)));
    return { std, pct, g };
  }
  function reportCard() {
    let res = null; try { if (window.StoryState && StoryState.cur === 'suneung') res = StoryState.get().sn_results; } catch (_) {}
    const all = Object.values(res || {}).filter(e => e && e.n);
    if (!all.length) return null;
    const ORDER = { '국어': 0, '수학': 1, '영어': 2, '한국사': 3, '사회': 4, '과학': 5, '한문': 6 };
    all.sort((a, b) => (ORDER[a.area] ?? 9) - (ORDER[b.area] ?? 9));
    const groups = [];   // [{title, cols:[e]}]
    for (const e of all) {
      const title = e.area === '사회' || e.area === '과학' ? '탐구 영역' : e.area === '한문' ? '제2외국어/한문 영역' : `${e.area} 영역`;
      const g = groups.find(x => x.title === title) || (groups.push({ title, cols: [] }), groups[groups.length - 1]);
      g.cols.push(e);
    }
    const cols = groups.flatMap(g => g.cols), sc = cols.map(scoreOf);
    const sub = e => (e.area === '사회' || e.area === '과학' || e.area === '한문') ? (e.label || e.area) : '';
    const hasSub = cols.some(sub);
    const head1 = `<tr><th rowspan="${hasSub ? 2 : 1}">구 분</th>${groups.map(g => `<th colspan="${g.cols.length}"${!hasSub || g.cols.every(c => !sub(c)) ? (hasSub ? ' rowspan="2"' : '') : ''}>${esc(g.title)}</th>`).join('')}</tr>`;
    const head2 = hasSub ? `<tr>${groups.filter(g => g.cols.some(sub)).flatMap(g => g.cols).map(c => `<th class="sb">${esc(sub(c))}</th>`).join('')}</tr>` : '';
    const row = (name, f, cls) => `<tr><th>${name}</th>${sc.map(x => `<td${cls ? ` class="${cls}"` : ''}>${cls ? `<i>${f(x)}</i>` : f(x)}</td>`).join('')}</tr>`;
    const avg = sc.reduce((a, x) => a + x.g, 0) / sc.length;
    const note = avg <= 1.2 ? '전 과목 1등급… 꿈인가?' : avg <= 2.5 ? '이 정도면 해볼 만하다' : avg <= 4.5 ? '가채점은 내일 하자' : avg <= 6.5 ? '…엄마한테 뭐라고 하지' : 'N수 선언…?';
    return `<div class="sn-report sn-myrep"><div class="hd sn-myeong">대학수학능력시험 성적통지표</div>
      <div class="who"><span>성명</span><b>강민수</b><span>수험번호</span><b>12345678</b></div>
      <table>${head1}${head2}${row('표준점수', x => x.std)}${row('백분위', x => x.pct)}${row('등 급', x => x.g, 'gr')}</table>
      <div class="sn-note">${esc(note)}</div></div>`;
  }

  // ===================== 모의고사 (v167): 전 과목 30문제, 언제든 그만두기 =====================
  const MOCK_KEY = () => { const u = window.CURRENT_USER; return 'cardDuel.mockBest.' + (u && (u.username || u.id) ? (u.username || u.id) : 'guest'); };
  function mockExam() {
    if (!window.Cutscene || !window.QuizBank) return;
    let best = 0; try { best = Number(localStorage.getItem(MOCK_KEY()) || 0); } catch (_) {}
    Cutscene.SCRIPTS.mock_exam = {
      dir: 'ynu1/', title: '모의고사',
      steps: [
        { t: 'scene', kicker: '모의고사', title: '전 과목 30문제', time: best ? `최고 기록 ${best}문제` : '첫 도전', bg: 'bg_exam_room' },
        { t: 'desc', text: '맞힐수록 문제가 쉬워진다. 언제든 [그만 풀기]로 끝낼 수 있다.' },
        { t: 'game', g: 'quiz', pool: 'mix', count: 30, mock: true, noStats: true, ms: 20000 },
        { t: 'big', kicker: '모의고사 결과', text: () => { const q = Cutscene.lastQuiz || { ok: 0, done: 0 }; return `${q.ok} / ${q.done}`; },
          sub: () => { const q = Cutscene.lastQuiz || { ok: 0 }; if (q.ok > best) { try { localStorage.setItem(MOCK_KEY(), String(q.ok)); } catch (_) {} return best ? `최고 기록 경신! 전 기록 ${best}문제` : '첫 기록'; } return `최고 기록 ${best}문제`; } },
      ],
    };
    return Cutscene.play('mock_exam');
  }

  // ===================== 브금 (sound.js 가 0.7초마다 묻는다) =====================
  // inStory: 컷신·스토리 화면인지, bg: 지금 배경 이름. 돌려준 music 이 그 화면의 음악 (null = 조용히), undefined 면 원래 규칙
  function bgm(inStory, bg) {
    if (endingOn) return { music: null, amb: null };
    if (inStory) {
      if (EXAM_BG.test(bg || '')) return { music: null, amb: null };              // 시험 장면: 음악 없이 (초침 · 연필 소리는 examAmb)
      return null;                                                               // 전야 · 아침: 원래 스토리 브금
    }
    if (inSuneungGame()) {
      const menu = document.getElementById('menu'); if (menu && !menu.classList.contains('hidden')) return null;
      return { music: 'papulatus', amb: null };                                  // v167 메이플은 보스전 한 곡만
    }
    return null;
  }

  // ===================== 시험장 소리 (v167): 시계 초침 + 가끔 연필 사각사각. 코드로 합성 =====================
  const EXAM_BG = /^(s4_sheet|bg_exam|bg_omr|bg_dusk)/;
  const examAmb = (() => {
    let ac = null, on = false, tickT = null, penT = null, n = 0;
    const ctx = () => { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (_) { ac = null; } return ac; };
    function noise(sec) { const c = ac, b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * sec)), c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; return s; }
    function tick() {
      const v = vol('sfx'); if (!ac || !v) return; const t = ac.currentTime;
      const src = noise(0.04), bp = ac.createBiquadFilter(), g = ac.createGain();
      bp.type = 'bandpass'; bp.frequency.value = (n++ % 2) ? 2300 : 2900; bp.Q.value = 6;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.035);
      src.connect(bp).connect(g).connect(ac.destination); src.start(t); src.stop(t + 0.05);
    }
    function pencil() {
      const v = vol('sfx'); if (!ac || !v) return; const t = ac.currentTime, dur = 0.35 + Math.random() * 0.5;
      const src = noise(dur), bp = ac.createBiquadFilter(), g = ac.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 3600 + Math.random() * 1400; bp.Q.value = 1.1;
      const steps = Math.ceil(dur * 18), curve = new Float32Array(steps + 1);
      for (let i = 0; i <= steps; i++) curve[i] = (i === 0 || i === steps ? 0 : (0.4 + Math.random() * 0.6)) * 0.09 * v;
      g.gain.setValueCurveAtTime(curve, t, dur);
      src.connect(bp).connect(g).connect(ac.destination); src.start(t); src.stop(t + dur + 0.02);
    }
    function schedulePen() { penT = setTimeout(() => { if (!on) return; pencil(); if (Math.random() < 0.4) setTimeout(() => on && pencil(), 420); schedulePen(); }, 2200 + Math.random() * 4200); }
    function start() { if (on) return; if (!ctx()) return; on = true; tick(); tickT = setInterval(tick, 1000); schedulePen(); }
    function stop() { on = false; clearInterval(tickT); clearTimeout(penT); }
    // 지금 화면에 시험 장면 배경이 떠 있으면 켜고, 아니면 끈다
    function bgName() { const b = document.querySelector('.cs-bg.show, .as-bg.show'); if (!b) return ''; const m = /\/([^\/]+?)\.(?:webp|jpg|png)/.exec(b.style.backgroundImage || '') || /\/([^\/]+?)\.(?:webp|jpg|png)/.exec((b.querySelector && b.querySelector('img') || {}).src || ''); return m ? m[1] : ''; }
    setInterval(() => { (EXAM_BG.test(bgName()) && !endingOn) ? start() : stop(); }, 600);
    return { start, stop, bgName };
  })();

  // ===================== 미리 받기 =====================
  let preloaded = false, preloadedEnd = false;
  function img(src) { const i = new Image(); i.src = src; return i; }
  function preload() {
    if (preloaded) return; preloaded = true;
    ['bg_front.webp', 'bg_dusk.webp', 'bg_desk.webp'].forEach(f => img(IMG + f));
    ['circle_02', 'twirl_02', 'magic_02', 'light_01', 'smoke_01', 'smoke_04', 'smoke_07', 'star_04', 'star_06', 'scorch_01', 'scorch_02', 'dirt_03', 'trace_02', 'scratch_01'].forEach(n => img(FXI + n + '.png'));
    img('/images/ynu/ynu_lotto.jpg'); img('/images/cheats/nsuDeclare.webp');
    try { if (document.fonts && document.fonts.load) { document.fonts.load('800 40px "Nanum Myeongjo"', '수학영역교시'); document.fonts.load('700 20px "Nanum Myeongjo"', '성적통지표답안지'); } } catch (_) {}
  }
  function preloadEnding() {
    if (preloadedEnd) return; preloadedEnd = true;
    SCENES.forEach(s => 'abcde'.split('').forEach(f => img(`${IMG}ending/${s.id}_${f}.jpg`)));
  }

  window.SuneungBgm = bgm;
  return { isSuneung, phasesFor, phase, onPlay, queueEnding, ending, endingActive, afterEnding, preload, preloadEnding, PHASES, _bgm: bgm, storyBonus, applyStartBonus, mockExam, examAmb };
})();
window.SuneungFx = SuneungFx;
