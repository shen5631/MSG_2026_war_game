# 2라운드 환경 게임용 패키지 V2

- 총 개별 PNG: **70개**
- 원본: 2라운드 지형 시트 + 전쟁 캠프 장애물 시트
- 배경: 투명 PNG
- 용도: Phaser 2D 횡스크롤 2라운드 지형, 발판, 장애물, 장식

## 카테고리
- terrain/ground: 평지와 긴 지면
- terrain/cliffs: 절벽/높은 지형
- terrain/slopes: 경사 지형
- platforms: 부유 발판과 목재 다리
- props/defenses: 목책, 말뚝, 문루, 방책
- props/camp: 상자, 통, 화톳불, 천막, 마차 잔해
- props/decor: 깃발, 바위, 장식물

## 핵심 파일
- public/assets/round2_environment_v2/atlas/round2_environment_atlas.png
- public/assets/round2_environment_v2/atlas/round2_environment_atlas.json
- public/assets/round2_environment_v2/manifest.json
- src/environment/PhaserRound2Environment.ts
- examples/round2_sample_layout.json

충돌 판정은 PNG 크기와 별도로 맵 데이터/Physics body로 설정해야 한다.
