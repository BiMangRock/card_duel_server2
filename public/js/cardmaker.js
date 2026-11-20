// cardmaker.js — 상점 → 「카드 직접 만들기」 화면
//   이름·코스트·공격력·체력·그림을 정하고, 카테고리별 효과를 체크해 카드를 만든다 (AI 없음, 규칙 기반)
//   · 예산(코스트×3)·이름·경고는 입력할 때마다 바로 보여 준다 (CardRules — 서버도 같은 파일로 다시 검사)
//   · 만든 카드: AI 대전·모험에서 바로 사용 / [승인 요청] → 개발자가 review.html 에서 승인하면 유저 대전에서도 사용
(() => {
  const q = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const TIER_CLASS = { 1: 'low', 2: 'mid', 3: 'high', '-1': 'drawback' };
  const STATUS_CLASS = { made: 'made', pending: 'pending', approved: 'approved', rejected: 'rejected' };
  const BASIC_FIRST = ['bc:damage', 'bc:heal', 'bc:buff', 'bc:draw', 'bc:sweep', 'bc:scatter', 'bc:gainMana'];   // 함성 탭 맨 위에 보일 기본 효과

  const ALL = () => [...CardRules.SUMMON_ENTRIES, ...EFFECT_CATALOG];
  const entryOf = id => ALL().find(e => e.id === id);
  const KW_KEYS = ['taunt', 'shield', 'rush', 'charge', 'lifesteal', 'stealth', 'windfury', 'poison', 'revive', 'elusive'];
  const st = { edit: null, sel: new Map(), tab: 'keyword', search: '', image: null, nameRemote: null, nameTimer: 0, busy: false, mine: [], advanced: false };
  let built = false;

  function build() {
    const scr = document.createElement('div');
    scr.className = 'screen'; scr.id = 'screen-cardmaker';
    const opt = (lo, hi, d) => Array.from({ length: hi - lo + 1 }, (_, i) => `<option value="${lo + i}"${lo + i === d ? ' selected' : ''}>${lo + i}</option>`).join('');
    scr.innerHTML = `
      <h3>🛠 카드 직접 만들기</h3>
      <p class="sub cm-sub">효과를 골라 나만의 하수인을 만들어요. 만든 카드는 AI 대전·모험에서 바로 쓸 수 있고, 승인을 받으면 유저 대전에서도 쓸 수 있어요.</p>
      <div class="cm-wrap">
        <div class="cm-left">
          <div class="cm-editbar" id="cmEditBar" hidden></div>
          <div class="cm-box">
            <label class="cm-row"><span>이름</span><input id="cmName" maxlength="12" placeholder="2~12자" autocomplete="off"></label>
            <p class="cm-msg" id="cmNameMsg"></p>
            <div class="cm-stats">
              <label><span>코스트</span><select id="cmCost">${opt(0, 10, 3)}</select></label>
              <label><span>공격력</span><select id="cmAtk">${opt(0, 12, 2)}</select></label>
              <label><span>체력</span><select id="cmHp">${opt(1, 12, 3)}</select></label>
            </div>
            <div class="cm-row cm-img"><span>그림</span>
              <label class="cm-file">사진 올리기<input type="file" id="cmFile" accept="image/png,image/jpeg,image/webp" hidden></label>
              <button type="button" class="cm-x" id="cmImgClear" hidden>지우기</button>
            </div>
          </div>
          <div class="cm-box cm-fx">
            <div class="cm-tabs" id="cmTabs" role="tablist"></div>
            <div class="cm-tools">
              <input id="cmSearch" placeholder="효과 검색" autocomplete="off">
              <label class="cm-adv"><input type="checkbox" id="cmAdv"> 고급 효과까지</label>
            </div>
            <div class="cm-list" id="cmList"></div>
          </div>
        </div>
        <div class="cm-right">
          <div class="cm-preview" id="cmPreview"></div>
          <div class="cm-budget"><div class="cm-bar"><i id="cmBar"></i></div><b id="cmBudgetTxt"></b></div>
          <div class="cm-chosen" id="cmChosen"></div>
          <ul class="cm-warns" id="cmWarns"></ul>
          <button class="menu-btn primary" id="cmCreate"></button>
          <p class="notice warn" id="cmMsg"></p>
        </div>
      </div>
      <div class="cm-box cm-mine"><h4>내가 만든 카드</h4><div id="cmMine">${Flavor.wait('mine')}</div></div>
      <button class="menu-btn back" onclick="openShop()">← 상점으로</button>`;
    q('menu').appendChild(scr);

    q('cmName').addEventListener('input', () => { st.nameRemote = null; render(); clearTimeout(st.nameTimer); st.nameTimer = setTimeout(checkNameRemote, 350); });
    ['cmCost', 'cmAtk', 'cmHp'].forEach(id => q(id).addEventListener('change', render));
    q('cmSearch').addEventListener('input', e => { st.search = e.target.value.trim(); renderList(); });
    q('cmAdv').addEventListener('change', e => { st.advanced = e.target.checked; renderList(); });
    q('cmFile').addEventListener('change', onFile);
    q('cmImgClear').onclick = () => { st.image = null; q('cmFile').value = ''; if (st.edit) st.edit.clearImage = true; render(); };
    q('cmCreate').onclick = create;
    built = true;
  }

  // ---------- 효과 목록 ----------
  const isBasic = e => e.kind === 'kw' || e.kind === 'summon' || BASIC_FIRST.includes(e.id) || (e.category !== 'battlecry' && !(e.warns || []).length && e.pts <= 3 && !e.fixedTier);
  function visibleEntries() {
    const s = st.search.toLowerCase();
    let list = ALL().filter(e => s ? (e.text + ' ' + (e.help || '') + ' ' + (e.from || '')).toLowerCase().includes(s) : e.category === st.tab);
    if (!s && !st.advanced) list = list.filter(e => isBasic(e) || st.sel.has(e.id));
    const rank = e => e.kind === 'summon' ? 0 : (BASIC_FIRST.indexOf(e.id) + 1 || 99);   // 직접 디자인 소환 → 기본 함성 → 나머지
    if (!s) list.sort((a, b) => rank(a) - rank(b));
    return list;
  }
  function renderTabs() {
    const box = q('cmTabs'); box.innerHTML = '';
    for (const [key, label] of EFFECT_CATEGORIES) {
      const n = [...st.sel.keys()].filter(id => (entryOf(id) || {}).category === key).length;
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab');
      b.className = 'cm-tab' + (st.tab === key && !st.search ? ' on' : '');
      b.innerHTML = esc(label) + (n ? ` <em>${n}</em>` : '');
      b.onclick = () => { st.tab = key; st.search = ''; q('cmSearch').value = ''; renderTabs(); renderList(); };
      box.appendChild(b);
    }
  }
  function selectEl(p, val, onChange) {           // 숫자 입력칸 (문장 안에 들어간다)
    const sel = document.createElement('select'); sel.className = 'cm-num';
    for (let v = p.min; v <= p.max; v++) { const o = document.createElement('option'); o.value = v; o.textContent = v; if (v === val) o.selected = true; sel.appendChild(o); }
    sel.onclick = ev => ev.stopPropagation();
    sel.onchange = ev => onChange(Number(ev.target.value));
    return sel;
  }
  const defaults = e => Object.fromEntries((e.params || []).map(p => [p.key, p.def]));
  function setParam(e, key, v) {                  // 숫자를 바꾸면 자동으로 체크된다
    const params = { ...(st.sel.get(e.id) || defaults(e)), [key]: v };
    st.sel.set(e.id, params); renderList(); render();
  }
  function textNode(e, params) {                  // 문장 + 문장 안 입력칸
    const span = document.createElement('span'); span.className = 'cm-text';
    if (e.tpl) {
      const byKey = Object.fromEntries((e.params || []).map(p => [p.key, p]));
      for (const part of e.tpl.split(/(\{\{[^}]+\}\})/)) {
        const m = /^\{\{([^}]+)\}\}$/.exec(part);
        if (m && byKey[m[1]]) span.appendChild(selectEl(byKey[m[1]], params[m[1]] ?? byKey[m[1]].def, v => setParam(e, m[1], v)));
        else span.appendChild(document.createTextNode(part));
      }
    } else span.textContent = e.text;
    if (e.help) { const sm = document.createElement('small'); sm.textContent = e.help; span.appendChild(sm); }
    return span;
  }
  function renderList() {
    renderTabs();
    const box = q('cmList'); box.innerHTML = '';
    const list = visibleEntries();
    if (!list.length) { box.innerHTML = `<p class="cm-empty">${st.search ? '찾는 효과가 없어요' : '효과 없음'}</p>`; return; }
    for (const e of list) {
      const on = st.sel.has(e.id), params = e.kind === 'summon' ? {} : (st.sel.get(e.id) || defaults(e));
      const row = document.createElement('div'); row.className = 'cm-item' + (on ? ' on' : '') + (e.kind === 'summon' ? ' cm-sum' : '');
      const lab = document.createElement('label'); lab.className = 'cm-check';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = on;
      cb.onchange = () => {
        if (cb.checked) st.sel.set(e.id, e.kind === 'summon' ? { count: 1, token: newToken() } : defaults(e)); else st.sel.delete(e.id);
        renderList(); render();
      };
      lab.appendChild(cb); lab.appendChild(textNode(e, params));
      let badge;
      if (e.kind === 'summon') {
        badge = `<span class="cm-tier t-new" title="소환수 능력치·마릿수에 따라 예산이 정해져요">${on ? '-' + summonCostOf(e.id) : '디자인'}</span>`;
      } else {
        const tier = CardRules.tierOf(e, params), cost = CardRules.costOf(e, params);
        badge = `<span class="cm-tier t-${TIER_CLASS[tier]}" title="${tier < 0 ? '단점: 예산이 1 늘어나요' : '예산 ' + cost + ' 사용'}">${CardRules.TIER_NAME[tier]} ${cost > 0 ? '-' + cost : '+1'}</span>`;
      }
      lab.insertAdjacentHTML('beforeend', badge);
      row.appendChild(lab);
      row.insertAdjacentHTML('beforeend', (e.warns || []).map(w => `<p class="cm-warn">⚠ ${esc(w)}</p>`).join('') + (e.targeted && e.kind === 'bc' ? '<p class="cm-note">🎯 낼 때 대상을 골라요</p>' : ''));
      const extra = (e.params || []).filter(p => !p.inline);                 // 문장 안에 못 넣은 숫자는 아래에
      if (extra.length) {
        const ps = document.createElement('div'); ps.className = 'cm-params';
        for (const p of extra) { const l = document.createElement('label'); l.innerHTML = `<span>${esc(p.label)}</span>`; l.appendChild(selectEl(p, params[p.key] ?? p.def, v => setParam(e, p.key, v))); ps.appendChild(l); }
        row.appendChild(ps);
      }
      if (e.kind === 'summon' && on) row.appendChild(summonEditor(st.sel.get(e.id), 1, e.when));
      if (e.from && e.kind !== 'kw' && e.kind !== 'summon') { const f = document.createElement('p'); f.className = 'cm-from'; f.textContent = `기존 카드: ${e.from}`; row.appendChild(f); }
      box.appendChild(row);
    }
  }

  // ---------- 소환수 디자인 (소환수가 또 소환수를 부를 수 있다) ----------
  const newToken = () => ({ name: '', atk: 1, hp: 1, kw: [], summons: [] });
  function summonCostOf(id) {
    const r = CardRules.buildCard({ ...input(), selections: [{ id, params: st.sel.get(id), token: st.sel.get(id).token }] }, { skipName: true });
    const l = r.lines.find(x => x.id === id); return l ? l.cost : '?';
  }
  // holder: {count, token}  (카드의 소환 효과 또는 소환수의 소환 효과)
  function summonEditor(holder, depth, when) {
    const t = holder.token, box = document.createElement('div'); box.className = 'cm-token d' + depth;
    const opt = (lo, hi, v) => Array.from({ length: hi - lo + 1 }, (_, i) => `<option${lo + i === v ? ' selected' : ''}>${lo + i}</option>`).join('');
    box.innerHTML = `
      <div class="cm-tk-head">${depth > 1 ? '↳ ' : ''}${when === 'end' ? '내 턴이 끝날 때' : when === 'death' ? '죽음의 메아리' : '전투의 함성'}로 소환할 하수인 <select class="cm-num tk-count">${opt(1, CardRules.CUSTOM.SUMMON_MAX, holder.count)}</select>마리</div>
      <div class="cm-tk-body">
        <div class="cm-tk-card"></div>
        <div class="cm-tk-form">
          <label class="cm-row"><span>이름</span><input class="tk-name" maxlength="12" placeholder="소환수 이름" value="${esc(t.name)}"></label>
          <p class="cm-msg tk-msg"></p>
          <div class="cm-stats"><label><span>공격력</span><select class="tk-atk">${opt(0, 12, t.atk)}</select></label><label><span>체력</span><select class="tk-hp">${opt(1, 12, t.hp)}</select></label>
            <label class="cm-file">그림<input type="file" class="tk-file" accept="image/png,image/jpeg,image/webp" hidden></label>${t.art ? '<button type="button" class="cm-x tk-clear">그림 지우기</button>' : ''}</div>
          <div class="cm-tk-kw">${KW_KEYS.map(k => `<label><input type="checkbox" value="${k}"${t.kw.includes(k) ? ' checked' : ''}> ${esc(CardRules.KW_LABEL[k] || k)}</label>`).join('')}</div>
          ${depth < CardRules.CUSTOM.SUMMON_DEPTH ? `<div class="cm-tk-more">이 소환수도 소환하기:
            <label><input type="checkbox" class="tk-sub" value="death"${t.summons.some(c => c.when === 'death') ? ' checked' : ''}> 죽으면</label>
            <label><input type="checkbox" class="tk-sub" value="end"${t.summons.some(c => c.when === 'end') ? ' checked' : ''}> 내 턴이 끝날 때</label></div>` : '<p class="cm-note">3단계까지</p>'}
        </div>
      </div>`;
    const mini = box.querySelector('.cm-tk-card');
    const drawMini = () => {
      mini.innerHTML = '';
      const r = CardRules.cleanToken(t, depth, [], { skipName: true });
      const card = { type: 'minion', name: t.name || '소환수', cost: 0, atk: r.atk, hp: r.hp, id: -2, art: t.art };
      for (const k of r.kw) card[k] = true;
      if (r.summons.length) card.customText = r.summons.map(c => (c.when === 'end' ? '내 턴이 끝날 때, ' : '죽음의 메아리: ') + `${CardRules.tokenDesc(c.token)} ${c.count}마리 소환`).join('. ');
      try { const el = cardEl(card); el.classList.add('cm-card-sm'); mini.appendChild(el); } catch (_) { mini.textContent = card.name; }
      const np = t.name ? CardRules.nameProblem(t.name) : '이름을 지어 주세요';
      const m = box.querySelector('.tk-msg'); m.textContent = np ? '⚠ ' + np : ''; m.className = 'cm-msg tk-msg' + (np ? ' bad' : '');
    };
    const changed = () => { drawMini(); render(); refreshBadges(); };
    box.querySelector('.tk-count').onchange = ev => { holder.count = Number(ev.target.value); changed(); };
    box.querySelector('.tk-name').oninput = ev => { t.name = ev.target.value.trim(); changed(); };
    box.querySelector('.tk-atk').onchange = ev => { t.atk = Number(ev.target.value); changed(); };
    box.querySelector('.tk-hp').onchange = ev => { t.hp = Number(ev.target.value); changed(); };
    box.querySelectorAll('.cm-tk-kw input').forEach(cb => cb.onchange = () => { t.kw = [...box.querySelectorAll('.cm-tk-kw input:checked')].map(x => x.value); changed(); });
    box.querySelector('.tk-file').onchange = ev => readImage(ev.target.files && ev.target.files[0], 220, d => { t.art = d; renderList(); render(); });
    const clr = box.querySelector('.tk-clear'); if (clr) clr.onclick = () => { delete t.art; renderList(); render(); };
    box.querySelectorAll('.tk-sub').forEach(cb => cb.onchange = () => {
      if (cb.checked) t.summons.push({ when: cb.value, count: 1, token: newToken() }); else t.summons = t.summons.filter(c => c.when !== cb.value);
      renderList(); render();
    });
    for (const c of t.summons) box.appendChild(summonEditor(c, depth + 1, c.when));
    drawMini();
    return box;
  }
  function refreshBadges() {                      // 이름 입력 중에는 목록을 다시 그리지 않고 예산 배지만 고친다
    document.querySelectorAll('#cmList .cm-sum').forEach(row => {
      const b = row.querySelector('.cm-tier'), cb = row.querySelector('input[type=checkbox]');
      const e = ALL().find(x => x.kind === 'summon' && row.querySelector('.cm-text') && row.querySelector('.cm-text').textContent.startsWith(x.text));
      if (b && cb && cb.checked && e) b.textContent = '-' + summonCostOf(e.id);
    });
  }

  // ---------- 미리보기 · 예산 ----------
  function input() {
    return {
      name: q('cmName').value.trim(), cost: Number(q('cmCost').value), atk: Number(q('cmAtk').value), hp: Number(q('cmHp').value),
      selections: [...st.sel].map(([id, params]) => id.startsWith('sum:') ? { id, params: { count: params.count }, token: params.token } : { id, params }),
    };
  }
  function render() {
    if (!built) return;
    const inp = input();
    const r = CardRules.buildCard(inp, { skipName: true });
    const nameProb = st.edit ? null : inp.name ? CardRules.nameProblem(inp.name) || st.nameRemote : '이름을 지어 주세요';   // 고치는 중이면 이름 고정
    const full = CardRules.buildCard({ ...inp, name: inp.name || '임시이름' }, { allowName: st.edit ? st.edit.name : undefined });   // 소환수 이름까지 검사
    const tokenProb = full.problems.find(p => p.startsWith('소환수') || p.startsWith('그림'));
    q('cmNameMsg').textContent = st.edit ? '🔒 고칠 때는 이름을 바꿀 수 없어요' : inp.name ? (nameProb ? '⚠ ' + nameProb : '✅ 쓸 수 있는 이름이에요') : '';
    q('cmNameMsg').className = 'cm-msg' + (nameProb && inp.name ? ' bad' : ' good');
    q('cmImgClear').hidden = !st.image;

    // 미리보기 카드 (게임과 같은 그리기 함수)
    const card = { ...r.card, name: inp.name || '이름 없는 카드', id: -1 };
    if (st.image) card.art = st.image;
    const pv = q('cmPreview'); pv.innerHTML = '';
    try { const el = cardEl(card); el.classList.add('cm-card'); pv.appendChild(el); } catch (e) { pv.textContent = card.name; }

    const b = r.budget, pct = Math.min(100, Math.round(b.used / Math.max(1, b.limit) * 100));
    q('cmBar').style.width = pct + '%';
    q('cmBar').className = b.over ? 'over' : pct >= 85 ? 'near' : '';
    q('cmBudgetTxt').textContent = `예산 ${b.used} / ${b.limit}` + (b.over ? `, ${b.used - b.limit} 초과` : '');
    q('cmBudgetTxt').className = b.over ? 'bad' : '';

    const ch = q('cmChosen');
    ch.innerHTML = `<div class="cm-line"><span>공격력 + 체력</span><b>-${inp.atk + inp.hp}</b></div>` +
      r.lines.map(l => `<div class="cm-line"><span>${esc(l.text)}</span><b class="t-${TIER_CLASS[l.tier]}">${l.cost > 0 ? '-' + l.cost : '+1'}</b></div>`).join('');

    const warns = [...r.warns];
    if (tokenProb) warns.unshift(tokenProb);
    q('cmWarns').innerHTML = warns.map(w => `<li>⚠ ${esc(w)}</li>`).join('');

    const gold = Economy.get().gold, price = st.edit ? CardRules.CUSTOM.EDIT_GOLD : CardRules.CUSTOM.GOLD_COST;
    const blocked = nameProb || tokenProb || b.over || st.busy || gold < price;
    const btn = q('cmCreate');
    btn.disabled = !!blocked;
    const label = !st.edit ? '카드 만들기' : st.edit.status === 'rejected' ? '고쳐서 다시 승인 요청' : '고친 내용 저장';
    btn.textContent = st.busy ? Flavor.wait('save') : `${label}, ${fmt(price)}골드`;
  }
  async function checkNameRemote() {
    const n = q('cmName').value.trim();
    if (!n || CardRules.nameProblem(n)) return;
    try {
      const r = await fetch('/api/customcards/name-check?name=' + encodeURIComponent(n), { credentials: 'same-origin' });
      const d = await r.json();
      if (q('cmName').value.trim() === n) { st.nameRemote = d.problem || null; render(); }
    } catch (_) {}
  }

  // ---------- 그림: 브라우저에서 작게 줄여 보낸다 ----------
  function readImage(f, max, done) {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { q('cmMsg').textContent = '⚠ png·jpg·webp 그림만 올릴 수 있어요'; return; }
    if (f.size > 10 * 1024 * 1024) { q('cmMsg').textContent = '⚠ 10MB 이하 그림만 올릴 수 있어요'; return; }
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      let d = cv.toDataURL('image/webp', 0.82);
      if (!d.startsWith('data:image/webp')) d = cv.toDataURL('image/jpeg', 0.85);
      URL.revokeObjectURL(url); q('cmMsg').textContent = ''; done(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); q('cmMsg').textContent = '⚠ 그림을 읽지 못했어요'; };
    img.src = url;
  }
  function onFile(ev) { readImage(ev.target.files && ev.target.files[0], 320, d => { st.image = d; if (st.edit) st.edit.clearImage = false; render(); }); }

  // ---------- 만들기 ----------
  async function create() {
    if (st.busy) return;
    st.busy = true; q('cmMsg').textContent = ''; render();
    try {
      if (typeof ServerStore !== 'undefined' && ServerStore.waitSaved) await ServerStore.waitSaved();   // 밀린 골드 저장을 먼저 끝낸다
      const ed = st.edit;
      const body = ed ? { ...input(), image: st.image && st.image.startsWith('data:') ? st.image : undefined, clearImage: !!ed.clearImage && !st.image }
                      : { ...input(), image: st.image };
      const r = await fetch(ed ? '/api/customcards/' + ed.id : '/api/customcards', { method: ed ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { q('cmMsg').textContent = '⚠ ' + (d.error || (ed ? '카드를 고치지 못했어요' : '카드를 만들지 못했어요')); return; }
      if (ed) {                                     // 카드 풀의 카드를 그 자리에서 새 버전으로 (덱에 넣어 둔 카드도 바로 바뀐다)
        const cur = CARD_POOL.find(c => c.name === d.card.name);
        if (cur) { for (const k of Object.keys(cur)) delete cur[k]; Object.assign(cur, d.card); } else CARD_POOL.push(d.card);
        if (typeof ServerStore !== 'undefined' && d.wallet && ServerStore.adoptWallet) ServerStore.adoptWallet(d.wallet);
        if (typeof updateWallet === 'function') updateWallet();
        showDone(d.card, d.item && d.item.status);
        exitEdit(); renderList(); loadMine();
        return;
      }
      if (!CARD_POOL.some(c => c.name === d.card.name)) CARD_POOL.push(d.card);
      if (typeof ServerStore !== 'undefined') { if (d.wallet && ServerStore.adoptWallet) ServerStore.adoptWallet(d.wallet); if (d.collection) ServerStore.collection = d.collection; }
      if (typeof updateWallet === 'function') updateWallet();
      showDone(d.card);
      st.sel.clear(); st.image = null; q('cmName').value = ''; q('cmFile').value = ''; st.nameRemote = null;
      renderList(); loadMine();
    } catch (e) { q('cmMsg').textContent = '⚠ 서버에 연결할 수 없어요'; }
    finally { st.busy = false; render(); }
  }
  function showDone(card, editedStatus) {
    const m = document.createElement('div'); m.className = 'cm-done';
    const msg = editedStatus === 'pending' ? `${esc(card.name)} 승인 요청함`
      : editedStatus ? `${esc(card.name)} 저장함`
      : `${esc(card.name)} 2장 획득`;
    m.innerHTML = `<div class="cm-done-box"><h4>${editedStatus ? '✏️ 카드를 고쳤어요!' : '✨ 카드를 만들었어요!'}</h4><div class="cm-done-card"></div>
      <p>${msg}</p>
      <button class="menu-btn primary" type="button">확인</button></div>`;
    try { const el = cardEl(card); el.classList.add('cm-card'); m.querySelector('.cm-done-card').appendChild(el); } catch (_) {}
    m.querySelector('button').onclick = () => m.remove();
    document.body.appendChild(m);
  }

  // ---------- 내가 만든 카드 · 승인 요청 ----------
  async function loadMine() {
    try {
      const r = await fetch('/api/customcards/mine', { credentials: 'same-origin' }); const d = await r.json();
      st.mine = d.cards || []; renderMine(d.max);
    } catch (_) { q('cmMine').textContent = '목록을 불러오지 못했어요'; }
  }
  function renderMine(max) {
    const box = q('cmMine');
    if (!st.mine.length) { box.innerHTML = Flavor.empty('mine'); return; }
    box.innerHTML = (max ? `<p class="cm-count">${st.mine.length} / ${max}장</p>` : '');
    for (const it of st.mine) {
      const row = document.createElement('div'); row.className = 'cm-mine-row';
      const can = it.status === 'made' || it.status === 'rejected';
      row.innerHTML = `<div class="cm-mine-card"></div>
        <div class="cm-mine-info"><b>${esc(it.name)}</b> <span class="cm-badge s-${STATUS_CLASS[it.status]}">${esc(it.statusLabel)}</span>
          <p>${it.status === 'approved' ? '승인됨' : it.status === 'pending' ? '승인 대기' : '승인 전'}</p>
          ${it.note ? `<p class="cm-note">💬 ${esc(it.note)}</p>` : ''}
          ${can ? `<div class="cm-mine-btns"><button type="button" class="cm-edit">✏️ ${it.status === 'rejected' ? '고쳐서 다시 요청' : '고치기'}, ${CardRules.CUSTOM.EDIT_GOLD}골드</button><button type="button" class="cm-req">${it.status === 'rejected' ? '그대로 다시 요청' : '승인 요청 보내기'}</button></div>` : ''}
          ${it.version > 1 ? `<p class="cm-ver">v${it.version}</p>` : ''}</div>`;
      try { const el = cardEl(it.card); el.classList.add('cm-card-sm'); row.querySelector('.cm-mine-card').appendChild(el); } catch (_) {}
      const eb = row.querySelector('.cm-edit'); if (eb) eb.onclick = () => startEdit(it);
      const b = row.querySelector('.cm-req');
      if (b) b.onclick = async () => {
        b.disabled = true;
        const r = await fetch(`/api/customcards/${it.id}/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: '{}' });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { b.disabled = false; b.textContent = '⚠ ' + (d.error || '실패'); return; }
        loadMine();
      };
      box.appendChild(row);
    }
  }

  // ---------- 고치기 (만듦·반려 카드, 이름 고정) ----------
  function startEdit(it) {
    const inp = it.input || {};
    st.edit = { id: it.id, name: it.name, status: it.status, note: it.note, clearImage: false };
    q('cmName').value = it.name; q('cmName').disabled = true;
    q('cmCost').value = String(inp.cost ?? it.card.cost); q('cmAtk').value = String(inp.atk ?? it.card.atk); q('cmHp').value = String(inp.hp ?? it.card.hp);
    st.sel = new Map((inp.selections || []).map(x => [x.id, x.id.startsWith('sum:') ? { count: (x.params && x.params.count) || 1, token: JSON.parse(JSON.stringify(x.token || {})) } : { ...(x.params || {}) }]));
    for (const v of st.sel.values()) if (v.token) fixToken(v.token);
    st.image = it.hasArt ? it.card.art : null; q('cmFile').value = '';
    const bar = q('cmEditBar'); bar.hidden = false;
    bar.innerHTML = `<b>✏️ 「${esc(it.name)}」 고치는 중</b> · ${it.status === 'rejected' ? '저장하면 바로 다시 승인 요청돼요' : '고친 뒤에도 승인 요청 전까지는 유저 대전에서 못 써요'}
      ${it.note ? `<p>💬 반려 사유: ${esc(it.note)}</p>` : ''}<button type="button" class="cm-x" id="cmEditCancel">고치기 취소</button>`;
    q('cmEditCancel').onclick = () => { exitEdit(); renderList(); render(); };
    renderList(); render();
    q('screen-cardmaker').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function fixToken(t) { t.kw = t.kw || []; t.summons = t.summons || []; for (const c of t.summons) fixToken(c.token || (c.token = {})); }
  function exitEdit() {
    st.edit = null; st.sel.clear(); st.image = null;
    q('cmName').disabled = false; q('cmName').value = ''; q('cmFile').value = ''; st.nameRemote = null;
    q('cmEditBar').hidden = true; q('cmEditBar').innerHTML = '';
  }

  // ---------- 개발자: 내 골드 설정 (게임 메인 개발자 메뉴) ----------
  window.openGoldTool = async () => {
    const m = document.createElement('div'); m.className = 'cm-done';
    m.innerHTML = `<div class="cm-done-box cm-gold"><h4>💰 내 골드 설정</h4><p>지금 골드: <b class="g-now">${fmt(Economy.get().gold)}</b></p>
      <div class="cm-row"><input class="g-in" type="number" min="0" max="10000000" placeholder="골드" style="flex:1"><button type="button" class="cm-req g-set">이 값으로</button></div>
      <div class="cm-mine-btns"><button type="button" class="cm-edit" data-add="100">+100</button><button type="button" class="cm-edit" data-add="1000">+1,000</button><button type="button" class="cm-edit" data-add="10000">+10,000</button></div>
      <p class="cm-msg g-msg"></p><p class="cm-note" style="margin:0">다른 유저의 골드는 승인 페이지(review.html)의 「💰 골드 관리」에서 바꿔요.</p>
      <button class="menu-btn" type="button">닫기</button></div>`;
    document.body.appendChild(m);
    m.querySelector('.menu-btn').onclick = () => m.remove();
    let me = null;
    try { const r = await fetch('/api/me', { credentials: 'same-origin' }); const d = await r.json(); me = d.user && d.user.id; } catch (_) {}
    const send = async body => {
      const msg = m.querySelector('.g-msg'); msg.textContent = Flavor.wait('save'); msg.className = 'cm-msg g-msg';
      if (typeof ServerStore !== 'undefined' && ServerStore.waitSaved) await ServerStore.waitSaved();
      const r = await fetch('/api/customcards/admin/gold', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ userId: me, ...body }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { msg.textContent = '⚠ ' + (d.error || '바꾸지 못했어요'); msg.className = 'cm-msg g-msg bad'; return; }
      if (typeof ServerStore !== 'undefined' && ServerStore.adoptWallet) ServerStore.adoptWallet(d.wallet);
      if (typeof updateWallet === 'function') updateWallet();
      m.querySelector('.g-now').textContent = fmt(d.after); msg.textContent = `✅ ${fmt(d.before)} → ${fmt(d.after)}`; msg.className = 'cm-msg g-msg good';
      if (built) render();
    };
    m.querySelector('.g-set').onclick = () => send({ gold: Number(m.querySelector('.g-in').value) });
    m.querySelectorAll('[data-add]').forEach(b => b.onclick = () => send({ add: Number(b.dataset.add) }));
  };

  window.openCardMaker = () => {
    if (!built) build();
    q('cmMsg').textContent = '';
    renderList(); render(); loadMine();
    showScreen('cardmaker');
  };
})();
