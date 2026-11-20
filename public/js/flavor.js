// flavor.js — 기다리는 문구 · 빈 화면 대사 (v174)
//  · Flavor.wait(kind)  : 「불러오는 중…」 대신 쓰는 세계관 문구 (여러 개면 무작위 하나)
//  · Flavor.empty(kind) : 빈 목록 자리에 넣는 HTML — 제이나·가로쉬 얼굴 + 말풍선 한 줄
//  문구를 고치려면 아래 WAIT · EMPTY 만 손대면 된다. 다른 파일은 이 파일이 없어도 예전 문구로 돌아간다.
const Flavor = (() => {
  'use strict';
  const pick = a => Array.isArray(a) ? a[Math.floor(Math.random() * a.length)] : a;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const WAIT = {
    boot:     ['주점 문 여는 중…', '촛불 켜는 중…', '탁자 닦는 중…'],
    game:     ['카드 섞는 중', '탁자 펴는 중', '촛불 켜는 중', '카드 그림 말리는 중'],
    connect:  '주점 문 두드리는 중…',
    reconnect:'주점 문 다시 두드리는 중…',
    deck:     '카드 상자 여는 중…',
    quest:    '의뢰 게시판 살피는 중…',
    tutorial: '교본 펼치는 중…',
    rank:     '명예의 전당 펼치는 중…',
    replay:   '지난 판 기억 더듬는 중…',
    friends:  '단골 명부 넘기는 중…',
    chat:     '편지 꺼내는 중…',
    send:     '날아가는 중…',
    mine:     '작업대 뒤지는 중…',
    save:     '먹물 말리는 중…',
    story:    '이야기 펼치는 중…',
    scene:    '무대 꾸미는 중…',
  };

  // face: /tutorial/images/<face>.jpg (J1~J3 제이나, G1~G4 가로쉬)
  const EMPTY = {
    friends: [
      { face: 'G2', who: '가로쉬', t: '술잔을 함께 들 동료가 하나도 없군. 위 칸에 이름을 넣어 불러 봐라.' },
      { face: 'J1', who: '제이나', t: '아직 단골이 없네요. 위에서 아이디나 닉네임으로 친구를 찾아봐요.' },
    ],
    chat:  [ { face: 'J3', who: '제이나', t: '{name}님과는 아직 한마디도 안 나눴어요. 먼저 인사해 봐요.' } ],
    deck:  [ { face: 'G1', who: '가로쉬', t: '빈손으로 전장에 나갈 셈이냐? ＋ 새 덱부터 만들어라.' } ],
    mine:  [ { face: 'J2', who: '제이나', t: '작업대가 텅 비었네요. 위에서 나만의 카드를 하나 빚어 봐요.' } ],
    packs: [ { face: 'G3', who: '가로쉬', t: '아직 뜯은 팩이 하나도 없다고? 상점에 가서 하나 사 와라.' } ],
    rank:  [ { face: 'G4', who: '가로쉬', t: '명예의 전당이 비어 있군. 첫 이름은 네 것으로 새겨라.' } ],
    replay:[ { face: 'J1', who: '제이나', t: '돌아볼 판이 아직 없어요. 유저 대전을 한 판 하고 와요.' } ],
  };

  function wait(kind) { return pick(WAIT[kind]) || '불러오는 중…'; }
  function empty(kind, vars) {
    const e = pick(EMPTY[kind]); if (!e) return '';
    let t = esc(e.t);
    for (const [k, v] of Object.entries(vars || {})) t = t.split('{' + k + '}').join(esc(v));
    return `<div class="fl-empty"><img class="fl-face" src="/tutorial/images/${e.face}.jpg" alt="" draggable="false">`
      + `<div class="fl-bub"><b>${esc(e.who)}</b><span>${t}</span></div></div>`;
  }
  return { wait, empty, WAIT, EMPTY };
})();
