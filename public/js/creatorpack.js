// creatorpack.js — v154 로그인 화면 「제작자 팩」
//   [제작자 팩 열기] → 팩이 떨어져 흔들리다 번쩍! 터지고, 제작자 카드 4장이 튀어나와 날아가 자리를 잡은 뒤 한 장씩 뒤집힌다.
//   카드를 누르면 크게 보기, 마우스를 올리면 기울고 빛이 맺힌다. [다시 열기] · [닫기] · Esc
(() => {
  const CARDS = ['creator_1', 'creator_2', 'creator_3', 'creator_4'].map(n => `/images/creators/${n}.webp`);
  const LOGO = '/images/intro/logo.webp';
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
  const wait = ms => new Promise(r => setTimeout(r, reduced() ? Math.min(ms, 60) : ms));
  let root = null, busy = false, lastFocus = null;

  CARDS.concat(LOGO).forEach(src => { const i = new Image(); i.src = src; });   // 미리 받아 둔다

  function build() {
    root = document.createElement('div'); root.id = 'cpShow';
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', '제작자 팩');
    root.innerHTML = `
      <div class="cp-rays" aria-hidden="true"></div>
      <h2 class="cp-title">제작자 팩</h2>
      <div class="cp-row">${CARDS.map((src, i) => `
        <div class="cp-slot"><button type="button" class="cp-card" aria-label="제작자 카드 ${i + 1} 크게 보기" data-i="${i}">
          <span class="cp-glow" aria-hidden="true"></span>
          <span class="cp-inner"><img class="cp-face" src="${src}" alt="" draggable="false"><span class="cp-back"><img src="${LOGO}" alt="" draggable="false"></span></span>
          <span class="cp-shine" aria-hidden="true"></span>
        </button></div>`).join('')}
      </div>
      <p class="cp-hint">카드를 누르면 크게 볼 수 있어요</p>
      <div class="cp-btns"><button type="button" class="cp-again">다시 열기</button><button type="button" class="cp-close">닫기</button></div>
      <div class="cp-pack" aria-hidden="true"><img src="${LOGO}" alt=""><b>제작자 팩</b><small>4장</small></div>
      <div class="cp-flash" aria-hidden="true"></div>
      <button type="button" class="cp-x" aria-label="닫기">✕</button>`;
    document.body.appendChild(root);
    root.querySelector('.cp-close').onclick = close;
    root.querySelector('.cp-x').onclick = close;
    root.querySelector('.cp-again').onclick = () => { if (!busy) open(); };
    root.querySelectorAll('.cp-card').forEach(c => {
      c.onclick = () => { if (c.classList.contains('flipped') && !busy) zoom(CARDS[+c.dataset.i]); };
      c.addEventListener('pointermove', e => {                                  // 기울기 + 빛
        if (!c.classList.contains('flipped') || busy || e.pointerType === 'touch' || reduced()) return;
        const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        c.style.transform = `perspective(700px) rotateY(${((px - .5) * 24).toFixed(1)}deg) rotateX(${((.5 - py) * 24).toFixed(1)}deg) scale(1.06)`;
        c.style.setProperty('--mx', (px * 100).toFixed(0) + '%'); c.style.setProperty('--my', (py * 100).toFixed(0) + '%');
      });
      c.addEventListener('pointerleave', () => { c.style.transform = ''; });
    });
  }

  function sparks(n) {
    for (let k = 0; k < n; k++) {
      const s = document.createElement('i'); s.className = 'cp-spark'; root.appendChild(s);
      const a = Math.random() * Math.PI * 2, d = 140 + Math.random() * Math.min(innerWidth, innerHeight) * .55, sz = .5 + Math.random();
      const an = s.animate([{ transform: `translate(0,0) scale(${sz})`, opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 40}px) scale(0)`, opacity: 0 }],
        { duration: 700 + Math.random() * 600, easing: 'cubic-bezier(.15,.8,.3,1)', fill: 'forwards' });
      an.onfinish = () => s.remove();
    }
  }

  async function open() {
    if (busy) return; busy = true;
    if (!root) build();
    lastFocus = document.activeElement;
    const pack = root.querySelector('.cp-pack'), flash = root.querySelector('.cp-flash'), cards = [...root.querySelectorAll('.cp-card')];
    root.classList.remove('revealed', 'burst');
    cards.forEach(c => { c.classList.remove('live', 'flipped'); c.style.transform = ''; c.getAnimations().forEach(a => a.cancel()); });
    pack.style.display = ''; pack.getAnimations().forEach(a => a.cancel());
    root.style.display = ''; requestAnimationFrame(() => root.classList.add('on'));
    document.addEventListener('keydown', onKey);

    // 1) 팩이 떨어진다 → 2) 점점 세게 흔들린다
    const T = 'translateY(-50%)';
    if (!reduced()) {
      await pack.animate([{ transform: `${T} translateY(-60vh) rotate(-12deg) scale(.7)`, opacity: 0 },
        { transform: `${T} translateY(0) rotate(3deg) scale(1.04)`, opacity: 1, offset: .75 }, { transform: `${T} rotate(0) scale(1)` }],
        { duration: 520, easing: 'cubic-bezier(.3,.8,.4,1)' }).finished;
      const kf = []; for (let k = 0; k <= 14; k++) { const p = k / 14, amp = 1 + p * 6; kf.push({ transform: `${T} rotate(${(k % 2 ? -1 : 1) * amp}deg) scale(${1 + p * .08})`, filter: `brightness(${1 + p * .7})` }); }
      await pack.animate(kf, { duration: 900, easing: 'ease-in' }).finished;
    }
    // 3) 번쩍! 팩이 터진다
    root.classList.add('burst');
    flash.animate([{ opacity: .95 }, { opacity: 0 }], { duration: 650, easing: 'ease-out' });
    pack.animate([{ transform: `${T} scale(1.08)`, opacity: 1 }, { transform: `${T} scale(1.6)`, opacity: 0 }], { duration: 320, easing: 'ease-out', fill: 'forwards' })
      .finished.then(() => { pack.style.display = 'none'; });
    if (!reduced()) sparks(46);

    // 4) 카드가 팩 자리(가운데)에서 튀어나와 제자리로 날아간다
    const pr = pack.getBoundingClientRect(), cx = pr.left + pr.width / 2, cy = pr.top + pr.height / 2;
    const flights = cards.map((c, i) => {
      const r = c.getBoundingClientRect(), dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
      c.classList.add('live');
      if (reduced()) return Promise.resolve();
      return c.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(.25) rotate(${(i - 1.5) * 40}deg)`, opacity: 0 },
        { transform: `translate(${dx * .35}px, ${dy * .35 - 90}px) scale(.85) rotate(${(i - 1.5) * -14}deg)`, opacity: 1, offset: .45 },
        { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 }],
        { duration: 760, delay: 90 + i * 110, easing: 'cubic-bezier(.2,.85,.3,1.15)', fill: 'backwards' }).finished;
    });
    await Promise.all(flights);
    root.classList.add('revealed');

    // 5) 한 장씩 뒤집기
    for (const c of cards) {
      const inner = c.querySelector('.cp-inner');
      if (!reduced()) inner.animate([{ transform: 'rotateY(180deg) scale(1)' }, { transform: 'rotateY(90deg) scale(1.12)' }, { transform: 'rotateY(0) scale(1)' }],
        { duration: 520, easing: 'cubic-bezier(.3,.7,.3,1)' });
      c.classList.add('flipped');
      await wait(260);
    }
    busy = false;
    root.querySelector('.cp-close').focus({ preventScroll: true });
  }

  function zoom(src) {
    const z = document.createElement('div'); z.id = 'cpZoom'; z.setAttribute('role', 'dialog'); z.setAttribute('aria-label', '제작자 카드 크게 보기');
    z.innerHTML = `<img src="${src}" alt="제작자 카드">`;
    const shut = () => { z.classList.remove('on'); setTimeout(() => z.remove(), 220); document.removeEventListener('keydown', esc, true); };
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
    z.onclick = shut; document.addEventListener('keydown', esc, true);
    document.body.appendChild(z); requestAnimationFrame(() => z.classList.add('on'));
  }

  function onKey(e) { if (e.key === 'Escape' && !document.getElementById('cpZoom')) close(); }
  function close() {
    if (!root) return;
    busy = false; document.removeEventListener('keydown', onKey);
    root.classList.remove('on');
    setTimeout(() => { if (!root.classList.contains('on')) root.style.display = 'none'; }, 260);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  const btn = document.getElementById('cpOpen');
  if (btn) btn.onclick = open;
})();
