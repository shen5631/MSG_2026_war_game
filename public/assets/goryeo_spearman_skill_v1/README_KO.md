# 고려군 창병 지원 스킬 리소스 세트

- 대상: 강감찬 지휘 스킬 `창병 공격`에 사용되는 아군 고려군 창병
- 용도: 스킬 연출 및 타격 타이밍 표시용 아군 지원병
- 프레임 크기: 192x192 PNG (투명 배경)
- 기준 방향: 오른쪽
- 기준점(anchor): (96, 184)
- 구성 애니메이션:
  - summon: 4프레임
  - ready: 4프레임
  - strike: 6프레임
  - despawn: 4프레임

## 적용 규칙
- 기존 기획 기준으로 `가까운 적 우선`, `최대 5명`, `대상당 50 피해`로 사용한다.
- 이 패키지는 `아군 창병 1명`의 연출 리소스와 연결 코드다.
- 실제 스킬 사용 시 프로젝트 로직에 따라 대상 수만큼 여러 명을 동시에 소환하면 된다.
- 기본 색상은 고려군 남색/금색 계열로, 강감찬 및 방패병과 같은 진영 느낌에 맞췄다.

## 폴더 구성
- public/assets/goryeo_spearman_skill_v1/frames/<action>/ : 개별 PNG 프레임
- public/assets/goryeo_spearman_skill_v1/strips/ : 동작별 가로 스트립 PNG
- public/assets/goryeo_spearman_skill_v1/atlas/ : 아틀라스 PNG/JSON
- public/assets/goryeo_spearman_skill_v1/manifest.json : 메타데이터
- src/spearman-skill/ : Phaser 연결 코드
- examples/ : 예제 Scene
- previews/ : 프리뷰 이미지
- docs/INTEGRATION_KO.md : 통합 안내
- CLAUDE_IMPORT.md : Claude Code 전달 지시문

## 권장 동작 흐름
1. summon 재생
2. strike 재생
3. strike 3~4프레임 부근에서 피해 적용
4. despawn 재생 후 제거

`ready`는 미리 배치하거나 대기 연출이 필요할 때만 사용한다.
