# 소배압 최종 보스 — 잘림 및 이웃 프레임 혼입 방지 V5

## 이 수정이 기존 V4와 다른 점
* 원본 4장의 일자/행 균등 절단을 사용하지 않음
* 8방향 연결 픽셀을 이용해 **한 포즈의 망토·창·다리·검격 전체**를 추출하고, 다른 포즈 픽셀은 포함하지 않음
* 원본 우측 가장자리로 지나치게 붙었던 walk 06과 attack 06은 **안전한 바로 전 포즈 재사용**; 출처는 validation/validation.json
* 원본 해상도 그대로 사용. 704x480 RGBA, 게임 권장 배율 0.5, origin (0.5, 416/480)
* 원본 행을 재편집하지 않고 원본 파일을 source_sheets에 보존
* 각 애니메이션 별 atlas PNG+JSON, 동작별 64px 투명 간격 시트, 개별 PNG
* **이미지의 여백은 충돌체 크기가 아님**. 게임 충돌 상자는 기존 보스 AI와 물리 코드를 그대로 쓰세요.

## 구현
1. public/assets/sobaeap_v5를 프로젝트의 public/assets/에 복사
2. src/boss/PhaserSobaeapV5.ts에서 preloadSobaeapV5(scene)를 기존 씬 preload에 호출
3. registerSobaeapV5Animations(scene)를 create에서 호출
4. createSobaeapV5Sprite(scene, bossX, groundY) 사용 / 기존 AI의 상태만 setSobaeapV5Visual(sprite, state, facing)에 연결
5. Phaser config에 pixelArt:true, roundPixels:true, 배율 0.5 권장. 640x360 내부 해상도와 정수 확대 방식 유지
6. HP 700 / 2페이즈 350 / 소환병 최대 3명 등 기존 확정 수치는 건드리지 말 것

`START_PREVIEW.html`은 이미지 한 장씩 검사하는 독립 프리뷰. 외부 라이브러리 불필요.

## 검수 범위
- 개별 이미지의 투명 여백/알파 검사, 아틀라스와의 픽셀 비교, 클립 누락 여부 검사
- 브라우저 미리보기는 파일 로드/프레임 변경/flipX 검사 가능
- **실제 사용 중인 React/Phaser 게임을 직접 실행해 통합한 검사는 아님**. AI·물리·맵과의 통합 확인 필요
