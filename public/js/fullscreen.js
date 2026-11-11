// fullscreen.js — v160 전체 화면
//   · 설정 「전체 화면으로 시작」(기본 켬)이면 게임을 켜고 처음 누르거나(클릭·터치) 키를 칠 때 바로 전체 화면이 된다.
//     (브라우저 규칙상 페이지가 열리자마자 저절로 전체 화면을 켤 수는 없고, 사용자의 첫 동작이 한 번 필요하다)
//   · Esc 로 나가면 그 판에서는 다시 억지로 켜지 않는다. 설정 화면에서 끄거나 바로 켜고 끌 수 있다.
//   · 아이폰 사파리처럼 전체 화면을 지원하지 않는 곳에서는 아무것도 하지 않는다.
(function () {
  const KEY = 'cardDuel.autoFullscreen';
  const de = document.documentElement;
  const supported = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) && !!(de.requestFullscreen || de.webkitRequestFullscreen);
  const isOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const getAuto = () => { try { return localStorage.getItem(KEY) !== '0'; } catch (_) { return true; } };
  const setAuto = v => { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (_) {} };
  function enter() {
    if (!supported || isOn()) return;
    try { const r = (de.requestFullscreen || de.webkitRequestFullscreen).call(de, { navigationUI: 'hide' }); if (r && r.catch) r.catch(() => {}); } catch (_) {}
  }
  function exit() {
    if (!isOn()) return;
    try { const r = (document.exitFullscreen || document.webkitExitFullscreen).call(document); if (r && r.catch) r.catch(() => {}); } catch (_) {}
  }
  // 첫 동작 때 한 번만 자동으로 켠다
  let armed = supported && getAuto();
  function onFirst(e) {
    if (!armed) return;
    if (e.type === 'keydown' && (e.key === 'Escape' || e.key === 'F11' || e.ctrlKey || e.metaKey || e.altKey)) return;
    armed = false; enter();
  }
  ['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, onFirst, true));
  window.FullscreenPref = {
    supported, isOn, enter, exit,
    get auto() { return getAuto(); },
    set auto(v) { setAuto(!!v); armed = false; if (v) enter(); else exit(); },
    toggle() { if (isOn()) exit(); else enter(); },
  };
  const sync = () => { try { document.dispatchEvent(new CustomEvent('fullscreen-pref')); if (typeof layoutHand === 'function') setTimeout(() => layoutHand(), 120); } catch (_) {} };
  document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync);
})();
