# 거란군 적 창병 리소스 세트

- 대상: 적 일반 유닛 `거란군 창병`
- 용도: 횡스크롤 액션 게임의 적 보행/공격/피격/사망 애니메이션
- 프레임 크기: 192x192 PNG (투명 배경)
- 기준 방향: 오른쪽
- 기준선: y=184
- 포함 애니메이션: idle 4, walk 6, attack 6, hurt 3, death 6

## 폴더 구성
- `public/assets/khitan_spearman_enemy_v1/frames/<action>/` : 동작별 개별 PNG
- `public/assets/khitan_spearman_enemy_v1/strips/` : 동작별 가로 스트립 PNG
- `public/assets/khitan_spearman_enemy_v1/atlas/` : 전체 아틀라스 PNG/JSON 및 동작별 JSON
- `src/spearman/` : Phaser 연결 코드와 기본 설정
- `examples/` : 연결 예제
- `previews/` : 프레임 미리보기
- `docs/INTEGRATION_KO.md` : 연결 방법
- `CLAUDE_IMPORT.md` : Claude Code 전달 지시문

## 권장 애니메이션 속도
- idle: 5 fps, loop
- walk: 8 fps, loop
- attack: 10 fps, non-loop
- hurt: 10 fps, non-loop
- death: 8 fps, non-loop

## 구현 팁
- 왼쪽 방향은 `flipX` 로 처리.
- 공격 판정은 attack 프레임 4 부근부터 5 부근까지 짧게 주는 것을 권장.
- hurt는 짧게 재생 후 idle 또는 walk로 복귀.
- death는 마지막 프레임에서 정지.
- 창 끝이 길기 때문에 몸체 중심이 아니라 발 기준점으로 정렬.
- 이 유닛은 적 일반병이므로 별도 패링 불가 표시나 보스 2페이즈는 없음.
