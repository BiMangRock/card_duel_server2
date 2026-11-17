// polish.js — v167 화면 다듬기
//   · 왼쪽 위 뒤로가기 버튼: 메뉴의 하위 화면(메인 말고)이 열려 있으면 항상 보인다. 누르면 그 화면 맨 아래의 「뒤로」 버튼을 대신 누른다
//     (화면마다 돌아가는 곳이 달라서, 원래 버튼이 하던 일을 그대로 따른다). Esc 키도 같다 — 창(모달)이 떠 있으면 Esc 는 그 창이 먼저
//   · 원래 맨 아래 「뒤로」 버튼은 숨긴다 (스크롤해서 찾을 필요 없음)
(function () {
  'use strict';
  const menu = () => document.getElementById('menu');
  let btn = null, target = null;

  function ensure() {
    if (btn) return btn;
    btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'navBack'; btn.setAttribute('aria-label', '뒤로');
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    btn.addEventListener('click', go);
    document.body.appendChild(btn);
    return btn;
  }
  // 지금 보이는 하위 화면의 「뒤로」 버튼 (맨 처음 것)
  function currentBack() {
    const m = menu(); if (!m || m.classList.contains('hidden') || m.offsetParent === null && getComputedStyle(m).display === 'none') return null;
    const sc = m.querySelector('.screen.show'); if (!sc || sc.id === 'screen-main') return null;
    return sc.querySelector('.menu-btn.back');
  }
  function update() {
    const b = ensure(), t = currentBack();
    // classList.add 는 이미 있는 이름이어도 속성을 다시 써서 관찰자가 또 깨어난다 → 바뀔 때만 손댄다
    if (target && target !== t && target.classList.contains('nb-proxy')) target.classList.remove('nb-proxy');
    target = t;
    if (t && !t.classList.contains('nb-proxy')) t.classList.add('nb-proxy');
    b.classList.toggle('show', !!t);
  }
  function go() { const t = currentBack(); if (t) t.click(); setTimeout(update, 0); }

  // Esc: 다른 창이 떠 있지 않을 때만 (화면을 넓게 덮는 고정 레이어가 있으면 그쪽이 먼저)
  function overlayOpen() {
    const vw = innerWidth, vh = innerHeight;
    for (const el of document.body.children) {
      if (el.id === 'menu' || el.id === 'navBack' || el.tagName === 'SCRIPT') continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height > vw * vh * 0.3) return true;
    }
    return false;
  }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    if (!currentBack() || overlayOpen()) return;
    e.preventDefault(); go();
  }, true);   // 다른 창들의 Esc 처리보다 먼저 본다 (창이 닫힌 뒤에 보면 화면까지 같이 넘어가 버림)

  // 화면이 바뀌면 다시 계산
  function hook() {
    if (typeof window.showScreen === 'function' && !window.showScreen.__nb) {
      const orig = window.showScreen;
      const wrapped = function () { const r = orig.apply(this, arguments); update(); return r; };
      wrapped.__nb = true; window.showScreen = wrapped;
    }
    const m = menu();
    if (m) new MutationObserver(() => update()).observe(m, { attributes: true, subtree: true, attributeFilter: ['class'] });
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
})();
