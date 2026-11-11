// index.js — 서버 시작점
//   npm start  →  http://localhost:3000
const path = require('path');
const fs = require('fs');
const express = require('express');
const auth = require('./auth');
const saves = require('./saves');
const shop = require('./shop');
const pvp = require('./pvp');
require('./db');                                         // DB 연결·테이블 생성

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';            // 같은 와이파이의 다른 기기에서 접속하려면 HOST=0.0.0.0
const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const IMAGES = path.join(ROOT, 'images');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : process.env.TRUST_PROXY);  // 터널/프록시 뒤에서 실제 IP·https 인식
app.use('/api/bosses', express.json({ limit: '1mb' }));      // 보스 목록은 덱이 여러 개라 크다 (개발자 전용 저장 경로만 크게 허용)
app.use(express.json({ limit: '20kb' }));

// 기본 보안 헤더
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'same-origin');
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', pvp.publicRouter);                       // v128 공개 순위 (로그인 없이) — 다른 API 보다 먼저
app.use('/api', auth.router);
app.use('/api', saves.router);
app.use('/api', require('./bosses').router);           // v116: 보스 목록 (읽기: 로그인 / 쓰기: 개발자)
app.use('/api', shop.router);
app.use('/api', require('./progress').router);
app.use('/api', require('./tutorial').router);          // v140 튜토리얼 첫 완료 보상 (첫 걸음)
app.use('/api', require('./decks').router);           // v135 덱 슬롯 여러 개        // v132 카드 제작·분해 · 일일 퀘스트
app.use('/api', pvp.router);                             // 유저 대전: /api/pvp/ws(웹소켓, attachWs) · stream(SSE) · queue · cancel · mulligan · action · status
app.use('/api', require('./social').createSocialRouter({ core: pvp.core, onRename: () => require('./pvp-db').invalidateBoard() }));   // v136 닉네임 · 친구
app.use('/api', (req, res) => res.status(404).json({ error: '없는 API예요.' }));

// 게임 화면은 로그인한 사람만. 아니면 로그인 화면으로.
app.get('/ranking', (req, res) => sendStamped(res, path.join(PUBLIC, 'ranking.html')));   // v128 공개 순위 페이지 (로그인 없이)
// v157 버전 번호 자동 붙이기: html 이 부르는 .js/.css 주소 뒤에 ?v=<지문> 을 붙여 보낸다.
// 지문은 서버를 켤 때 public 의 js·css 파일 (경로·크기·수정 시각) 으로 만든다 → 파일을 덮어쓰고 서버를 다시 켜면
// 주소가 바뀌어 브라우저·폰이 옛 파일 대신 새 파일을 바로 받는다 (강력 새로고침 필요 없음)
const crypto = require('crypto');
const ASSET_VER = (() => {
  const h = crypto.createHash('sha1');
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'images' && e.name !== 'fonts') walk(f); }
    else if (/\.(js|css|html)$/.test(e.name)) { const st = fs.statSync(f); h.update(f + ':' + st.size + ':' + st.mtimeMs + ';'); }
  } };
  try { walk(PUBLIC); } catch (_) { h.update(String(Date.now())); }
  return h.digest('hex').slice(0, 10);
})();
const stampCache = new Map();   // 파일 경로 → { mtime, html }
function stampHtml(file) {
  const st = fs.statSync(file), c = stampCache.get(file);
  if (c && c.mtime === st.mtimeMs) return c.html;
  const html = fs.readFileSync(file, 'utf8').replace(/(<(?:script|link)\b[^>]*?\b(?:src|href)=")([^"?#]+\.(?:js|css))(")/gi,
    (m, a, url, b) => /^(?:https?:)?\/\//i.test(url) ? m : `${a}${url}?v=${ASSET_VER}${b}`);
  stampCache.set(file, { mtime: st.mtimeMs, html });
  return html;
}
function sendStamped(res, file) { res.set('Cache-Control', 'no-store'); res.type('html').send(stampHtml(file)); }
console.log('[server] 정적 파일 버전', ASSET_VER);
const sendIndex = (req, res) => auth.getSessionUser(req) ? sendStamped(res, path.join(PUBLIC, 'index.html')) : res.redirect('/login.html');
app.get(['/', '/index.html'], (req, res) => { res.set('Cache-Control', 'no-store'); sendIndex(req, res); });

// v154 그림은 WebP 로 바꿔 두었다. 코드·DB(보스 아이콘)·튜토리얼은 예전 이름(.png/.jpg)을 그대로 쓰므로,
//   같은 이름의 .webp 가 있으면 그걸 대신 보낸다. 없으면(원본이 더 작아 그대로 둔 그림) 원본을 보낸다.
const webpExists = new Map();
function preferWebp(dir) {
  return (req, res, next) => {
    const m = /^(.*)\.(png|jpe?g)$/i.exec(req.path);
    if (m && (req.method === 'GET' || req.method === 'HEAD')) {
      const rel = m[1] + '.webp';
      const full = path.join(dir, decodeURIComponent(rel));
      if (full.startsWith(dir + path.sep)) {
        let ok = webpExists.get(full);
        if (ok === undefined) { ok = fs.existsSync(full); webpExists.set(full, ok); }
        if (ok) req.url = rel + req.url.slice(req.path.length);
      }
    }
    next();
  };
}
app.use('/images', preferWebp(IMAGES), express.static(IMAGES, { maxAge: '7d' }));
app.use('/tutorial/images', preferWebp(path.join(PUBLIC, 'tutorial', 'images')));
app.use('/fonts/files', express.static(path.join(PUBLIC, 'fonts', 'files'), { maxAge: '30d', immutable: true }));   // v154 글꼴 조각은 바뀌지 않으니 오래 캐시
app.get(/\.html$|\/$/, (req, res, next) => {   // v157 나머지 html (로그인 · 튜토리얼 등) 도 버전 번호를 붙여 보낸다
  let rel = decodeURIComponent(req.path); if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
  sendStamped(res, file);
});
app.use(express.static(PUBLIC, { index: false, maxAge: 0, etag: true }));

app.use((err, req, res, next) => {                       // 마지막 안전망
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.status && err.status < 500 ? '잘못된 요청이에요.' : '서버 오류가 났어요.' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`카드 결투 서버: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  if (!fs.existsSync(IMAGES)) console.warn('⚠ images/ 폴더가 없어요. 기존 프로젝트의 images 폴더를 이 폴더(프로젝트 루트)에 복사해 주세요.');
});

pvp.attachWs(server);                                   // v148 유저 대전 실시간 통로: 웹소켓 /api/pvp/ws (Quick Tunnel 은 SSE 를 막는다)

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { pvp.core.shutdown(); } catch (_) {} server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 1500).unref(); });
