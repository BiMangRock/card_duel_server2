// pvpclient.js — 유저 대전 (화면 쪽).  로드 순서: pvp.js → … → ui.js → pvpclient.js
//  - 서버가 판을 들고 있다. 이 파일은 (1) SSE 스트림으로 서버 메시지를 받고 (2) 내 행동을 POST 로 보내고
//    (3) 받은 "내 시점 화면(view) + 이벤트"를 기존 화면 코드(ui.js 의 playEvents · render)로 그려 줄 뿐이다.
//  - 상대 AI 를 브라우저에서 돌리는 기존 대전과 달리, 여기서는 판 상태를 브라우저가 계산하지 않는다.
//  - ui.js 의 전역(MY·OPP·view·game·ui·Host·render·playEvents 등)을 그대로 쓴다.
const PvpClient = (() => {
  'use strict';
  const J = { 'Content-Type': 'application/json' };
  const S = {
    es: null, esOpen: false, want: false, retryMs: 0, replaced: false,   // 실시간 연결(v148 웹소켓) / 화면에서 필요로 하는지
    status: null, cfg: null,                              // 서버가 알려 준 상태(전적·대기 인원…)와 시간 설정
    matchId: null, lastSeq: -1, over: false,              // 지금 화면에 그리고 있는 판
    chain: Promise.resolve(),                             // 서버 메시지는 순서대로 하나씩 처리한다 (연출이 끝난 뒤 다음 것)
    phase: null, deadline: 0, mullDeadline: 0, turnSeat: 0, timeouts: 0, maxTimeouts: 3,
    oppOffAt: 0, reconnectMs: PVP.RECONNECT_MS, waitTimer: null, queuedAt: 0, msg: '', retry: null, mode: 'normal', ranked: false,   // v127 일반전 / 랭크전
  };
  const sec = ms => Math.max(0, Math.ceil(ms / 1000));
  const cfgOf = () => ({ turnMs: PVP.TURN_MS, mulliganMs: PVP.MULLIGAN_MS, reconnectMs: PVP.RECONNECT_MS, maxTimeouts: PVP.MAX_TIMEOUTS, ...(S.cfg || {}) });

  async function post(url, body) {
    try {
      const r = await fetch(url, { method: 'POST', headers: J, body: JSON.stringify(body || {}), credentials: 'same-origin' });
      if (r.status === 401) { location.replace('/login.html'); await new Promise(() => {}); }
      return { status: r.status, ok: r.ok, data: await r.json().catch(() => ({})) };
    } catch (e) { return { status: 0, ok: false, data: { error: '서버에 연결할 수 없어요.' } }; }
  }

  // ---------- 아바타 (액자 안 첫 글자) ----------
  const hue = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) % 360; return h; };
  function setAvatar(id, name) {
    const box = el(id); if (!box) return; const sp = box.firstElementChild;
    sp.textContent = ([...String(name || '?').trim()][0] || '?').toUpperCase();
    box.style.setProperty('--ah', hue(name));
  }
  async function loadMe() {
    if (S.meName) return;
    try { const r = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' }); if (r.ok) { const u = await r.json(); S.meName = (u.user && (u.user.name || u.user.username)) || u.username || ''; } } catch (_) {}
  }

  // ---------- 알림 띠 (연결 끊김 · 상대 끊김) ----------
  function banner(text, bad) {
    let el = document.getElementById('pvpBanner');
    if (!el) { el = document.createElement('div'); el.id = 'pvpBanner'; document.body.appendChild(el); }
    if (!text) { el.style.display = 'none'; return; }
    el.textContent = text; el.classList.toggle('bad', !!bad); el.style.display = 'block';
  }

  // ---------- 실시간 통로 (v148 웹소켓) ----------
  //  예전엔 SSE(EventSource)였지만 Cloudflare Quick Tunnel(trycloudflare.com)이 SSE 본문을 붙잡아 두어
  //  서버 상태가 오지 않았다(→ '상대 찾기' 버튼이 잠김). 웹소켓은 터널을 그대로 통과한다.
  //  서버 → 화면 메시지는 예전과 같은 JSON. 화면 → 서버 행동은 지금처럼 POST.
  //  웹소켓은 끊겨도 저절로 다시 붙지 않으므로 여기서 직접 다시 붙는다 (1초 → 최대 5초 간격).
  const wsUrl = () => (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/pvp/ws';
  function open() {
    S.want = true; S.replaced = false;                    // v148 직접 다시 열면 이 탭이 자리를 되찾는다
    if (S.es) return;
    clearTimeout(S.retry);
    let ws; try { ws = new WebSocket(wsUrl()); } catch (e) { retryLater(); return; }
    S.es = ws;
    ws.onopen = () => { if (S.es !== ws) return; S.esOpen = true; S.retryMs = 0; S.lastRx = Date.now(); renderScreen(); if (typeof Friends !== 'undefined') Friends.load(); };
    ws.onmessage = ev => { if (S.es !== ws) return; S.lastRx = Date.now(); let m; try { m = JSON.parse(ev.data); } catch (_) { return; } onMsg(m); };
    ws.onclose = () => {
      if (S.es !== ws) return;                             // 이미 새 연결로 바꾼 뒤에 닫힌 옛 연결
      S.es = null; S.esOpen = false; renderScreen(); if (S.matchId && !S.over) tickHud();
      retryLater();
    };
    ws.onerror = () => {};                                 // 이어서 onclose 가 온다
  }
  function retryLater() {
    if (!S.want || S.replaced) return;
    clearTimeout(S.retry);
    S.retryMs = Math.min(5000, (S.retryMs || 500) * 2);
    S.retry = setTimeout(async () => {
      if (!S.want || S.es || S.replaced) return;
      try { const r = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' }); if (r.status === 401) { location.replace('/login.html'); return; } } catch (_) {}   // 로그인이 풀렸으면 로그인 화면으로
      open();
    }, S.retryMs);
  }
  function close() {
    S.want = false; clearTimeout(S.retry);
    const ws = S.es; S.es = null; S.esOpen = false;
    if (ws) { try { ws.close(); } catch (_) {} }
  }
  function resync() { const ws = S.es; S.es = null; S.esOpen = false; if (ws) { try { ws.close(); } catch (_) {} } if (S.want) open(); }   // 다시 접속하면 서버가 현재 상태를 통째로 보내 준다

  // ---------- v153 연결 살아 있는지 확인 (휴대폰 대비) ----------
  //  휴대폰은 화면을 끄거나 다른 앱에 갔다 오면 웹소켓이 "열려 있는 척"만 하고 실제로는 끊겨 있는 일이 흔하다.
  //  그러면 서버는 나를 오프라인으로 보고, 친구가 보낸 대전 신청도 오지 않는다.
  //  → 20초마다 'ping' 을 보내고 서버의 'pong' 이 45초 넘게 안 오면 다시 붙는다. 화면이 다시 보이면 바로 확인한다.
  S.lastRx = 0;
  function ping() { const ws = S.es; if (ws && ws.readyState === 1) { try { ws.send('ping'); } catch (_) {} } }
  setInterval(() => {
    if (!S.want || S.replaced) return;
    if (!S.es) return;                                                       // 다시 붙는 중 (retryLater)
    if (S.esOpen && S.lastRx && Date.now() - S.lastRx > 45000) { resync(); return; }
    ping();
  }, 20000);
  function wake() {                                                          // 화면이 다시 보일 때 · 네트워크가 돌아왔을 때
    if (document.visibilityState === 'hidden') return;
    if (S.replaced) { S.replaced = false; open(); renderScreen(); return; }  // 다른 탭(기기)에 넘겼던 자리를, 지금 보고 있는 이 화면이 되찾는다
    if (!S.want) return;
    if (!S.es) { clearTimeout(S.retry); S.retryMs = 0; open(); return; }
    const sent = Date.now(); ping();
    setTimeout(() => { if (S.es && S.lastRx < sent) resync(); }, 4000);   // 4초 안에 답이 없으면 끊긴 연결
  }
  document.addEventListener('visibilitychange', wake);
  addEventListener('pageshow', e => { if (e.persisted) wake(); });            // 뒤로 가기 캐시에서 돌아옴
  addEventListener('online', wake);

  function onMsg(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'pong') return;                                           // v153 연결 확인 답
    if (m.t === 'status') {
      S.status = m; if (m.cfg) S.cfg = m.cfg;
      if (m.state === 'queue' && !S.queuedAt) S.queuedAt = Date.now();
      if (m.state === 'queue' && m.mode && m.mode !== S.mode) { S.mode = m.mode; S.queuedAt = Date.now(); }   // v127 대기 중인 대기열에 맞춘다
      if (m.state !== 'queue') S.queuedAt = 0;
      renderScreen();
    } else if (m.t === 'match') {
      m._at = Date.now();                                                 // v147 받은 시각 (연출로 늦게 처리돼도 남은 시간을 맞게 잰다)
      S.chain = S.chain.then(() => handleMatch(m)).catch(e => console.error('[pvp]', e));
    } else if (m.t === 'emote') {                                         // v132 상대 감정 표현 (v136 관전 중이면 양쪽 다)
      if (m.matchId === S.matchId) { const x = PROGRESS.EMOTES.find(e => e.id === m.id); if (x) showBubble(m.seat === MY ? MY : OPP, x.text); }
    } else if (m.t === 'spectators') {                                    // v136 내 판을 보는 사람 수
      if (m.matchId === S.matchId) { S.specCount = m.count || 0; setBadge(); }
    } else if (['invite', 'inviteSent', 'inviteGone', 'friends', 'chat', 'chatRead'].includes(m.t)) {   // v136 친구 · 친구 대전 신청 · v141 채팅 → friends.js
      if (typeof Friends !== 'undefined') Friends.onMsg(m);
    } else if (m.t === 'presence') {
      if (m.matchId === S.matchId) { S.oppOffAt = m.oppOnline ? 0 : Date.now() - (m.oppOfflineMs || 0); S.reconnectMs = m.reconnectMs || S.reconnectMs; tickHud(); }
    } else if (m.t === 'error') {
      showMsg(m.error || '문제가 생겼어요.');
    } else if (m.t === 'replaced') {                                      // v148 같은 계정의 새 탭(기기)이 자리를 가져갔다 → 다시 붙지 않는다 (서로 밀어내기 방지)
      close(); S.replaced = true;
      renderScreen(); if (S.matchId && !S.over) tickHud();
    }
  }

  // ---------- 대전 화면 (대기열) ----------
  const el = id => document.getElementById(id);
  function showMsg(t) { S.msg = t || ''; const p = el('pvpMsg'); if (p) { p.textContent = S.msg; p.style.display = S.msg ? '' : 'none'; } }
  function renderScreen() {
    const scr = el('screen-pvp'); if (!scr || !scr.classList.contains('show')) return;
    const st = S.status, c = cfgOf();
    if (st) {
      const r = st.record || { wins: 0, losses: 0, draws: 0 };
      el('pvpWins').textContent = r.wins; el('pvpLosses').textContent = r.losses; el('pvpDraws').textContent = r.draws;
      el('pvpToday').textContent = st.rewardsToday || 0;
      setGauge(st.rewardsToday || 0);
      const w = S.mode === 'rank' ? (st.waitingRank || 0) : (st.waiting || 0);
      el('pvpWaiting').textContent = st.state === 'queue' ? `${w}명 (나 포함)` : `${w}명`;
      renderRank(st.rank);
    }
    document.querySelectorAll('#pvpModes button').forEach(x => { x.classList.toggle('on', x.dataset.mode === S.mode); x.disabled = !!(st && st.state === 'queue'); });
    el('pvpRankBox').style.display = S.mode === 'rank' ? '' : 'none';
    { const fb = el('pvpFallbackBtn'), long = st && st.state === 'queue' && S.mode === 'rank' && S.queuedAt && Date.now() - S.queuedAt > RANK.FALLBACK_MS;   // v127 랭크전 상대가 안 잡히면
      fb.style.display = long ? '' : 'none'; }
    const b = el('pvpFindBtn'), q = st && st.state === 'queue';
    b.disabled = S.replaced ? false : (!S.esOpen || !st);                // v148 자리를 넘긴 탭: 누르면 이 탭으로 다시 가져온다
    b.classList.toggle('waiting', !!q && !S.replaced);
    el('pvpFindTxt').textContent = S.replaced ? '🔄 다른 탭(기기)에서 열려 있어요 · 눌러서 여기서 하기' : !S.esOpen ? '서버에 연결하는 중…' : q ? `${S.mode === 'rank' ? '랭크전' : '일반전'} 상대를 찾는 중… ${sec(Date.now() - S.queuedAt)}초 (누르면 취소)` : (S.mode === 'rank' ? '🏆 랭크전 상대 찾기' : '⚔️ 일반전 상대 찾기');
    el('pvpSpin').style.display = q && !S.replaced ? '' : 'none';
    el('pvpRules').textContent = `한 턴 ${sec(c.turnMs)}초 · 멀리건 ${sec(c.mulliganMs)}초 · 시간이 지나면 턴이 자동으로 넘어가고, 연속 ${c.maxTimeouts}번 넘기면 패배해요. 연결이 끊기면 ${sec(c.reconnectMs)}초 안에 돌아와야 해요.`;
    document.querySelectorAll('.pvpWinGold').forEach(x => { x.textContent = PVP.WIN_GOLD; });
  }
  // 오늘의 승리 게이지: 10승마다 한 바퀴 (보석 하나 = 1승). 보상과는 무관한 기록 표시다.
  function setGauge(n) {
    const lit = n > 0 && n % 10 === 0 ? 10 : n % 10;
    el('pvpGaugeFill').style.width = (lit * 10) + '%';
    document.querySelectorAll('#pvpGauge .ggem').forEach((g, i) => { g.classList.toggle('off', i >= lit); g.style.left = GEM_X[i] + '%'; });
  }
  const GEM_X = [12.77, 21.61, 29.57, 37.82, 45.78, 54.13, 62.38, 70.53, 78.68, 87.03];
  function openScreen() {
    loadMe();
    showMsg(''); showScreen('pvp'); open(); renderScreen();
  }
  async function toggleQueue() {
    if (S.replaced) { showMsg(''); open(); renderScreen(); return; }      // v148
    const st = S.status; if (!st || st.state === 'match') return;
    if (st.state === 'queue') { const r = await post('/api/pvp/cancel'); if (!r.ok && r.data.error) showMsg(r.data.error); return; }
    showMsg(''); const b = el('pvpFindBtn'); b.disabled = true;
    const saved = await ServerStore.waitSaved();                       // 대전은 서버에 저장된 내 덱으로 한다 → 방금 고친 덱이 저장될 때까지 기다린다
    if (!saved) { showMsg('저장이 아직 끝나지 않았어요. 잠시 뒤 다시 눌러 주세요.'); renderScreen(); return; }
    if (!Preload.isReady()) { showMsg(''); await Preload.ensure(); }         // v138 대기열에 들어가기 전에 그림을 전부 받아 둔다 (잡히면 바로 판이 시작되므로)
    const r = await post('/api/pvp/queue', { mode: S.mode, heroPower: HeroPowerPref.get() });   // v131
    if (!r.ok) showMsg(r.data.error || '대기열에 들어가지 못했어요.');
    renderScreen();
  }
  el('pvpFindBtn').onclick = toggleQueue;
  // ---------- v127 랭크전: 모드 탭 · 등급 배지 · 순위표 · 일반전 전환 ----------
  document.querySelectorAll('#pvpModes button').forEach(b => b.onclick = () => { if (S.status && S.status.state === 'queue') return; S.mode = b.dataset.mode; showMsg(''); renderScreen(); });
  el('pvpFallbackBtn').onclick = async () => { S.mode = 'normal'; S.queuedAt = Date.now(); const r = await post('/api/pvp/queue', { mode: 'normal', heroPower: HeroPowerPref.get() }); if (!r.ok) showMsg(r.data.error || '일반전으로 바꾸지 못했어요.'); renderScreen(); };
  const rankLine = rk => !rk ? '-' : rk.tier >= RANK.LEGEND ? `${ladderLabel(rk)}${rk.place ? ` · ${rk.place}위` : ''}` : `${ladderLabel(rk)} <span class="stars">${ladderStars(rk)}</span>`;
  function renderRank(rk) {
    if (!rk) return;
    el('pvpRankBadge').innerHTML = rankLine(rk);
    el('pvpRankSub').textContent = rk.tier >= RANK.LEGEND ? `전설 승수 ${rk.legendWins}승 · 승수가 많을수록 순위가 올라가요` :
      `이기면 별 +1${rk.streak >= RANK.STREAK_BONUS_FROM - 1 ? ' (연승 중! 다음 승리는 별 +2)' : ''} · 지면 별 -1${rk.tier === 0 ? ' (브론즈는 안 줄어요)' : ''}${rk.streak ? ` · ${rk.streak}연승` : ''}`;
    el('pvpRankBar').style.width = Math.round(ladderIndex(rk) / ladderIndex({ tier: RANK.LEGEND }) * 100) + '%';
  }
  async function openBoard() {
    let box = el('rankModal');
    if (!box) { box = document.createElement('div'); box.id = 'rankModal'; box.className = 'rank-modal'; box.onclick = e => { if (e.target === box) box.classList.remove('show'); }; document.body.appendChild(box); }
    box.innerHTML = '<div class="rank-panel"><h3>🏆 순위표</h3><p class="sub">불러오는 중…</p></div>'; box.classList.add('show');
    const r = await fetch('/api/pvp/ranking', { credentials: 'same-origin' }).then(x => x.json()).catch(() => null);
    if (!r) { box.querySelector('.sub').textContent = '순위표를 불러오지 못했어요.'; return; }
    const B = r.board || { total: 0, rows: [], counts: r.counts }, mine = r.myRow;
    const cell = x => x.tier >= RANK.LEGEND ? `${ladderLabel(x)} <b>${x.legendWins}승</b>` : `${ladderLabel(x)} <span class="stars">${ladderStars(x)}</span>`;
    const line = x => `<tr${mine && mine.place === x.place ? ' class="me"' : ''}><td>${x.place}</td><td>${escHtml(x.name)}</td><td>${cell(x)}</td><td>${x.wins}승 ${x.losses}패</td></tr>`;
    let rows = B.rows.map(line).join('') || '<tr><td colspan="4">아직 아무도 없어요.</td></tr>';
    if (mine && !B.rows.some(x => x.place === mine.place)) rows += `<tr class="gap"><td colspan="4">⋯</td></tr>${line(mine)}`;
    const counts = RANK.TIERS.map((t, i) => `<span>${RANK.ICONS[i]} ${t} <b>${(B.counts || [])[i] || 0}</b></span>`).join('');
    box.innerHTML = `<div class="rank-panel"><h3>🏆 순위표</h3><p class="sub">내 등급: ${rankLine(r.me)}${mine ? ` · 전체 ${B.total}명 중 <b>${mine.place}위</b>` : ''}</p>
      <table class="rank-table"><tr><th>순위</th><th>이름</th><th>등급</th><th>랭크 승/패</th></tr>${rows}</table>
      <h4>등급별 인원</h4><div class="rank-counts">${counts}</div>
      <p class="sub">로그인 없이 보는 공개 순위: <a href="/ranking" target="_blank" rel="noopener">${location.origin}/ranking</a></p>
      <button type="button" class="menu-btn back">닫기</button></div>`;
    box.querySelector('button').onclick = () => box.classList.remove('show');
  }
  el('pvpRankBoardBtn').onclick = openBoard;
  el('pvpBackBtn').onclick = async () => {
    if (S.status && S.status.state === 'queue') await post('/api/pvp/cancel');
    showScreen('main');                                                   // v154 모드 선택은 메인 화면에 있다 · v136 스트림은 계속 열어 둔다 (친구 접속 상태 · 대전 신청 알림)
  };
  el('pvpAgainBtn').onclick = async () => { goToMenu(); await toggleQueue(); };
  document.querySelectorAll('.pvpWinGold').forEach(x => { x.textContent = PVP.WIN_GOLD; });
  setInterval(() => { renderScreen(); tickHud(); }, 250);

  // ---------- 판 화면 ----------
  // ui.js 의 연출 코드는 Host.state(전체 상태)에서 전장을 읽는다. 서버는 전체 상태를 안 주므로, 보이는 정보(양쪽 전장)만 담은 대역을 만들어 준다.
  function syncShim(v) {
    const st = { seats: [null, null], turn: v.turn, turnNo: v.turnNo, over: v.over, winner: v.winner, first: v.first };
    st.seats[MY] = { board: v.me.board, hand: v.me.hand }; st.seats[OPP] = { board: v.opp.board, hand: [] };
    Host.state = st;
  }
  function beginMatchUi(m) {
    QStats.start(); emo.muted = false;                                      // v132
    S.matchId = m.matchId; S.lastSeq = -1; S.over = false; S.phase = null; clearTimeout(S.waitTimer); S.ranked = !!m.ranked; if (!m.friendly && !m.spectate) S.mode = m.ranked ? 'rank' : 'normal';
    S.friendly = !!m.friendly; S.spectate = !!m.spectate; S.specCount = m.spectators || 0; S.lastKind = m.spectate ? 'spectate' : m.friendly ? 'friend' : 'pvp';   // v136
    MY = m.seat; OPP = 1 - m.seat;
    game = { key: 'pvp', mode: 'pvp', spectate: !!m.spectate, friendly: !!m.friendly, bet: 0, tier: 0, cheats: [], pool: 0, settled: true, result: null, deckNames: Array.isArray(m.deck) ? m.deck.slice() : (m.spectate ? [] : DeckBook.get()), pvpTitle: '', pvpHTML: '' };
    view = m.view; syncShim(view);
    ui.selected = null; ui.pending = null; ui.busy = true; stopArrow(); closeDeck(); resetSurrenderBtn();
    $('logList').innerHTML = ''; $('overlay').classList.remove('show'); $('overlayReward').innerHTML = ''; $('overlayArt').innerHTML = ''; el('pvpAgainBtn').style.display = 'none'; el('specLeaveBtn').style.display = m.spectate ? '' : 'none'; el('pvpReplayBtn').style.display = 'none';
    $('verBadge').textContent = VERSION;
    S.badgeBase = m.spectate ? `👁 관전 중 · ${m.me.name} vs ${m.opp.name}${m.friendly ? ' · 친구 대전' : m.ranked ? ' · 랭크전' : ''}`
      : m.friendly ? '👥 친구 대전 · 보상 없음' : `${m.ranked ? '🏆 랭크전' : '유저 대전 · 일반전'} · 승리 +${PVP.WIN_GOLD}G`;
    $('menu').classList.add('hidden'); updateWallet();
    document.querySelector('#aiHero .name').textContent = m.opp.name;
    document.querySelector('#playerHero .name').textContent = m.spectate ? m.me.name : '나';
    { const lb = document.querySelectorAll('.board > .row .label'); if (lb.length >= 2) { lb[0].textContent = m.spectate ? `${m.opp.name} 필드` : '상대 필드'; lb[1].textContent = m.spectate ? `${m.me.name} 필드` : '내 필드'; } }
    document.body.classList.add('pvp-mode'); document.body.classList.toggle('pvp-spectate', !!m.spectate);
    setAvatar('aiAvatar', m.opp.name); setAvatar('playerAvatar', m.spectate ? m.me.name : (S.meName || '나'));
    if (m.spectate) { logLine(`👁 관전 시작: ${m.me.name} vs ${m.opp.name}`); logLine(`관전 중에는 양쪽 손패가 보이지 않아요. 전투 기록의 '당신'은 ${m.me.name} 쪽이에요.`); }
    else {
      logLine(`대전 시작! 상대: ${m.opp.name}${m.friendly ? ' (친구 대전 · 골드·랭크·전적 없음)' : ''}`);
      logLine(view.first === MY ? `당신이 선공입니다. 후공(상대) 보너스: 시작 손패 +${CONFIG.SECOND_HAND}장 · 동전 1장.` : `상대가 선공입니다. 후공(당신) 보너스: 시작 손패 +${CONFIG.SECOND_HAND}장 · 동전 1장.`);
    }
    S.badgeBase += m.spectate ? '' : view.first === MY ? ' · 선공' : ' · 후공';
    setBadge();
    render();
  }
  async function handleMatch(m) {
    if (m.matchId !== S.matchId) {
      await Preload.ensure();                                            // v138 보통은 이미 받아 둔 상태 (새로고침해서 판에 다시 들어올 때만 로딩 화면)
      const left = (m.introMs || 0) - (Date.now() - (m._at || Date.now()));
      if (!m.spectate && m.phase === 'mulligan' && left > 800 && typeof MatchIntro !== 'undefined') {   // v147 「매칭 성공!」 → 서서히 판 화면으로
        const mode = m.friendly ? '친구 대전' : m.ranked ? '🏆 랭크전' : '⚔️ 일반전';
        await MatchIntro.play({ me: S.meName || '나', opp: m.opp.name, mode }, left, () => beginMatchUi(m));
      } else beginMatchUi(m);
    }
    S.phase = m.phase; S.turnSeat = m.turnSeat; S.timeouts = m.timeouts; S.maxTimeouts = m.maxTimeouts;
    S.oppOffAt = m.opp.online ? 0 : Date.now() - (m.oppOfflineMs || 0);
    const at = m._at || Date.now();                                      // v147 서버가 보낸 남은 시간은 받은 순간 기준
    S.deadline = m.remainMs > 0 ? at + m.remainMs : 0;
    S.mullDeadline = m.mulligan && m.mulligan.remainMs > 0 ? at + m.mulligan.remainMs : 0;
    if (m.phase === 'mulligan') { view = m.view; syncShim(view); if (S.spectate) { ui.busy = true; render(); } else showMull(m); tickHud(); return; }   // v136 관전자는 멀리건 창 없이 기다린다
    hideMull();
    if (m.seq < S.lastSeq) return;                                       // 낡은 메시지
    const evs = (S.lastSeq >= 0 && m.seq > S.lastSeq) ? m.events : [];   // 처음 받는 상태(재접속 포함)는 연출 없이 바로 그린다
    syncShim(m.view);                                                    // 연출 중에 "지금 전장"을 읽는 코드가 새 상태를 보게
    ui.selected = null; ui.pending = null; ui.place = null; stopArrow();
    if (evs.length) { ui.busy = true; render(); try { await playEvents(evs); } catch (e) { console.error('[pvp] 연출 오류', e); } }
    view = m.view; S.lastSeq = m.seq; syncShim(view);
    if (m.timeoutSeat !== undefined) logLine(m.timeoutSeat === MY ? `⏱ 시간 초과! 턴이 자동으로 넘어갔습니다. (연속 ${m.timeouts}/${m.maxTimeouts}, 다 차면 패배)` : '⏱ 상대가 시간 초과로 턴이 넘어갔습니다.');
    if (m.result) finishUi(m);
    ui.busy = !!S.spectate && !m.result; render(); tickHud();          // v136 관전자는 계속 "바쁨" (아무것도 못 누른다)
  }

  // ---------- 멀리건 ----------
  let mullFor = null;
  function hideMull() { $('mulliganModal').classList.remove('show'); mullFor = null; }
  function showMull(m) {
    const modal = $('mulliganModal');
    ui.busy = true; render();
    if (m.mulligan.done) { modal.classList.remove('show'); mullFor = null; return; }           // 내 선택은 끝남 → 상대를 기다리는 중 (남은 시간은 타이머 칸에)
    if (mullFor === m.matchId && modal.classList.contains('show')) return;                    // 이미 고르는 중이면 다시 그리지 않는다 (선택 표시 유지)
    mullFor = m.matchId;
    const ids = new Set(m.mulligan.startIds), cards = m.view.me.hand.filter(c => ids.has(c.id)), out = new Set();
    const ok = $('mulliganOk');
    $('mulliganTitle').textContent = `멀리건 — 시작 카드 ${cards.length}장`;
    const upd = () => { ok.textContent = out.size ? `${out.size}장 바꾸고 시작` : '바꾸지 않고 시작'; };
    ok.disabled = false; upd(); modal.classList.add('show'); modal.scrollTop = 0;
    mullCards(cards, out, upd);                                          // v153 ui.js 공용 (터치에서 확실히 골라지게 · 화면 크기에 맞춤)
    ok.onclick = async () => {
      ok.disabled = true;
      const r = await post('/api/pvp/mulligan', { matchId: m.matchId, ids: [...out] });
      if (r.ok) modal.classList.remove('show'); else { ok.disabled = false; if (r.data && r.data.error) logLine('⚠ ' + r.data.error); }
    };
  }

  // ---------- 내 행동 → 서버 (ui.js 의 playerAction 이 부른다) ----------
  async function act(action) {
    if (S.spectate) return;                                              // v136
    if (S.over || !S.matchId) { ui.busy = false; return; }
    const seq = S.lastSeq;
    const r = await post('/api/pvp/action', { matchId: S.matchId, seq, action });
    if (r.ok) {                                                            // 결과 화면은 스트림으로 온다. 혹시 안 오면 10초 뒤 풀고 다시 동기화
      clearTimeout(S.waitTimer);
      S.waitTimer = setTimeout(() => { if (S.lastSeq === seq && !S.over) { ui.busy = false; if (!ui.anim) render(); resync(); } }, 10000);
      return;
    }
    if (r.status === 409) { ui.busy = false; resync(); return; }            // 내 화면이 낡았음 → 최신 상태를 다시 받는다
    { const msg = (r.data && r.data.error) || '행동을 처리하지 못했어요.'; if (typeof warn === 'function') warn(msg); else logLine('⚠ ' + msg); }   // v145 경고창
    ui.busy = false;
  }

  // ---------- 판 끝 ----------
  function resultHTML(r) {
    const sign = n => `<span class="plus">+${fmt(n)}골드</span>`;
    const reasonText = ({
      surrender: r.youWon ? '상대가 항복했습니다' : '항복했습니다',
      timeout: r.youWon ? '상대가 시간 초과로 졌습니다' : '시간 초과로 패배했습니다',
      disconnect: r.youWon ? '상대의 연결이 끊겨 승리했습니다' : '연결이 끊겨 패배 처리되었습니다',
      turnlimit: `${PVP.MAX_TURNS}턴을 넘겨 무승부로 끝났습니다`,
      void: '연결 문제로 판이 취소되었습니다. 전적과 보상은 없습니다',
    })[r.reason] || '';
    const why = ({
      error: '보상 처리 중 문제가 생겨 골드가 지급되지 않았어요',
    })[r.why] || '';
    let top = '', sub = '';
    if (r.friendly) top = '<span>👥 친구 대전 · 골드·랭크·전적 변동 없음</span>';   // v136
    else if (r.reward > 0) { top = sign(r.reward); sub = r.rewardsToday > 0 ? `오늘 ${r.rewardsToday}번째 승리` : ''; }
    else if (r.youWon) { top = '<span>획득 골드 없음</span>'; sub = why; }
    else if (r.draw || r.void) top = '<span>골드 변동 없음</span>';
    let rk = '';                                                              // v127 랭크전: 별 변화
    if (r.ranked && r.rank) { const a = r.rank.after, g = r.rank.gained;
      const what = a.tier >= RANK.LEGEND && !r.rank.toLegend ? (g > 0 ? `전설 승수 +1 (${a.legendWins}승)` : '전설 승수 그대로') : g > 0 ? `별 +${g}` : g < 0 ? '별 -1' : '별 변화 없음';
      rk = `<span class="sub2 rank-line">🏆 ${rankLine({ ...a, place: r.rank.place })} · ${what}${r.rank.toLegend ? ' · 👑 전설 달성!' : r.rank.promoted ? ' · ⬆ 승급!' : r.rank.demoted ? ' · ⬇ 강등' : ''}</span>`; }
    return `<span class="sub2">${r.friendly ? '👥 친구 대전 · ' : r.ranked ? '🏆 랭크전 · ' : ''}${r.oppName ? 'vs ' + escHtml(r.oppName) : ''}${reasonText ? ' · ' + reasonText : ''}</span>${top}${rk}${sub ? `<span class="sub2">${sub}</span>` : ''}<span class="sub2">보유 골드 ${fmt(Economy.get().gold)}</span>`;
  }
  function finishUi(m) {
    const r = m.result; S.over = true; clearTimeout(S.waitTimer);
    game.result = r;
    if (r.spectate) {                                                      // v136 관전: 누가 이겼는지만
      game.pvpTitle = r.void ? '판이 취소되었습니다' : r.draw ? '무승부' : `${r.winnerName} 승리!`;
      game.pvpArt = r.void ? `<img src="/images/pvp/void.webp" alt="무효 판">` : r.draw ? `<span class="draw-art"><img src="/images/pvp/draw.webp" alt=""><span>무승부</span></span>` : '';
      const why = ({ surrender: '항복', timeout: '시간 초과', disconnect: '연결 끊김', turnlimit: `${PVP.MAX_TURNS}턴 초과` })[r.reason];
      game.pvpHTML = `<span class="sub2">👁 관전 · ${escHtml((r.names || []).join(' vs '))}${why ? ' · ' + why : ''} · ${r.turns}턴</span>`;
      el('pvpAgainBtn').style.display = 'none'; el('specLeaveBtn').style.display = 'none';
      el('pvpTimer').style.display = 'none'; el('pvpRope').style.display = 'none'; banner(null);
      logLine(r.void ? '판이 취소되었습니다.' : r.draw ? '무승부' : `${r.winnerName} 승리!`);
      return;
    }
    game.pvpTitle = r.void || r.draw ? '' : r.youWon ? '승리했습니다!' : '패배했습니다...';   // 무효·무승부 배너 그림이 제목을 대신한다
    const IMG = '/images/pvp/';
    game.pvpArt = r.void ? `<img src="${IMG}void.webp" alt="무효 판">`
      : r.draw ? `<span class="draw-art"><img src="${IMG}draw.webp" alt=""><span>무승부</span></span>`
      : r.youWon && r.reward > 0 ? `<img class="gold" src="${IMG}gold.webp" alt="골드 획득">`
      : `<img src="${IMG}no_reward.webp" alt="보상 없음">`;
    if (r.wallet) ServerStore.adoptWallet(r.wallet);                       // 서버가 이미 지갑에 넣은 골드 → 새 저장 번호로 이어서 쓴다
    updateWallet();
    if (!r.void && !r.friendly) QStats.finish(!!r.youWon, 'pvp');          // v132 일일 퀘스트 기록 (v136 친구 대전은 빼고)
    game.pvpHTML = resultHTML(r);
    el('pvpAgainBtn').style.display = r.friendly ? 'none' : '';
    S.replayId = r.void ? null : m.matchId; el('pvpReplayBtn').style.display = r.void ? 'none' : '';   // v137 방금 판 리플레이
    el('pvpTimer').style.display = 'none'; el('pvpRope').style.display = 'none'; banner(null);
    logLine(r.void ? '판이 취소되었습니다.' : r.draw ? '무승부' : r.youWon ? `승리!${r.reward > 0 ? ` +${fmt(r.reward)}골드` : ''}` : '패배...');
  }
  function afterMatch() {                                                  // 결과 화면의 "처음 화면으로" (ui.js 의 goToMenu 가 부른다)
    MY = 0; OPP = 1; S.matchId = null; S.over = false; S.lastSeq = -1; S.phase = null; S.oppOffAt = 0;
    clearTimeout(S.waitTimer); hideMull(); el('pvpTimer').style.display = 'none'; el('pvpRope').style.display = 'none'; banner(null);
    document.body.classList.remove('pvp-mode', 'pvp-spectate'); document.querySelector('#playerHero .name').textContent = '나';
    { const lb = document.querySelectorAll('.board > .row .label'); if (lb.length >= 2) { lb[0].textContent = '상대 필드'; lb[1].textContent = '내 필드'; } }
    el('pvpAgainBtn').style.display = 'none'; el('specLeaveBtn').style.display = 'none'; el('pvpReplayBtn').style.display = 'none';
    const kind = S.lastKind; S.spectate = false; S.friendly = false; S.specCount = 0;
    if ((kind === 'friend' || kind === 'spectate') && typeof Friends !== 'undefined') { loadMe(); showMsg(''); Friends.open(); }   // v136 친구 대전·관전이 끝나면 친구 화면으로
    else openScreen();
  }
  // v136 상단 배지: 모드 · 선후공 · 관전 인원
  function setBadge() { $('diffBadge').textContent = (S.badgeBase || '') + (!S.spectate && S.specCount ? ` · 👁 ${S.specCount}명 관전 중` : ''); }
  // v136 관전 시작 · 그만두기 · 친구 대전 신청
  async function spectate(friendId) {
    open();
    await Preload.ensure();                                                // v138
    const r = await post('/api/pvp/spectate', { friendId });
    if (!r.ok) return r.data.error || '관전하지 못했어요.';
    return null;
  }
  async function leaveSpectate() {
    if (!S.spectate) return;
    S.over = true; await post('/api/pvp/spectate/leave');
    goToMenu();
  }
  el('specLeaveBtn').onclick = leaveSpectate;
  el('pvpReplayBtn').onclick = () => { const id = S.replayId; goToMenu(); if (id && typeof Replay !== 'undefined') Replay.open(id); };   // v137
  el('pvpReplaysBtn').onclick = () => { if (typeof Replay !== 'undefined') Replay.list(); };
  // v153 연결이 끊겨 있으면 다시 붙을 때까지 잠깐 기다린다 (최대 ms)
  async function ensureLive(ms = 5000) {
    open();
    const until = Date.now() + ms;
    while (!S.esOpen && Date.now() < until) await new Promise(r => setTimeout(r, 150));
    return S.esOpen;
  }
  async function invite(friendId) {
    if (!(await ensureLive())) return '서버에 연결하는 중이에요. 잠시 뒤 다시 눌러 주세요.';
    const saved = await ServerStore.waitSaved();
    if (!saved) return '저장이 아직 끝나지 않았어요. 잠시 뒤 다시 해 주세요.';
    // v153 예전엔 그림을 전부 받은 뒤에야 신청을 보냈다 → 휴대폰 데이터로는 한참 걸려서 "신청이 안 간다"처럼 보였다.
    //      이제 신청부터 보내고, 친구가 답하는 동안 뒤에서 그림을 받는다 (판이 시작될 때 덜 받았으면 그때 로딩 화면)
    try { Preload.warmup(); } catch (_) {}
    const r = await post('/api/pvp/invite', { to: friendId, heroPower: HeroPowerPref.get() });
    return r.ok ? null : (r.data.error || '대전을 신청하지 못했어요.');
  }
  async function respondInvite(id, accept, until) {
    if (accept) {
      if (!(await ensureLive())) return '서버에 연결하는 중이에요. 잠시 뒤 다시 눌러 주세요.';
      const saved = await ServerStore.waitSaved(); if (!saved) return '저장이 아직 끝나지 않았어요. 잠시 뒤 다시 해 주세요.';
      // v153 그림을 받는 동안 신청 시간이 끝나 버리던 문제: 끝나기 5초 전까지만 기다리고 바로 수락한다
      if (!Preload.isReady()) {
        const left = (until || Date.now() + 20000) - Date.now() - 5000;
        if (left > 0) await Promise.race([Preload.ensure(), new Promise(r => setTimeout(r, left))]);
      }
    }
    const r = await post('/api/pvp/invite/respond', { id, accept: !!accept, heroPower: HeroPowerPref.get() });
    return r.ok ? null : (r.data.error || '처리하지 못했어요.');
  }
  async function cancelInvite() { await post('/api/pvp/invite/cancel'); }

  // ---------- 타이머 · 알림 띠 ----------
  function tickHud() {
    const inMatch = !!S.matchId && !S.over && game && game.mode === 'pvp';
    const t = el('pvpTimer'), rope = el('pvpRope');
    if (!inMatch) { t.style.display = 'none'; rope.style.display = 'none'; if (!S.matchId) banner(null); return; }
    const ropeSet = (left, total) => {                                   // 남은 시간 비율만큼 줄이 남는다
      rope.style.display = ''; rope.classList.toggle('low', left <= 10000);
      el('pvpRopeBody').style.setProperty('--f', Math.max(0, Math.min(1, left / total)).toFixed(3));
    };
    if (S.phase === 'mulligan') {
      const left = S.mullDeadline - Date.now();
      t.style.display = ''; t.className = 'pvp-timer' + (left <= 10000 ? ' low' : '');
      t.innerHTML = `<b class="tn">${sec(left)}초</b><small>멀리건</small>`;
      ropeSet(left, cfgOf().mulliganMs);
    } else if (S.deadline) {
      const left = S.deadline - Date.now(), mine = S.turnSeat === MY;
      t.style.display = ''; t.className = 'pvp-timer' + (mine && !S.spectate ? ' mine' : '') + (left <= 10000 ? ' low' : '');
      const who = S.spectate ? `${escHtml(document.querySelector(mine ? '#playerHero .name' : '#aiHero .name').textContent)} 턴` : mine ? '내 턴' : '상대 턴';   // v136 관전: 이름으로
      t.innerHTML = `<b class="tn">${sec(left)}초</b><small>${who}${S.timeouts && !S.spectate ? ` · 초과 ${S.timeouts}/${S.maxTimeouts}` : ''}</small>`;
      ropeSet(left, cfgOf().turnMs);
    } else { t.style.display = 'none'; rope.style.display = 'none'; }
    if (S.replaced) banner('⚠ 같은 계정을 다른 탭(기기)에서 열어서 이 탭의 연결을 넘겼어요. 여기서 계속하려면 새로고침해 주세요.', true);
    else if (!S.esOpen) banner('⚠ 서버와 연결이 끊겼어요. 다시 연결하는 중… (시간 안에 돌아오면 이어서 할 수 있어요)', true);
    else if (S.oppOffAt && !S.spectate) banner(`상대의 연결이 끊겼어요. ${sec(S.reconnectMs - (Date.now() - S.oppOffAt))}초 안에 돌아오지 않으면 승리합니다.`, false);
    else banner(null);
  }

  window.addEventListener('beforeunload', e => { if (S.matchId && !S.over && !S.spectate) { e.preventDefault(); e.returnValue = ''; } });   // 판 도중 탭을 닫으려 하면 경고

  // ---------- 새로고침해도 진행 중인 판으로 돌아온다 ----------
  ServerStore.ready.then(async () => {
    try {
      const r = await fetch('/api/pvp/status', { credentials: 'same-origin', cache: 'no-store' });
      if (!r.ok) return;
      await r.json();
    } catch (_) {}
    loadMe(); open();                                                      // v136 접속 상태 · 친구 대전 신청을 받으려고 스트림은 항상 연다 (진행 중인 판이 있으면 서버가 이어서 보내 준다)
  });

  async function emote(id) { if (!S.matchId || S.over || S.spectate) return; const r = await post('/api/pvp/emote', { matchId: S.matchId, id }); if (!r.ok && r.data && r.data.error) logLine('⚠ ' + r.data.error); }   // v132
  return { openScreen, act, afterMatch, emote, spectate, leaveSpectate, invite, respondInvite, cancelInvite, open, inMatch: () => !!S.matchId && !S.over, _state: S };
})();
