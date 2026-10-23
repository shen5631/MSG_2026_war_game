# 정예 창병장 2라운드 보스 게임용 패키지 (수정본 v2)

- 보스명: 정예 창병장
- 라운드: 2
- 최대 HP: 500
- 2페이즈 전환: HP 250 이하
- 프레임 규격: 640x640 PNG, transparent
- 기준점(anchor): (320, 622)
- 좌향 처리: flipX

## 포함 동작
- idle 4
- walk 6
- attack 6
- charge 6
- combo 8
- phase2 4
- hurt 4
- death 6

## 구성
- source_sheets/: 수정된 원본 시트
- frames/: 장면(동작)별 개별 PNG 프레임
- strips/: 동작별 strip PNG
- atlas/: Phaser atlas PNG + JSON
- manifest.json: 메타데이터
- src/boss/: TypeScript 연결 코드
- docs/: 통합 가이드
- previews/: 확인용 이미지

## 실전 적용 기준
- 이미 분리된 PNG이므로 다시 자르지 말 것
- 각 프레임은 공통 640x640 캔버스에 바닥 기준선 정렬
- 보스 본체, 창, 망토가 프레임 안에 들어오도록 재패킹
- 기존 프로젝트의 거리/페이즈 기반 보스 AI에 연결
