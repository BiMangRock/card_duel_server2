// test-syntax.js — v170 public/js 의 모든 스크립트가 문법 오류 없이 읽히는지 (하나라도 깨지면 메인 화면 전체가 멈춘다)
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'public', 'js');
let bad = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
  try { new vm.Script(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }); }
  catch (e) { bad++; console.log('✘ 문법 오류: ' + f + ' — ' + e.message); }
}
if (bad) { console.log('✘ 실패'); process.exit(1); }
console.log('✔ 스크립트 문법 검사 통과');
