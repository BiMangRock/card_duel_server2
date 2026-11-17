// test-gichul.js — v168 수능 기출: 문항 목록 형식 · 교시별 구성 · 계정별 출제 기록 API (임시 DB)
process.env.DB_PATH = ':memory:';
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const auth = require('./auth');
const quiz = require('./quiz');
const db = require('./db');

const ROOT = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'gichul.json'), 'utf8'));
// 1) 목록 형식 · 그림 파일이 실제로 있는지
const ids = new Set();
for (const q of data) {
  assert(!ids.has(q.id), '겹치는 id ' + q.id); ids.add(q.id);
  assert(Number.isInteger(q.ans) && q.ans >= 0 && q.ans <= 4, q.id + ' 정답');
  assert([1, 2, 3, 4].includes(q.pts), q.id + ' 배점');
  assert(fs.existsSync(path.join(ROOT, q.img)), q.id + ' 그림 없음 ' + q.img);
  if (q.lead) assert(fs.existsSync(path.join(ROOT, q.lead)), q.id + ' 지문 그림 없음');
}
const count = f => data.filter(f).length;
// 2) 교시별 구성에 필요한 문제가 충분한지
assert(count(q => q.area === '국어' && q.pts === 2) >= 10 && count(q => q.area === '국어' && q.pts === 3) >= 5, '국어 2점 · 3점');
for (const p of [2, 3, 4]) assert(count(q => q.area === '수학' && q.pts === p) >= 5, '수학 ' + p + '점');
assert(count(q => q.area === '영어' && q.pts === 2) >= 10 && count(q => q.area === '영어' && q.pts === 3) >= 5, '영어 2점 · 3점');
assert(count(q => q.area === '사회') >= 100 && count(q => q.area === '과학') >= 100, '사회 · 과학');
assert(count(q => q.area === '한국사') === 20 && count(q => q.area === '한문') === 30, '한국사 · 한문');
assert(!data.some(q => q.area === '영어' && q.no < 18), '영어 듣기 문제는 없음');
// 3) 출제 기록 API
const app = express(); app.use(express.json()); app.use('/api', auth.router); app.use('/api', quiz.router);
const server = http.createServer(app).listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const call = async (method, url, body) => { const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; return { status: r.status, data: await r.json().catch(() => ({})) }; };
  try {
    assert.strictEqual((await call('GET', '/api/quiz/seen')).status, 401, '로그인 필요');
    assert([200, 201].includes((await call('POST', '/api/signup', { username: 'quizguy', nickname: 'quizguy', password: 'password1' })).status));
    assert.deepStrictEqual((await call('GET', '/api/quiz/seen')).data.seen, {});
    const a = data[0].id, b = data[1].id;
    const r1 = await call('POST', '/api/quiz/seen', { ids: [a, b, a, 'no-such-id'] });
    assert.strictEqual(r1.data.saved, 2, '없는 id · 중복은 빼고 저장');
    await call('POST', '/api/quiz/seen', { ids: [a] });
    assert.deepStrictEqual((await call('GET', '/api/quiz/seen')).data.seen, { [a]: 2, [b]: 1 }, '횟수가 쌓임');
    console.log('test-gichul OK', data.length, '문항');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { server.close(); }
});
