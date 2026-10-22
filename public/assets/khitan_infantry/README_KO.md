# 거란군 보병 리소스 세트

- 대상: 1라운드 일반 적 `거란군 보병`
- 프레임 크기: 128x128 PNG (투명 배경)
- 기준 방향: 오른쪽
- 기준선: y=122
- 포함 애니메이션: idle(4), walk(6), attack(6), hurt(3), death(6)
- 총 프레임 수: 25

## 폴더 구성
- `frames/<action>/` : 동작별 개별 PNG
- `atlas/` : 동작별 스트립과 전체 아틀라스 PNG/JSON
- `previews/` : 미리보기 이미지
- `manifest.json` : 전체 메타데이터

## 권장 애니메이션 속도
- idle: 5 fps, loop
- walk: 8 fps, loop
- attack: 10 fps, non-loop
- hurt: 10 fps, non-loop
- death: 8 fps, non-loop

## Phaser 사용 팁
- 왼쪽 방향은 `flipX` 로 처리.
- 공격 판정은 attack 프레임 3~4 근처에서 주는 것을 권장.
- death 마지막 프레임은 고정 유지.
- hurt는 짧게 재생 후 idle 또는 walk로 복귀.
