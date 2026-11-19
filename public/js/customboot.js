// customboot.js — 직접 만든 카드를 카드 풀(CARD_POOL)에 넣는다. engine.js 바로 뒤에서 불린다.
//   덱 편집·AI 대전·모험이 이름으로 카드를 찾을 수 있도록, 화면이 그려지기 전에 동기식으로 받아 둔다.
//   (승인된 카드 + 내가 만든 카드. 직접 만든 카드는 상점 팩·무작위 생성에는 나오지 않는다)
(function () {
  try {
    const x = new XMLHttpRequest();
    x.open('GET', '/api/customcards/pool', false);
    x.send();
    if (x.status !== 200) return;
    const cards = (JSON.parse(x.responseText) || {}).cards || [];
    for (const c of cards) if (!CARD_POOL.some(p => p.name === c.name)) CARD_POOL.push(c);
  } catch (e) { console.warn('[customboot] 직접 만든 카드를 불러오지 못했어요', e); }
})();
