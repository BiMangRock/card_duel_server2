// login.js — 로그인/회원가입 화면 동작
(() => {
  const $ = id => document.getElementById(id);
  const form = $('form'), err = $('err'), go = $('go');
  let mode = 'login';

  // v170 브라우저의 「비밀번호를 저장할까요?」 창이 뜨지 않게: 비밀번호 칸을 진짜 password 칸 대신 점(●)으로 가린 글자 칸으로 바꾼다
  //  (저장 창이 뜨면 전체화면이 풀린다). 점 가리기를 못 하는 브라우저에서는 원래대로 둔다
  if (window.CSS && CSS.supports && CSS.supports('-webkit-text-security', 'disc')) {
    form.setAttribute('autocomplete', 'off');
    ['password', 'password2'].forEach(id => {
      const el = $(id); if (!el) return;
      el.type = 'text'; el.style.webkitTextSecurity = 'disc'; el.removeAttribute('name');
      el.setAttribute('autocomplete', 'off'); el.setAttribute('autocapitalize', 'off'); el.spellcheck = false;
    });
  }

  // 이미 로그인돼 있으면 바로 게임으로
  const intro = () => { try { sessionStorage.setItem('cardDuel.intro', '1'); } catch (_) {} };   // v147 메인 화면에서 인트로(칼 + 로고)를 한 번 보여 준다 (intro.js)
  fetch('/api/me').then(r => { if (r.ok) { intro(); location.replace('/'); } }).catch(() => {});

  function setMode(m) {
    mode = m;
    $('tabLogin').classList.toggle('on', m === 'login');
    $('tabSignup').classList.toggle('on', m === 'signup');
    form.classList.toggle('signup', m === 'signup');
    $('password').autocomplete = m === 'signup' ? 'new-password' : 'current-password';
    $('password2').required = m === 'signup';
    $('nickname').required = m === 'signup';
    go.textContent = m === 'signup' ? '가입하고 시작' : '로그인';
    err.textContent = '';
  }
  $('tabLogin').onclick = () => setMode('login');
  $('tabSignup').onclick = () => setMode('signup');

  // v170 확인 창 (브라우저 confirm 대신 — confirm 은 전체화면을 풀어 버린다)
  function askBox(title, text, okLabel) {
    if (!document.getElementById('askBoxCss')) {
      const st = document.createElement('style'); st.id = 'askBoxCss';
      st.textContent = '#askBox{position:fixed;inset:0;z-index:9999;background:rgba(10,8,18,.78);display:flex;align-items:center;justify-content:center;padding:1rem}'
        + '#askBox .ab-p{width:min(400px,92vw);background:linear-gradient(180deg,#241f38,#181428);border:1px solid #9a7b3a;border-radius:12px;padding:1.1rem 1.2rem;color:#efe6d0;box-shadow:0 10px 30px rgba(0,0,0,.6)}'
        + '#askBox h3{margin:0 0 .6rem;color:#e8c46a;font-size:1.05rem}#askBox p{margin:0 0 1rem;line-height:1.55;font-size:.92rem}'
        + '#askBox .ab-b{display:flex;justify-content:flex-end;gap:.5rem}#askBox button{font:inherit;padding:.5rem 1rem;border-radius:8px;border:1px solid #9a7b3a;cursor:pointer;background:#2c2540;color:#efe6d0}'
        + '#askBox .ab-ok{background:#c9a14a;color:#1a1408;font-weight:700}';
      document.head.appendChild(st);
    }
    return new Promise(res => {
      const ov = document.createElement('div'); ov.id = 'askBox';
      ov.innerHTML = '<div class="ab-p"><h3></h3><p></p><div class="ab-b"><button type="button" class="ab-no">취소</button><button type="button" class="ab-ok"></button></div></div>';
      ov.querySelector('h3').textContent = title; ov.querySelector('p').textContent = text; ov.querySelector('.ab-ok').textContent = okLabel || '확인';
      const done = v => { ov.remove(); document.removeEventListener('keydown', key, true); res(v); };
      const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(true); } };
      ov.querySelector('.ab-no').onclick = () => done(false); ov.querySelector('.ab-ok').onclick = () => done(true);
      ov.onclick = e => { if (e.target === ov) done(false); };
      document.addEventListener('keydown', key, true);
      document.body.appendChild(ov); ov.querySelector('.ab-ok').focus();
    });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    const username = $('username').value.trim(), password = $('password').value, nickname = $('nickname').value.trim();
    if (mode === 'signup' && !/^[A-Za-z0-9_가-힣]{2,12}$/.test(nickname)) { err.textContent = '닉네임은 2~12자의 한글·영문·숫자·밑줄(_)만 쓸 수 있어요.'; return; }
    if (mode === 'signup' && password !== $('password2').value) { err.textContent = '비밀번호 확인이 달라요.'; return; }
    if (mode === 'signup' && !await askBox(`${nickname}(으)로 정할까요?`, '한 번 정하면 바꿀 수 없어요.', '이 닉네임으로 가입')) return;
    go.disabled = true;
    try {
      const r = await fetch(mode === 'signup' ? '/api/signup' : '/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mode === 'signup' ? { username, nickname, password } : { username, password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { err.textContent = data.error || '문제가 생겼어요. 잠시 후 다시 해 주세요.'; return; }
      intro(); location.replace('/');
    } catch (_) {
      err.textContent = '서버에 연결할 수 없어요.';
    } finally { go.disabled = false; }
  });
})();
