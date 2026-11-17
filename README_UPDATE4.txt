업데이트 4 — my-server 폴더에 그대로 풀어 덮어쓰세요.

※ engine.js · ui.js 는 11월 12일 파일(예전에 올려 주신 my-server.zip)을 기준으로 고쳤습니다.
   그 뒤로 두 파일을 직접 고치셨다면 덮어쓰지 말고 아래 "고친 줄"만 옮겨 넣으세요.

1) 마우스를 올리면 카드 크게 보기
   - 원래 기능은 있었는데, 처음 열 때 '터치 기기'로 잡히면(터치 화면 노트북 등) 마우스를 써도 안 나왔습니다 → 마우스를 움직이면 바로 켜지게
   - 멀리건 · 발견 창의 카드도 마우스를 올리면 크게 + 키워드 설명
   고친 줄 (ui.js, "v83: 카드 위에 마우스를 올리면" 바로 아래):
     const hover=… → let hover=… 로 바꾸고, 그 아래에 pointermove(마우스면 hover=true) · pointerdown(터치면 hover=false) 두 줄
     const SKIP='#mulliganModal,#discoverModal,#spellCast,#burnCast,#cardPreview'  →  '#spellCast,#burnCast,#cardPreview'

2) 그림 없던 토큰 5개에 기존 그림 연결 (cardart.js 맨 위)
   오크=훈련 교관 · 블러드 엘프=주문사수 · 신병=견습 검사 · 돌 토템=속임수 토템 · 게임 불감증=PC방

3) 규칙 (engine.js)
   - 불안정한 진화로 변신한 하수인은 그 턴에 공격 불가 (돌진이 붙은 하수인이 나오면 공격 가능). 카드 설명에도 한 줄 추가
     고친 곳: upgradeMinion 의 summoned:t.summoned → summoned:true
   - 환생하면 새로 소환된 것처럼: 돌진 하수인은 바로 다시 공격 가능, 속공은 하수인만, 나머지는 다음 턴부터
     고친 곳: sweepDead 의 환생 줄에 m.attacked=false; m.wfUsed=false; m.summoned=true; 추가
   서버 테스트 28개 통과 (test-adventure 한 개는 고치기 전 엔진에서도 똑같이 실패하던 것 — 모험 첫 클리어 보상 카드 확인 부분)
   강화학습 폴더(card_rl2)도 같은 규칙으로 학습하려면 tools\sync_engine.bat 를 한 번 실행하세요.

4) 술자리 · 카페 · 포차 컷신에서는 잔잔한 음악 대신 주점 음악(Firelit Tavern) + 웅성거림 (sound.js)

5) LOW_RES_ART.txt — 하수인 그림이 흐릿한 진짜 이유
   기본 하수인 그림 160개 중 123개가 89x89 정도로 아주 작아서, 전장에서 늘려 보이며 흐려집니다.
   이 목록의 파일을 480x320 정도로 다시 만들어 같은 이름으로 덮어쓰면 코드 수정 없이 바로 선명해집니다.
