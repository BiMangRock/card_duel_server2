// tut-hand.js — v157 튜토리얼 손패 (터치 화면): 오른쪽 구석의 작은 손패를 누르면 먼저 크게 올라오고,
// 올라온 손패에서 카드를 누르면 평소처럼 고른 뒤 다시 내려간다. 손패 바깥을 누르면 내려간다. (PC 는 마우스만 올려도 CSS 로 올라온다)
(function () {
  if (!(window.matchMedia && matchMedia('(pointer:coarse)').matches)) return;
  const hand = () => document.getElementById('hand');
  document.addEventListener('click', e => {
    const h = hand(); if (!h || !e.target.closest) return;
    const c = e.target.closest('#hand .hc');
    const shown = h.classList.contains('up') || (h.querySelector('.hl') && !h.querySelector('.picked'));
    if (c && !shown) { e.stopPropagation(); e.preventDefault(); h.classList.add('up'); return; }
    if (h.classList.contains('up')) { if (c) setTimeout(() => { const hh = hand(); if (hh) hh.classList.remove('up'); }, 0); else if (!e.target.closest('#hand')) h.classList.remove('up'); }
  }, true);
})();
