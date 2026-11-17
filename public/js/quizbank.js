// quizbank.js — v167 수능 컷신 · 모의고사 문제 묶음
//   과목별로 난이도(lv 1 쉬움 · 2 보통 · 3 어려움)를 붙여 둔다. 기출이 아니라 직접 만든 문제
//   QuizBank.draw(과목, 난이도): 아직 안 나온 문제 중에서 무작위. 그 과목을 다 돌면 다시 처음부터 (이 기기 · 계정별 기억)
//   과목 'mix' 는 모든 과목에서 섞어서
//   문제를 더하려면 아래 목록에 {id, lv, q, passage?, opts(5개), ans(0부터)} 를 추가하면 된다. id 는 겹치지 않게
const QuizBank = (() => {
  'use strict';
  const B = {
    '국어': [
      { id: 'k01', lv: 1, q: '맞춤법이 올바른 것은?', opts: ['오랫만에 만났다', '오랜만에 만났다', '오랜마네 만났다', '오랫마네 만났다', '오래만에 만났다'], ans: 1 },
      { id: 'k02', lv: 1, q: "'금세'의 뜻으로 알맞은 것은?", opts: ['지금 바로, 곧', '물건에 붙는 세금', '금으로 만든 장식', '조금 전에', '아주 오랫동안'], ans: 0 },
      { id: 'k03', lv: 1, q: '띄어쓰기가 바른 것은?', opts: ['할수 있다', '할 수 있다', '할수있다', '할 수있다', '할수 있 다'], ans: 1 },
      { id: 'k04', lv: 1, q: "'비 온 뒤에 땅이 굳어진다'의 뜻으로 알맞은 것은?", opts: ['비가 오면 땅이 단단해진다', '어려운 일을 겪은 뒤에 더 강해진다', '날씨는 알 수 없다', '땅은 비를 싫어한다', '공사는 비 온 뒤에 해야 한다'], ans: 1 },
      { id: 'k05', lv: 2, q: '표준어가 아닌 것은?', opts: ['짜장면', '자장면', '설거지', '설겆이', '먹거리'], ans: 3 },
      { id: 'k06', lv: 2, q: "'눈에 불을 켜다'의 뜻으로 가장 알맞은 것은?", opts: ['몹시 욕심을 내거나 관심을 기울이다', '눈병이 나다', '밤새 잠을 자지 않다', '불을 무서워하다', '눈물이 나다'], ans: 0 },
      { id: 'k07', lv: 2, q: '높임 표현이 잘못된 문장은?', opts: ['선생님께서 말씀하셨다', '할머니께서 진지를 드신다', '사장님의 말씀이 계시겠습니다', '아버지께서 주무신다', '교수님께 여쭈어 보았다'], ans: 2 },
      { id: 'k08', lv: 2, q: "'사실을 직접 증명하지는 않지만, 주변 상황을 밝혀 증명에 도움을 주는 것'을 뜻하는 말은?", opts: ['반증', '방증', '검증', '고증', '위증'], ans: 1 },
      { id: 'k09', lv: 3, q: '표기가 바른 것은?', opts: ['윗층', '위층', '웃층', '윗쪽', '웃쪽'], ans: 1 },
      { id: 'k10', lv: 3, q: "'결재'를 바르게 쓴 문장은?", opts: ['카드로 결재했다', '부장님께 서류 결재를 받았다', '물건값을 결재했다', '온라인 결재 완료', '현금 결재만 됩니다'], ans: 1 },
      { id: 'k11', lv: 3, q: '남의 말을 전할 때 맞는 표현은?', passage: '친구가 그러는데, 내일 비가 ______.', opts: ['온데', '온대', '온되', '온댸', '온데이'], ans: 1 },
      { id: 'k12', lv: 3, q: '외래어 표기가 바른 것은?', opts: ['메세지', '메시지', '매세지', '메쎄지', '멧세지'], ans: 1 },
    ],
    '수학': [
      { id: 'm01', lv: 1, q: '3 + 4 × 2 의 값은?', opts: ['14', '11', '10', '9', '24'], ans: 1 },
      { id: 'm02', lv: 1, q: '1시간 30분은 몇 분인가?', opts: ['130분', '90분', '150분', '60분', '100분'], ans: 1 },
      { id: 'm03', lv: 1, q: '삼각형의 세 내각을 모두 더하면?', opts: ['90°', '180°', '270°', '360°', '120°'], ans: 1 },
      { id: 'm04', lv: 1, q: '√49 의 값은?', opts: ['6', '7', '8', '9', '49'], ans: 1 },
      { id: 'm05', lv: 2, q: '2의 10제곱은?', opts: ['512', '1000', '1024', '2048', '100'], ans: 2 },
      { id: 'm06', lv: 2, q: 'x + 3 = 2x − 5 일 때, x 의 값은?', opts: ['2', '5', '8', '−2', '3'], ans: 2 },
      { id: 'm07', lv: 2, q: '6과목 평균이 80점이다. 한 과목을 더 봐서 7과목 평균이 81점이 되려면, 그 과목은 몇 점이어야 할까?', opts: ['81점', '85점', '87점', '88점', '90점'], ans: 2 },
      { id: 'm08', lv: 2, q: '주사위 하나를 던져 짝수가 나올 확률은?', opts: ['1/6', '1/3', '1/2', '2/3', '5/6'], ans: 2 },
      { id: 'm09', lv: 3, q: 'log₂ 32 의 값은?', opts: ['4', '5', '6', '16', '32'], ans: 1 },
      { id: 'm10', lv: 3, q: '등차수열 3, 7, 11, … 의 10번째 항은?', opts: ['39', '40', '43', '37', '41'], ans: 0 },
      { id: 'm11', lv: 3, q: 'x 가 0 으로 갈 때, sin x / x 의 극한값은?', opts: ['0', '1', '무한대', '존재하지 않는다', '1/2'], ans: 1 },
      { id: 'm12', lv: 3, q: '1부터 100까지 자연수를 모두 더하면?', opts: ['5000', '5050', '5100', '4950', '10100'], ans: 1 },
    ],
    '영어': [
      { id: 'e01', lv: 1, q: "Choose the opposite of 'early'.", opts: ['late', 'fast', 'soon', 'ready', 'slow'], ans: 0 },
      { id: 'e02', lv: 1, q: "'시험'을 뜻하는 영어 단어는?", opts: ['exam', 'example', 'exit', 'extra', 'exact'], ans: 0 },
      { id: 'e03', lv: 1, q: 'Choose the correct word.', passage: 'She ______ to school every day.', opts: ['go', 'goes', 'going', 'gone', 'to go'], ans: 1 },
      { id: 'e04', lv: 1, q: "'Good luck!'의 뜻으로 알맞은 것은?", opts: ['행운을 빌어!', '좋은 아침!', '잘 자!', '미안해!', '배고파!'], ans: 0 },
      { id: 'e05', lv: 2, q: '글쓴이의 심정으로 알맞은 것은?', passage: "I was so nervous that I couldn't sleep the night before the test.", opts: ['excited', 'nervous', 'bored', 'angry', 'proud'], ans: 1 },
      { id: 'e06', lv: 2, q: 'Choose the word that best fits the blank.', passage: 'If I ______ you, I would study harder.', opts: ['am', 'is', 'were', 'be', 'been'], ans: 2 },
      { id: 'e07', lv: 2, q: "'procrastinate'의 뜻은?", opts: ['미루다', '집중하다', '암기하다', '합격하다', '지각하다'], ans: 0 },
      { id: 'e08', lv: 2, q: 'Choose the correct sentence.', opts: ["He don't like math.", "He doesn't likes math.", "He doesn't like math.", 'He not like math.', 'He no likes math.'], ans: 2 },
      { id: 'e09', lv: 3, q: "Choose the word closest in meaning to 'inevitable'.", opts: ['avoidable', 'unavoidable', 'invisible', 'incredible', 'inefficient'], ans: 1 },
      { id: 'e10', lv: 3, q: 'Which is true according to the sentence?', passage: 'Despite studying all night, he felt confident rather than tired.', opts: ['He slept well.', 'He felt tired.', 'He felt confident.', 'He did not study.', 'He studied in the morning.'], ans: 2 },
      { id: 'e11', lv: 3, q: 'Choose the word that best fits the blank.', passage: 'The number of students ______ increasing every year.', opts: ['are', 'is', 'were', 'be', 'being'], ans: 1 },
      { id: 'e12', lv: 3, q: 'Choose the word that best fits the blank.', passage: 'Hardly ______ the bell rung when the students ran out.', opts: ['did', 'had', 'has', 'was', 'have'], ans: 1 },
    ],
    '아랍어': [
      { id: 'a01', lv: 1, q: "아랍어 인사말 '안녕하세요'로 가장 알맞은 것은?", opts: ['앗살라무 알라이쿰', '곤니치와', '니하오', '봉주르', '구텐 탁'], ans: 0 },
      { id: 'a02', lv: 1, q: "'감사합니다'를 뜻하는 아랍어는?", opts: ['슈크란', '메르시', '당케', '아리가토', '그라시아스'], ans: 0 },
      { id: 'a03', lv: 1, q: '아랍어는 어느 방향으로 쓰는가?', opts: ['왼쪽에서 오른쪽', '오른쪽에서 왼쪽', '위에서 아래', '아래에서 위', '마음 가는 대로'], ans: 1 },
      { id: 'a04', lv: 2, q: "아랍어로 '네'에 해당하는 말은?", opts: ['나암', '라', '슈크란', '마르하반', '얄라'], ans: 0 },
      { id: 'a05', lv: 2, q: '아랍어 알파벳은 몇 글자인가?', opts: ['24자', '26자', '28자', '30자', '32자'], ans: 2 },
      { id: 'a06', lv: 2, q: "'마르하반'의 뜻으로 알맞은 것은?", opts: ['반가워요', '잘 가요', '미안해요', '배고파요', '얼마예요'], ans: 0 },
      { id: 'a07', lv: 3, q: "아랍어로 '책'을 뜻하는 단어는?", opts: ['키타브', '칼람', '바이트', '마드라사', '샴스'], ans: 0 },
      { id: 'a08', lv: 3, q: "'마드라사'의 뜻은?", opts: ['학교', '시장', '사막', '바다', '도서관'], ans: 0 },
      { id: 'a09', lv: 3, q: "아랍어로 '펜'을 뜻하는 단어는?", opts: ['칼람', '키타브', '바이트', '샴스', '까마르'], ans: 0 },
    ],
    '한국사': [
      { id: 'h01', lv: 1, q: '훈민정음을 만든 왕은?', opts: ['태조', '세종', '정조', '영조', '광개토 대왕'], ans: 1 },
      { id: 'h02', lv: 1, q: '임진왜란 때 거북선을 이끈 장수는?', opts: ['강감찬', '을지문덕', '이순신', '김유신', '권율'], ans: 2 },
      { id: 'h03', lv: 1, q: '광복절은 몇 월 며칠인가?', opts: ['3월 1일', '6월 6일', '8월 15일', '10월 3일', '10월 9일'], ans: 2 },
      { id: 'h04', lv: 2, q: '고려를 세운 사람은?', opts: ['왕건', '이성계', '주몽', '온조', '궁예'], ans: 0 },
      { id: 'h05', lv: 2, q: '3·1 운동이 일어난 해는?', opts: ['1910년', '1919년', '1945년', '1950년', '1929년'], ans: 1 },
      { id: 'h06', lv: 2, q: '한글날은 몇 월 며칠인가?', opts: ['10월 3일', '10월 9일', '5월 15일', '3월 1일', '7월 17일'], ans: 1 },
      { id: 'h07', lv: 3, q: '수원 화성을 쌓을 때 쓰인, 정약용이 설계한 기구는?', opts: ['거중기', '측우기', '자격루', '앙부일구', '혼천의'], ans: 0 },
      { id: 'h08', lv: 3, q: '통일 신라에서 9주 5소경 체제를 정비한 왕은?', opts: ['문무왕', '신문왕', '진흥왕', '법흥왕', '무열왕'], ans: 1 },
    ],
  };
  const SUBJ = Object.keys(B);
  Object.entries(B).forEach(([s, list]) => list.forEach(x => { x.subj = s; }));

  const key = () => { const u = typeof window !== 'undefined' ? window.CURRENT_USER : null; return 'cardDuel.quizSeen.' + (u && (u.username || u.id) ? (u.username || u.id) : 'guest'); };
  const loadSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(key()) || '[]')); } catch (_) { return new Set(); } };
  const saveSeen = s => { try { localStorage.setItem(key(), JSON.stringify([...s])); } catch (_) {} };
  const rnd = a => a[Math.floor(Math.random() * a.length)];

  // lv 에 맞는 안 나온 문제 → 없으면 가까운 난이도 → 그 과목을 다 돌았으면 그 과목 기록만 지우고 다시
  function draw(subj, lv, avoid) {
    const skip = new Set(avoid || []);
    // 섞기: 이번 묶음에서 아직 남은 문제가 있는 과목 중에서 고른다 (한 과목이 먼저 바닥나도 끝까지 이어지게)
    const left = SUBJ.filter(x => B[x].some(q => !skip.has(q.id)));
    const s = subj === 'mix' || !B[subj] ? rnd(left.length ? left : SUBJ) : subj;
    const list = B[s], seen = loadSeen();
    const fresh = list.filter(x => !seen.has(x.id) && !skip.has(x.id));
    let pool = fresh.length ? fresh : list.filter(x => !skip.has(x.id));
    if (!fresh.length) { list.forEach(x => seen.delete(x.id)); }
    const want = Math.max(1, Math.min(3, Math.round(lv || 2)));
    for (const d of [0, 1, -1, 2, -2]) { const at = pool.filter(x => x.lv === want + d); if (at.length) { pool = at; break; } }
    const q = rnd(pool); if (!q) return null;
    seen.add(q.id); saveSeen(seen);
    return q;
  }
  // 맞힌 개수가 늘수록 쉬워진다: 문제 수의 1/3 씩 맞힐 때마다 한 단계 (3문제면 1개 맞힐 때마다)
  const levelFor = (ok, total) => Math.max(1, 3 - Math.floor(ok / Math.max(1, Math.ceil(total / 3))));
  const count = () => SUBJ.reduce((n, s) => n + B[s].length, 0);
  return { draw, levelFor, count, SUBJ, BANK: B };
})();
if (typeof window !== 'undefined') window.QuizBank = QuizBank;
if (typeof module !== 'undefined') module.exports = QuizBank;

