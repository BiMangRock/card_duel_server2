// orient.js — v153 휴대폰·태블릿 가로 화면 맞추기 (게임 화면 index.html · 튜토리얼 페이지 공용)
//
//  · 휴대폰(짧은 변 600px 미만 터치 기기): 어느 화면이든 항상 가로. 세로로 들면 "가로로 돌려 주세요" 화면이 전부 덮는다.
//  · 태블릿(짧은 변 600px 이상 터치 기기): 대전 · 튜토리얼 · 모험 스토리(컷신) · 매칭 연출 중에만 가로. 메뉴·상점·덱 편집은 세로도 된다.
//  · PC(마우스): 아무것도 하지 않는다.
//  · 안드로이드 크롬 · 홈 화면에 추가한 앱: 전체화면에 들어가면 screen.orientation.lock('landscape') 로 진짜로 가로 고정.
//    아이폰 Safari 는 웹페이지가 화면 방향을 바꿀 수 없다 → 안내 화면을 띄우는 것이 할 수 있는 전부다.
//
//  html 요소에 붙는 class
//    dev-phone | dev-tablet | dev-desktop   기기 종류 (CSS 에서 크기 조절에 쓴다)
//    need-rotate                             지금 세로라서 안내 화면을 띄우는 중
//  다른 코드에서: Orient.kind · Orient.update() · Orient.lock()
(() => {
  'use strict';
  if (window.Orient) return;
  const html = document.documentElement;
  const mm = q => !!(window.matchMedia && matchMedia(q).matches);
  const touch = mm('(pointer:coarse)') || (navigator.maxTouchPoints > 1 && !mm('(pointer:fine)')) || /iPad|iPhone|Android.+Mobile/i.test(navigator.userAgent);
  const shortSide = () => Math.min(screen.width || innerWidth, screen.height || innerHeight);
  const kind = !touch ? 'desktop' : shortSide() < 600 ? 'phone' : 'tablet';
  html.classList.add('dev-' + kind);
  const isTutorial = /\/tutorial\//.test(location.pathname);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function portrait() {
    // 키보드가 올라오면 화면 높이가 줄어 "가로"로 잘못 보일 수 있으므로 화면(기기) 방향을 먼저 본다
    const t = screen.orientation && screen.orientation.type;
    if (t) return t.startsWith('portrait');
    if (typeof window.orientation === 'number') return Math.abs(window.orientation) !== 90;
    return innerHeight > innerWidth;
  }
  // 지금 가로가 꼭 필요한 화면인지
  function landscapeContext() {
    if (isTutorial) return true;
    const menu = document.getElementById('menu');
    if (menu && menu.classList.contains('hidden')) return true;                // 대전 · 리플레이 · 관전
    if (document.getElementById('cutscene') || document.getElementById('advStory') || document.getElementById('matchIntro')) return true;   // 모험 스토리 · 매칭 연출
    return false;
  }
  function need() {
    if (kind === 'desktop') return false;
    if (kind === 'phone') return true;                                        // 휴대폰은 항상 가로
    return landscapeContext();                                                // 태블릿은 게임 화면만
  }

  // ---------- 안내 화면 ----------
  function gate() {
    let g = document.getElementById('rotateHint');
    if (!g) {
      g = document.createElement('div'); g.id = 'rotateHint'; g.setAttribute('role', 'alertdialog'); g.setAttribute('aria-label', '가로 화면 안내');
      g.innerHTML = '<div class="rh-icon">📱</div><p>가로로 돌려서 플레이해 주세요</p><button type="button" class="rh-btn" id="rotateFsBtn">전체화면 · 가로로 보기</button><small></small>';
      document.body.appendChild(g);
    }
    if (!g.dataset.wired) {
      g.dataset.wired = '1';
      const sm = g.querySelector('small');
      if (sm) sm.textContent = isIOS
        ? '아이폰·아이패드는 기기를 직접 가로로 돌려 주세요. 돌려도 그대로면 제어 센터에서 「화면 방향 잠금」을 꺼 주세요.'
        : '아래 버튼을 누르면 전체화면으로 바뀌면서 자동으로 가로가 됩니다. 기기를 직접 돌려도 돼요. (자동 회전이 꺼져 있으면 켜 주세요)';
      const b = g.querySelector('#rotateFsBtn');
      if (b) { if (isIOS || !canFs()) b.hidden = true; b.addEventListener('click', e => { e.stopPropagation(); lock(true); }); }
      ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend', 'wheel'].forEach(t => g.addEventListener(t, e => { if (!(e.target.closest && e.target.closest('button'))) e.stopPropagation(); }, { passive: true }));
    }
    return g;
  }

  // ---------- 진짜 가로 고정 (안드로이드) ----------
  const canFs = () => !!(html.requestFullscreen || html.webkitRequestFullscreen);
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  async function lock(withFs) {
    try {
      if (withFs && !isFs() && canFs()) await (html.requestFullscreen || html.webkitRequestFullscreen).call(html, { navigationUI: 'hide' });
    } catch (_) {}
    try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (_) {}
    update();
  }

  let last = null;
  function update() {
    const on = need() && portrait();
    if (on !== last) {
      last = on;
      if (document.body) gate();
      html.classList.toggle('need-rotate', on);
    }
    // 전체화면(또는 홈 화면 앱)인 동안에는 가로로 묶어 둔다 — 휴대폰은 늘, 태블릿은 게임 화면일 때만
    if (need() && (isFs() || mm('(display-mode: fullscreen)') || mm('(display-mode: standalone)'))) {
      if (!update.locked) { update.locked = true; try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { update.locked = false; }); } catch (_) { update.locked = false; } }
    } else if (update.locked && kind === 'tablet') {
      update.locked = false; try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (_) {}
    }
  }
  const start = () => { gate(); update(); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  addEventListener('resize', update);
  addEventListener('orientationchange', () => setTimeout(update, 120));
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', update);
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => { update.locked = false; update(); }));
  setInterval(update, 500);                                                   // 화면 전환(대전 시작 · 컷신)을 따로 알려 주지 않아도 따라간다

  window.Orient = { kind, update, lock, portrait, need };
})();
