// test-quizbank.js — v167 문제 묶음: 형식 · 겹침 없는 출제 · 난이도 조절
//   node server/test-quizbank.js
const assert = require('assert');
const path = require('path');
global.localStorage = { _: {}, getItem(k) { return this._[k] || null; }, setItem(k, v) { this._[k] = String(v); } };
const Q = require(path.join(__dirname, '..', 'public', 'js', 'quizbank.js'));

const ids = new Set();
for (const [subj, list] of Object.entries(Q.BANK)) {
  assert(list.length >= 8, subj + ' 문제가 너무 적음');
  for (const x of list) {
    assert(!ids.has(x.id), '겹치는 id ' + x.id); ids.add(x.id);
    assert.strictEqual(x.opts.length, 5, x.id + ' 보기는 5개');
    assert(Number.isInteger(x.ans) && x.ans >= 0 && x.ans < 5, x.id + ' 정답 번호');
    assert([1, 2, 3].includes(x.lv), x.id + ' 난이도');
    assert.strictEqual(new Set(x.opts).size, 5, x.id + ' 보기가 겹침');
    for (const lv of [1, 2, 3]) assert(list.some(y => y.lv === lv), subj + ' 난이도 ' + lv + ' 문제가 없음');
  }
}
assert(Q.count() >= 30, '모의고사 30문제보다 많아야 함');
// 한 과목을 다 돌 때까지 같은 문제가 다시 나오지 않음
for (const subj of Object.keys(Q.BANK)) {
  const n = Q.BANK[subj].length, got = new Set();
  for (let i = 0; i < n; i++) got.add(Q.draw(subj, 2).id);
  assert.strictEqual(got.size, n, subj + ' 겹침 없이 한 바퀴');
}
// 맞힐수록 쉬워짐
assert.deepStrictEqual([0, 1, 2, 3].map(k => Q.levelFor(k, 3)), [3, 2, 1, 1]);
assert.deepStrictEqual([0, 9, 10, 19, 20].map(k => Q.levelFor(k, 30)), [3, 3, 2, 2, 1]);
// 요청한 난이도가 먼저
localStorage._ = {};
assert.strictEqual(Q.draw('수학', 3).lv, 3);
assert.strictEqual(Q.draw('수학', 1).lv, 1);
// 섞기: 30문제 안에 같은 문제 없음
localStorage._ = {}; const used = []; for (let i = 0; i < 30; i++) { const q = Q.draw('mix', Q.levelFor(0, 30), used); used.push(q.id); }
assert.strictEqual(new Set(used).size, 30, '모의고사 30문제 겹침 없음');
console.log('test-quizbank OK', Q.count(), '문제');
