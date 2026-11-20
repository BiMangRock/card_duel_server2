// playfx.js — v174 카드 연출 · 보스 등장/격파 연출
//   · 전설 하수인을 내면: 화면이 어두워지고 금빛 빛줄기 속에서 카드가 크게 떠오른 뒤 쿵 → 전장으로 (약 1.8초)
//   · 주문을 내면: 카드가 가운데에 잠깐 떠서 속성 색 빛으로 타 사라진다 (상대 주문은 읽을 수 있게 조금 더 길게)
//     전설 주문은 금빛 빛줄기 + 이름 띠
//   · 모험 보스전 시작: 보스 초상화 · 이름 · 단계가 칼자국과 함께 등장 (약 2.4초)
//   · 모험 보스를 이기면: 글자 없이 보스 초상화가 금 가고 깨져 조각나 튄다 (그 뒤에 결과 창)
//   화면을 누르면 바로 넘어간다. 전투 기록 패널의 [카드 연출] 체크로 끌 수 있다 (기기가 '동작 줄이기'면 기본으로 꺼짐)
//   ui.js 의 playEvents0 ('play' 이벤트) · startBoss · finishGame 에서 부른다
const PlayFx = (() => {
  'use strict';
  const KEY = 'cardDuel.playfx.v174';
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
  const Opt = {
    get() { try { const v = localStorage.getItem(KEY); return v ? v === 'on' : !reduced(); } catch (_) { return !reduced(); } },
    set(on) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (_) {} },
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const snd = (n, o) => { try { if (window.Sound) Sound.play(n, o); } catch (_) {} };
  const shake = (p, d) => { try { if (window.Juice) Juice.shake(p, d); } catch (_) {} };
  const escH = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 속성 → 빛 색 (ui.js FX_KIND 와 같은 이름)
  const GLOW = {
    fire: ['#ffb340', 'rgba(255,90,0,.85)'], frost: ['#d8f2ff', 'rgba(80,170,255,.85)'], arcane: ['#dcc2ff', 'rgba(140,90,255,.85)'],
    lightning: ['#eef7ff', 'rgba(120,180,255,.9)'], shadow: ['#c8a6ff', 'rgba(90,30,160,.9)'], holy: ['#fff3b8', 'rgba(255,210,90,.85)'],
    fel: ['#c4ff96', 'rgba(70,200,60,.85)'], blood: ['#ff9a9a', 'rgba(200,0,40,.85)'], nature: ['#d2f7a8', 'rgba(90,180,70,.85)'],
    poison: ['#dcff90', 'rgba(120,200,40,.85)'], spark: ['#ffe9a8', 'rgba(255,170,60,.8)'],
  };
  const kindOf = c => {
    try { const sch = typeof fxSchoolOf === 'function' ? fxSchoolOf(c) : null; return typeof fxKindOf === 'function' ? fxKindOf(c.name, sch) : 'spark'; }
    catch (_) { return 'spark'; }
  };
  const baseOf = c => { try { return (typeof cardByName === 'function' && cardByName(c.name)) || null; } catch (_) { return null; } };
  const isLegend = c => !!c && (c.rarity === '전설' || (baseOf(c) || {}).rarity === '전설');

  // ---------- 무대 (한 번에 하나) ----------
  let stage = null, skipFn = null;
  function open(cls) {
    close();
    stage = document.createElement('div'); stage.className = 'pfx ' + (cls || '');
    stage.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (skipFn) skipFn(); }, true);
    document.body.appendChild(stage);
    return stage;
  }
  function close() { if (stage) { stage.remove(); stage = null; } skipFn = null; }
  // 누르면 기다림을 끝내는 sleep
  function wait(ms) { return new Promise(r => { const t = setTimeout(done, ms); function done() { clearTimeout(t); skipFn = null; r(); } skipFn = done; }); }
  const anim = (el, kf, o) => el.animate ? el.animate(kf, Object.assign({ fill: 'forwards' }, o)) : null;
  const fit = (h, frac, max) => Math.max(1.2, Math.min(max, innerHeight * frac / h, innerWidth * .8 / 92));

  function makeCard(c) {
    const wrap = document.createElement('div'); wrap.className = 'pfx-card';
    let el = null;
    try { if (typeof cardEl === 'function') el = cardEl(c, {}); } catch (_) {}
    if (!el) { el = document.createElement('div'); el.className = 'card'; el.textContent = c.name; }
    el.style.pointerEvents = 'none';
    wrap.appendChild(el);
    return wrap;
  }
  function sparks(host, n, c1, c2, spread) {
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i'); s.className = 'pfx-spark';
      s.style.background = `radial-gradient(circle, #fff 0, ${c1} 35%, ${c2} 70%, transparent 72%)`;
      host.appendChild(s);
      const a = Math.random() * Math.PI * 2, d = spread * (.45 + Math.random() * .7), sz = 4 + Math.random() * 9;
      s.style.width = s.style.height = sz + 'px';
      const k = anim(s, [{ transform: 'translate(-50%,-50%) translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(-50%,-50%) translate(${Math.cos(a) * d}px,${Math.sin(a) * d - 30}px) scale(.2)`, opacity: 0 }],
        { duration: 700 + Math.random() * 600, easing: 'cubic-bezier(.2,.7,.4,1)', delay: Math.random() * 120 });
      if (k) k.onfinish = () => s.remove(); else s.remove();
    }
  }

  // ---------- 전설 하수인 ----------
  async function legend(c, seat) {
    const mine = seat === (typeof MY !== 'undefined' ? MY : 0);
    const st = open('pfx-legend');
    st.innerHTML = '<div class="pfx-dim"></div><div class="pfx-rays"></div><div class="pfx-burst"></div>';
    const card = makeCard(c), sc = fit(146, .52, 3.2);
    const ban = document.createElement('div'); ban.className = 'pfx-banner';
    ban.innerHTML = `<small>${mine ? '전설 등장' : '상대의 전설'}</small><b>${escH(c.name)}</b>`;
    st.append(card, ban);
    const fromY = mine ? innerHeight * .55 : -innerHeight * .55;
    anim(st.querySelector('.pfx-dim'), [{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
    anim(st.querySelector('.pfx-rays'), [{ opacity: 0, transform: 'translate(-50%,-50%) rotate(0deg) scale(.6)' },
      { opacity: 1, transform: 'translate(-50%,-50%) rotate(40deg) scale(1)', offset: .25 },
      { opacity: .85, transform: 'translate(-50%,-50%) rotate(160deg) scale(1.1)' }], { duration: 2400, easing: 'linear' });
    anim(card, [{ transform: `translate(-50%,-50%) translateY(${fromY}px) scale(${sc * .55}) rotate(${mine ? -8 : 8}deg)`, opacity: 0 },
      { transform: `translate(-50%,-50%) translateY(-14px) scale(${sc * 1.08}) rotate(0deg)`, opacity: 1, offset: .7 },
      { transform: `translate(-50%,-50%) scale(${sc})`, opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,.9,.3,1)' });
    snd('pack', { gap: 0 });
    await wait(470); if (!stage) return;
    // 쿵
    shake(9, 420); snd('thud', { gap: 0 }); snd('gold', { gap: 0 });
    anim(st.querySelector('.pfx-burst'), [{ opacity: .95, transform: 'translate(-50%,-50%) scale(.3)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(2.2)' }], { duration: 700, easing: 'ease-out' });
    sparks(st, 34, '#ffe08a', 'rgba(255,170,40,.8)', Math.min(innerWidth, innerHeight) * .42);
    anim(ban, [{ opacity: 0, transform: 'translate(-50%,0) scaleX(.2)' }, { opacity: 1, transform: 'translate(-50%,0) scaleX(1.06)', offset: .6 }, { opacity: 1, transform: 'translate(-50%,0) scaleX(1)' }], { duration: 360, easing: 'ease-out' });
    await wait(950);
    if (!stage) return;
    // 전장 쪽으로 빨려 들어감
    const toY = mine ? innerHeight * .12 : -innerHeight * .12;
    anim(card, [{ transform: `translate(-50%,-50%) scale(${sc})`, opacity: 1 }, { transform: `translate(-50%,-50%) translateY(${toY}px) scale(${sc * .35})`, opacity: 0 }], { duration: 300, easing: 'ease-in' });
    anim(st, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-in' });
    await sleep(300);
    close();
  }

  // ---------- 주문 ----------
  async function spell(c, seat, leg) {
    const mine = seat === (typeof MY !== 'undefined' ? MY : 0);
    const k = kindOf(c), [c1, c2] = GLOW[k] || GLOW.spark;
    const st = open('pfx-spell' + (leg ? ' pfx-legend' : '') + (mine ? ' mine' : ' opp'));
    st.style.setProperty('--c1', c1); st.style.setProperty('--c2', c2);
    st.innerHTML = (leg ? '<div class="pfx-dim soft"></div><div class="pfx-rays"></div>' : '') + '<div class="pfx-glow"></div>';
    const card = makeCard(c), sc = fit(146, mine ? .34 : .42, mine ? 2.1 : 2.6);
    st.appendChild(card);
    if (leg) { const ban = document.createElement('div'); ban.className = 'pfx-banner'; ban.innerHTML = `<small>전설 주문</small><b>${escH(c.name)}</b>`; st.appendChild(ban);
      anim(ban, [{ opacity: 0, transform: 'translate(-50%,0) scaleX(.2)' }, { opacity: 1, transform: 'translate(-50%,0) scaleX(1)' }], { duration: 320, delay: 200, easing: 'ease-out' }); }
    if (leg) { anim(st.querySelector('.pfx-rays'), [{ opacity: 0, transform: 'translate(-50%,-50%) rotate(0deg) scale(.7)' }, { opacity: .8, transform: 'translate(-50%,-50%) rotate(120deg) scale(1)' }], { duration: 1800, easing: 'linear' });
      anim(st.querySelector('.pfx-dim'), [{ opacity: 0 }, { opacity: 1 }], { duration: 220 }); }
    const y0 = mine ? innerHeight * .25 : -innerHeight * .2;
    anim(card, [{ transform: `translate(-50%,-50%) translateY(${y0}px) scale(${sc * .6})`, opacity: 0 },
      { transform: `translate(-50%,-50%) scale(${sc})`, opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,.9,.3,1)' });
    anim(st.querySelector('.pfx-glow'), [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.5)' }, { opacity: .9, transform: 'translate(-50%,-50%) scale(1)' }], { duration: 260 });
    if (leg) { snd('pack', { gap: 0 }); shake(5, 300); }
    await wait(leg ? 1100 : mine ? 380 : 900);
    if (!stage) return;
    // 속성 색으로 타서 사라짐
    sparks(st, leg ? 30 : 18, c1, c2, Math.min(innerWidth, innerHeight) * (leg ? .35 : .22));
    anim(card, [{ transform: `translate(-50%,-50%) scale(${sc})`, opacity: 1, filter: 'brightness(1)' },
      { transform: `translate(-50%,-50%) scale(${sc * 1.08})`, opacity: .9, filter: `brightness(1.8) drop-shadow(0 0 18px ${c1})`, offset: .4 },
      { transform: `translate(-50%,-50%) scale(${sc * 1.18})`, opacity: 0, filter: `brightness(2.4) blur(6px) drop-shadow(0 0 30px ${c2})` }], { duration: 380, easing: 'ease-in' });
    anim(st.querySelector('.pfx-glow'), [{ opacity: .9, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.8)' }], { duration: 420, easing: 'ease-out' });
    if (leg) anim(st, [{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 120 });
    await sleep(leg ? 520 : 400);
    close();
  }

  // 'play' 이벤트 (손에서 낸 카드)
  async function onPlay(ev) {
    if (!Opt.get() || document.hidden || !ev) return;
    const c = ev.card || baseOf({ name: ev.name }); if (!c) return;
    try {
      if (c.type === 'spell') await spell(c, ev.seat, isLegend(c));
      else if (c.type === 'minion' && isLegend(c)) await legend(c, ev.seat);
    } catch (e) { console.warn('playfx', e); close(); }
  }

  // ---------- 모험 보스 등장 ----------
  async function bossIntro(boss) {
    if (!Opt.get() || !boss) return;
    try {
      const img = typeof advIsImgIcon === 'function' && advIsImgIcon(boss.icon);
      const st = open('pfx-boss');
      const tag = boss.stage ? `${boss.stage}단계 보스` : '모험 보스';
      st.innerHTML = `<div class="pfx-dim deep"></div><div class="pfx-bar top"></div><div class="pfx-bar bot"></div>
        <div class="pb-pic">${img ? `<img src="${escH(boss.icon)}" alt="">` : `<span>${escH(boss.icon || '👑')}</span>`}</div>
        <div class="pb-slash"></div>
        <div class="pb-txt"><small>${escH(tag)}</small><b>${escH(boss.name)}</b>${boss.desc ? `<p>${escH(boss.desc)}</p>` : ''}</div>
        <div class="pb-skip">누르면 넘어가요</div>`;
      const q = s => st.querySelector(s);
      anim(q('.pfx-dim'), [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
      anim(q('.pfx-bar.top'), [{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }], { duration: 380, easing: 'cubic-bezier(.2,.9,.3,1)' });
      anim(q('.pfx-bar.bot'), [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], { duration: 380, easing: 'cubic-bezier(.2,.9,.3,1)' });
      anim(q('.pb-pic'), [{ opacity: 0, transform: 'translate(-50%,-50%) translateX(-60px) scale(1.25)', filter: 'brightness(0)' },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', filter: 'brightness(1)' }], { duration: 700, delay: 150, easing: 'cubic-bezier(.2,.8,.3,1)' });
      snd('swing', { gap: 0 });
      await wait(620); if (!stage) return;
      snd('slash', { gap: 0 }); shake(7, 380);
      anim(q('.pb-slash'), [{ opacity: 0, transform: 'translate(-50%,-50%) rotate(-28deg) scaleX(0)' }, { opacity: 1, transform: 'translate(-50%,-50%) rotate(-28deg) scaleX(1)', offset: .35 },
        { opacity: 0, transform: 'translate(-50%,-50%) rotate(-28deg) scaleX(1.1)' }], { duration: 520, easing: 'ease-out' });
      anim(q('.pb-txt'), [{ opacity: 0, transform: 'translateY(-50%) translateX(40px)', letterSpacing: '.4em' }, { opacity: 1, transform: 'translateY(-50%) translateX(0)', letterSpacing: '.02em' }], { duration: 480, easing: 'cubic-bezier(.2,.9,.3,1)' });
      sparks(st, 22, '#ffcf7a', 'rgba(200,40,20,.8)', Math.min(innerWidth, innerHeight) * .4);
      await wait(1700);
      if (!stage) return;
      anim(stage, [{ opacity: 1 }, { opacity: 0 }], { duration: 380 });
      await sleep(380);
      close();
    } catch (e) { console.warn('playfx boss', e); close(); }
  }

  // ---------- 모험 보스 격파: 글자 없이 초상화가 금 가고 깨진다 (약 1.9초, 끝나면 resolve) ----------
  //  1) 맞은 자리에서 금이 두 번에 걸쳐 퍼짐  2) 하얗게 번쩍 → 잿빛  3) 조각나 사방으로 튀고 떨어짐 + 불똥 · 금빛 터짐 · 큰 흔들림
  function crackSVG(cx, cy, seed) {
    let t = seed || 7; const rnd = () => ((t = (t * 9301 + 49297) % 233280) / 233280);
    const lines = [[], []];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * .5;
      let x = cx, y = cy, d = 'M' + x.toFixed(1) + ' ' + y.toFixed(1);
      const steps = 4 + Math.floor(rnd() * 3), len = 62 + rnd() * 18;
      for (let k = 1; k <= steps; k++) {
        const r = len * k / steps, w = (rnd() - .5) * .55;
        x = cx + Math.cos(a + w) * r; y = cy + Math.sin(a + w) * r;
        d += ' L' + x.toFixed(1) + ' ' + y.toFixed(1);
        if (k === 2 && rnd() < .6) {   // 곁가지
          const b = a + (rnd() < .5 ? -1 : 1) * (.5 + rnd() * .4), bl = 10 + rnd() * 14;
          lines[1].push(`M${x.toFixed(1)} ${y.toFixed(1)} L${(x + Math.cos(b) * bl).toFixed(1)} ${(y + Math.sin(b) * bl).toFixed(1)}`);
        }
      }
      lines[i % 2].push(d);
    }
    const path = (d, w, col, cls) => `<path class="${cls}" d="${d}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>`;
    const grp = (arr, cls) => arr.map(d => path(d, 4.2, 'rgba(20,8,0,.85)', cls) + path(d, 1.6, '#fff6dc', cls)).join('');
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${grp(lines[0], 'c1')}${grp(lines[1], 'c2')}</svg>`;
  }
  function bossDefeat(boss) {
    return new Promise(async resolve => {
      const av = document.getElementById('aiAvatar'), r = av && av.getBoundingClientRect();
      if (!boss || !Opt.get() || !r || !r.width || document.hidden) return resolve();
      const keep = []; let d = null;
      const done = () => { keep.forEach(f => { try { f(); } catch (_) {} }); if (d) d.remove(); resolve(); };
      try {
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = Math.max(r.width, r.height);
        // 맞은 자리: 가운데에서 살짝 비껴서
        const hx = 42 + Math.random() * 16, hy = 38 + Math.random() * 16;
        d = document.createElement('div'); d.className = 'pfx pfx-defeat';
        const box = document.createElement('div'); box.className = 'pd-box';
        Object.assign(box.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
        box.innerHTML = crackSVG(hx, hy, (Date.now() % 1000) + 3) + '<div class="pd-flash"></div>';
        d.appendChild(box); document.body.appendChild(d);
        const c1 = [...box.querySelectorAll('.c1')], c2 = [...box.querySelectorAll('.c2')];
        // 1) 금 — 두 번에 나눠 쩍
        shake(6, 200); snd('thud', { gap: 0 });
        c1.forEach(p => anim(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 160, easing: 'cubic-bezier(.2,.9,.3,1)' }));
        await sleep(420);
        shake(8, 240); snd('thud', { gap: 0 });
        c2.forEach(p => anim(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 140, easing: 'ease-out' }));
        anim(av, [{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 160, fill: 'none' });
        await sleep(380);
        // 2) 번쩍 → 잿빛
        anim(box.querySelector('.pd-flash'), [{ opacity: 0 }, { opacity: .95, offset: .3 }, { opacity: 0 }], { duration: 300 });
        const oldF = av.style.filter; av.style.filter = 'grayscale(1) brightness(.75)'; keep.push(() => { av.style.filter = oldF; });
        await sleep(160);
        // 3) 조각나 튐
        const pieces = 9, pts = [];
        for (let i = 0; i < pieces; i++) { const a = (i / pieces) * Math.PI * 2 + (Math.random() - .5) * .35; pts.push(a); }
        const edge = a => { const x = 50 + Math.cos(a) * 75, y = 50 + Math.sin(a) * 75; return `${x.toFixed(1)}% ${y.toFixed(1)}%`; };
        const oldV = av.style.visibility; av.style.visibility = 'hidden'; keep.push(() => { av.style.visibility = oldV; });
        box.querySelector('svg').remove();
        for (let i = 0; i < pieces; i++) {
          const a0 = pts[i], a1 = pts[(i + 1) % pieces] + (i === pieces - 1 ? Math.PI * 2 : 0), am = (a0 + a1) / 2;
          const sh = av.cloneNode(true); sh.removeAttribute('id'); sh.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
          [...sh.children].forEach(ch => { if (!(ch.tagName === 'SPAN' || ch.tagName === 'IMG')) ch.remove(); });
          sh.classList.add('pd-shard');
          Object.assign(sh.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', margin: '0', visibility: 'visible',
            filter: 'grayscale(1) brightness(.8)', clipPath: `polygon(${hx}% ${hy}%, ${edge(a0)}, ${edge(am)}, ${edge(a1)})` });
          d.appendChild(sh);
          const dist = R * (.7 + Math.random() * .7), dx = Math.cos(am) * dist, dy = Math.sin(am) * dist * .7, rot = (Math.random() - .5) * 140;
          anim(sh, [{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
            { transform: `translate(${dx * .55}px,${dy * .55 - R * .18}px) rotate(${rot * .5}deg)`, opacity: 1, offset: .35 },
            { transform: `translate(${dx}px,${dy + R * 1.1}px) rotate(${rot}deg)`, opacity: 0 }], { duration: 950 + Math.random() * 300, easing: 'cubic-bezier(.25,.6,.5,1)' });
        }
        const host = document.createElement('div'); host.className = 'pd-at'; host.style.left = cx + 'px'; host.style.top = cy + 'px';
        d.appendChild(host); sparks(host, 46, '#ffe08a', 'rgba(255,120,30,.85)', R * 1.6);
        try { if (typeof fxSprite === 'function') fxSprite('goldburst', cx, cy, R * 2.6, { dur: 900, z: 9700 }); } catch (_) {}
        shake(14, 560); snd('crumble', { gap: 0 }); snd('gold', { gap: 0 });
        await sleep(1250);
        anim(d, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
        await sleep(200);
      } catch (e) { console.warn('playfx defeat', e); }
      done();
    });
  }

  // ---------- 설정 체크박스 ----------
  function bindOption() {
    const cb = document.getElementById('optPlayFx'); if (!cb) return;
    cb.checked = Opt.get();
    cb.onchange = () => Opt.set(cb.checked);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindOption); else bindOption();

  return { onPlay, legend, spell, bossIntro, bossDefeat, Opt };
})();
window.PlayFx = PlayFx;
