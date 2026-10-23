# 소배압 V3 게임용 이미지 폴더
실제 인접 프레임을 침범하지 않는 connected-component 단위로 분리한 35개 512×320 투명 PNG 프레임입니다.
`START_PREVIEW.html`에서 동작별 프레임을 확인할 수 있습니다.
`public/assets/sobaeap_final_v3/frames/`에 분리 PNG, `spaced_strips/`에 64px 투명 간격 시트, `atlas/`에 Phaser용 통합 PNG/JSON, `manifest.json`에 애니메이션 매핑이 있습니다.
`src/boss/PhaserSobaeapVisual.ts`는 기존 게임의 보스 AI에 장면만 연결하는 표시 전용 코드입니다.
분리하면서 붙어버린 독립 캐릭터가 둘 이상 있는 원본 구성은 사용하지 않았으며, 마지막 누운 포즈를 2프레임 유지합니다.
기존 게임 규칙 HP700/2페이즈350 및 패링/소환/피해량은 변경하지 않습니다.
