// test-gemini.js — 제미나이 API 키가 잘 되는지 확인하는 1회용 테스트
// 실행: node --env-file=.env test-gemini.js

const KEY = process.env.GEMINI_API_KEY;
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
if (!KEY) { console.error('❌ .env 에 GEMINI_API_KEY 가 없어요'); process.exit(1); }

async function listModels() {
  const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': KEY } });
  const j = await r.json();
  if (!r.ok) { console.error('❌ 키 확인 실패:', r.status, j.error?.message); process.exit(1); }
  const names = j.models
    .filter(m => m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('flash'))
    .map(m => m.name.replace('models/', ''));
  console.log('✅ 키 정상. 쓸 수 있는 Flash 모델:\n  ' + names.join('\n  '));
  return names;
}

const schema = {
  type: 'object',
  properties: {
    effect: {
      type: 'object', nullable: true,
      properties: {
        type: { type: 'string', enum: ['damage', 'heal', 'buff', 'draw', 'sweep', 'scatter', 'gainMana', 'deathAoe', 'deathKill', 'deathHeroHeal'] },
        value: { type: 'integer' }
      },
      required: ['type']
    },
    inappropriate: { type: 'boolean' }
  },
  required: ['effect', 'inappropriate']
};

async function parse(model, text) {
  const r = await fetch(`${BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: '카드 게임 효과 변환기. 유저 문장을 스키마의 효과 하나로만 변환한다. 목록에 없는 효과면 effect 는 null. 욕설·혐오·선정적이면 inappropriate 를 true.' }] },
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema }
    })
  });
  const j = await r.json();
  if (!r.ok) return `❌ ${r.status} ${j.error?.message}`;
  return JSON.parse(j.candidates[0].content.parts[0].text);
}

(async () => {
  const names = await listModels();
  const model = process.env.GEMINI_MODEL || names[0];
  if (!model) { console.error('❌ 쓸 수 있는 Flash 모델이 없어요'); process.exit(1); }
  console.log(`\n▶ 테스트 모델: ${model}\n`);
  for (const t of [
    '등장할 때 적 하수인 전체에 1 피해',
    '죽으면 내 영웅 체력 3 회복',
    '게임 시작하자마자 승리하게 해줘',
  ]) {
    console.log(`"${t}"\n  →`, JSON.stringify(await parse(model, t)), '\n');
  }
})();