// ===================== v168 수능 기출 (public/data/gichul.json, 문항 그림) =====================
//  교시마다 정해진 구성으로 뽑는다. 이 계정에서 안 나온 문제가 먼저, 다 나왔으면 전체에서 무작위 (서버 DB: /api/quiz/seen)
//   국어 2점 2 + 3점 1 · 수학 2점 1 + 3점 1 + 4점 1 · 영어 2점 2 + 3점 1 (힌트는 가장 높은 배점 문제)
//   탐구 사회 1 + 과학 1 + 한국사·한문 중 1 (힌트는 셋 중 무작위 하나)
const Gichul = (() => {
  'use strict';
  let data = null, seen = null, loading = null;
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  function load() {
    if (data && seen) return Promise.resolve(data);
    if (loading) return loading;
    loading = (async () => {
      if (!data) { try { data = await (await fetch('/data/gichul.json', { credentials: 'same-origin' })).json(); } catch (_) { data = []; } }
      if (!seen) { try { const r = await fetch('/api/quiz/seen', { credentials: 'same-origin' }); seen = r.ok ? ((await r.json()).seen || {}) : {}; } catch (_) { seen = {}; } }
      loading = null; return data;
    })();
    return loading;
  }
  function pick(test, used) {
    const pool = (data || []).filter(q => test(q) && !used.includes(q.id));
    if (!pool.length) return null;
    const fresh = pool.filter(q => !seen[q.id]);
    return rnd(fresh.length ? fresh : pool);
  }
  function mark(ids) {
    ids = ids.filter(Boolean); if (!ids.length) return;
    ids.forEach(id => { seen[id] = (seen[id] || 0) + 1; });
    try { fetch('/api/quiz/seen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }), credentials: 'same-origin', keepalive: true }).catch(() => {}); } catch (_) {}
  }
  const PLANS = {
    '국어': [q => q.area === '국어' && q.pts === 2, q => q.area === '국어' && q.pts === 2, q => q.area === '국어' && q.pts === 3],
    '수학': [q => q.area === '수학' && q.pts === 2, q => q.area === '수학' && q.pts === 3, q => q.area === '수학' && q.pts === 4],
    '영어': [q => q.area === '영어' && q.pts === 2, q => q.area === '영어' && q.pts === 2, q => q.area === '영어' && q.pts === 3],
    '탐구': [q => q.area === '사회', q => q.area === '과학', q => q.area === '한국사' || q.area === '한문'],
  };
  // [{q, hint}] — 힌트는 한 문제에만
  async function plan(kind) {
    await load();
    const tests = PLANS[kind] || []; const used = [], out = [];
    for (const t of tests) { const q = pick(t, used); if (q) { used.push(q.id); out.push({ q, hint: false }); } }
    if (!out.length) return out;
    if (kind === '탐구') rnd(out).hint = true;
    else { const top = Math.max(...out.map(x => x.q.pts)); out.filter(x => x.q.pts === top).slice(-1)[0].hint = true; }
    mark(used);
    return out;
  }
  const timeFor = pts => (pts >= 4 ? 600 : pts === 3 ? 300 : 120) * 1000;   // 2점 2분 · 3점 5분 · 4점 10분 (1점도 2분)
  return { load, plan, pick, mark, timeFor, get data() { return data; }, get seen() { return seen; } };
})();
if (typeof window !== 'undefined') window.Gichul = Gichul;
