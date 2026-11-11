// juice.js — v154 타격감 연출
//   · 화면 흔들림: 피해량에 비례해서 전장(.board)이 흔들린다. 영웅이 맞으면 더 세게
//   · 히트스톱: 공격이 꽂히는 순간 공격자·피격자가 잠깐 멈추고 하얗게 번쩍인다
//   · 카드 3D 기울기: (마우스) 손패·발견·멀리건 카드가 커서 쪽으로 기울고 빛이 맺힌다. 전설 카드는 무지개 광택
//   전투 기록 패널의 [화면 흔들림] 체크로 끌 수 있다. 기기 설정이 '동작 줄이기'면 처음부터 꺼져 있다
const Juice = (() => {
  const KEY = 'cardDuel.shake.v154';
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
  const Opt = {
    get() { try { const v = localStorage.getItem(KEY); return v ? v === 'on' : !reduced(); } catch (_) { return !reduced(); } },
    set(on) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (_) {} },
  };

  // ---------- 화면 흔들림 ----------
  let shakeAnim = null, shakePow = 0;
  function shake(pow, dur) {
    if (!Opt.get() || !(pow > 0)) return;
    const el = document.querySelector('.main .board'); if (!el || !el.animate) return;
    if (shakeAnim && shakeAnim.playState === 'running' && shakePow >= pow) return;   // 더 센 흔들림이 이미 진행 중
    if (shakeAnim) shakeAnim.cancel();
    const n = 7, kf = [];
    for (let i = 0; i <= n; i++) {
      const k = i === n ? 0 : pow * (1 - i / n);                                        // 점점 잦아든다
      kf.push({ transform: `translate(${((i % 2 ? -1 : 1) * k * (0.6 + Math.random() * 0.4)).toFixed(1)}px,${((Math.random() * 2 - 1) * k * 0.7).toFixed(1)}px)` });
    }
    shakePow = pow;
    shakeAnim = el.animate(kf, { duration: dur || 320, easing: 'linear' });
    shakeAnim.onfinish = shakeAnim.oncancel = () => { shakePow = 0; };
  }
  // 피해 이벤트 → 흔들림 세기. 작은 하수인 피해(1~3)는 흔들지 않는다
  function powOf(ev) {
    if (!ev || ev.type !== 'damage' || ev.absorbed || ev.immune || !(ev.amount > 0)) return 0;
    const a = Math.min(ev.amount, 12);
    if (ev.target && ev.target.kind === 'hero') return Math.min(14, 3 + a * 1.1);
    return a >= 4 ? Math.min(8, 1.5 + a * 0.6) : 0;
  }
  function shakeFor(evs) {
    let p = 0; for (const e of evs) p = Math.max(p, powOf(e));
    if (p) shake(p, 260 + p * 12);
  }

  // ---------- 히트스톱 ----------
  //   els: 멈출 요소들(공격자·피격자). 피해 합계에 따라 50~140ms 동안 하얗게 번쩍이며 멈춘다
  async function hitstop(els, total) {
    if (!(total > 0)) return;
    const ms = Math.min(140, 50 + total * 9);
    const list = els.filter(Boolean);
    list.forEach(el => el.classList.add('hit-flash'));
    await new Promise(r => setTimeout(r, reduced() ? 30 : ms));
    list.forEach(el => el.classList.remove('hit-flash'));
  }

  // ---------- 피해 숫자 크기 ----------
  function sizeDmg(f, amount) {
    if (!f || !(amount > 0)) return;
    const a = Math.min(amount, 12);
    f.style.fontSize = (1.3 * (1 + a * 0.09)).toFixed(2) + 'rem';
    if (a >= 5) f.classList.add('big');
  }

  // ---------- 카드 3D 기울기 (마우스·펜만) ----------
  const TILT_SEL = '.hand .card, #discoverGrid .card, #mulliganGrid .card, #screen-main .mm-mode';   // v154 메인 화면 모드 카드도
  const MAX_DEG = 14;
  let tiltEl = null, raf = 0, last = null;
  const fine = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (_) { return false; } };
  function isLegend(c) {                                                                 // 전설 카드면 무지개 광택
    try {
      const cd = typeof cardDetail !== 'undefined' && cardDetail.cardOf(c); if (!cd) return false;
      const base = (typeof cardByName === 'function' && cardByName(cd.name)) || cd;
      return base.rarity === '전설' || cd.rarity === '전설';
    } catch (_) { return false; }
  }
  function clearTilt() {
    if (!tiltEl) return;
    tiltEl.classList.remove('tilt', 'holo'); ['--rx', '--ry', '--mx', '--my', '--hx'].forEach(p => tiltEl.style.removeProperty(p));
    tiltEl = null;
  }
  function applyTilt() {
    raf = 0; const e = last; if (!e) return;
    if (document.body.classList.contains('dragging-cards') || (typeof ui !== 'undefined' && ui && ui.dragging) || reduced()) { clearTilt(); return; }
    const c = e.target.closest && e.target.closest(TILT_SEL);
    if (!c || c.classList.contains('card-back')) { clearTilt(); return; }
    if (c !== tiltEl) { clearTilt(); tiltEl = c; c.classList.add('tilt'); if (isLegend(c)) c.classList.add('holo'); }
    const r = c.getBoundingClientRect(); if (!r.width) return;
    const px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    c.style.setProperty('--ry', ((px - 0.5) * 2 * MAX_DEG).toFixed(1) + 'deg');
    c.style.setProperty('--rx', ((0.5 - py) * 2 * MAX_DEG).toFixed(1) + 'deg');
    c.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
    c.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    c.style.setProperty('--hx', (px * 100).toFixed(1) + '% ' + (py * 100).toFixed(1) + '%');
  }
  document.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || !fine()) return;
    last = e; if (!raf) raf = requestAnimationFrame(applyTilt);
  }, { passive: true });
  document.addEventListener('pointerdown', clearTilt, true);   // 누르면(끌기 시작) 바로 평평하게
  document.addEventListener('pointerleave', clearTilt);
  window.addEventListener('blur', clearTilt);

  // ---------- 설정 체크박스 ----------
  function bindOption() {
    const cb = document.getElementById('optShake'); if (!cb) return;
    cb.checked = Opt.get();
    cb.onchange = () => { Opt.set(cb.checked); if (cb.checked) shake(6, 300); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindOption); else bindOption();

  return { shake, shakeFor, powOf, hitstop, sizeDmg, clearTilt, Opt };
})();
window.Juice = Juice;
