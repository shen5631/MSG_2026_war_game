# 강감찬 1라운드 보스 — 거란군 선봉대장 전투 이펙트 V2

**기존 V1 폐기.** V1 원본은 이미지 간 픽셀이 연결되어 있어 단순 재분할로는 창끝/불꽃 파편이 섞였습니다. 이 V2는 기존 이미지를 잘라 붙인 것이 아니라, 각 효과를 **별도로 재제작한 픽셀아트 이미지 31장**입니다. 기존 색상 계열(검붉은색/주황빛/흰색/모래먼지)은 유지하되 완전히 같은 그림은 아닙니다.

## 다운로드 구성
- `public/assets/round1_vanguard_boss_fx_clean_v2/frames/`: **31개 독립 투명 RGBA PNG**
- `.../strips/`: 각 효과의 프레임을 **64px 투명 여백**으로 분리한 참고용 가로 시트
- `.../atlas/`: Phaser3에 로드할 PNG+JSON 통합 아틀라스 (런타임에는 이것만 로드 권장)
- `.../manifest.json`: 프레임 목록, 순서, fps, 좌표 기준점
- `src/vfx/PhaserVanguardBossFx.ts`: 시각효과만 재생하는 Phaser 호환 TS 어댑터
- `examples/VanguardFxExampleScene.ts`: Phaser 씬 연결 예제 (프로젝트 Phaser 설치 필요)
- `START_PREVIEW.html`: **실제 개별 PNG를 재생하는 로컬 브라우저 미리보기**
- `previews/`: 전체 이미지, GIF, 640×360 게임 화면 참고
- `tests/`, `validation/`: 실제 정적 테스트 기록 및 재실행 스크립트

## 고정 규격
- 개별 PNG: **384×256, 투명 배경 (RGBA)**
- 생성: 작은 픽셀격자로 따로 그린 뒤 NEAREST 2배 확대한 이미지 (흐림 방지)
- 캐릭터가 아닌 순수 효과만 포함, 이름/격자/타 캐릭터 조각 없음
- 실제 이펙트는 외곽에 충분한 여백이 있으며, 한 프레임을 다른 프레임에서 잘라낸 것이 아님
- 개별 이미지 기본 scale=1, 640×360 게임 내부 해상도 + 최근접 정수 배율 확대 기준
- 애니메이션만 일시정지하려면 기존 Phaser Scene을 일시정지할 것

## 동작 종류
| 효과 | 프레임 | 용도 |
|---|---:|---|
| slash_arc | 6 | 검 베기 궤적 |
| dash_trail | 6 | 돌진 잔상·먼지 |
| summon_pillar | 4 | 2페이즈 진입 붉은 연출, 신규 소환 패턴 아님 |
| impact_burst | 4 | 검 충돌·패링 성공 섬광 |
| ground_flame_circle | 5 | 불가 패링 공격의 붉은 예고를 도와주는 시각효과 |
| ground_explosion | 6 | 내려찍기 지면 파편·폭발 연출 |

## 게임 기획 준수
- 이 패키지의 코드에는 **HP/공격 피해/패링 판정/보스 AI/쿨타임 계산이 들어 있지 않습니다.**
- `ground_flame_circle`은 새로운 독립 장판 피해가 아니며, 기존 붉은 내려찍기의 위험 예고 표시만 합니다.
- `summon_pillar`은 2페이즈 전환 이펙트이며 병사 소환 능력을 추가하지 않습니다.
- 각 실제 피해 적용/패링 판정은 기존 Phaser 게임의 시간 기반 전투 판정에서 한 번만 실행됩니다.
- 상대에게 물리 충돌체나 접촉 피해를 이 이미지로 추가하지 마세요.

## 적용 순서
1. `public/assets/round1_vanguard_boss_fx_clean_v2` 를 **기존 Vite 프로젝트의 `public/assets`** 로 복사.
2. `src/vfx/PhaserVanguardBossFx.ts` 를 프로젝트의 `src`로 옮기거나 import 가능한 위치에 배치.
3. Phaser `Scene.preload()`에서 `preloadVanguardBossFx(this)` 호출.
4. 로딩 완료 후 `Scene.create()`에서 `createVanguardBossFxAnimations(this)` 호출.
5. 기존 보스 이벤트 발생 위치에서 `playVanguardBossFx(...)` 호출. **새로운 보스 AI나 공격 타이머는 만들지 않습니다.**
6. 테스트: 이미지 31장 로드, 프레임 전환, 좌우 반전, 일시정지, 겹치는 연출 시 한 번만 보이기, 파괴 후 정리, 60fps 확인.
7. 프로젝트의 `package.json`은 덮어쓰지 말고 `README`를 참조하세요.

독립 HTML과 이미지 일치/일관성 테스트는 실행하지만 **네 실제 프로젝트에서 Phaser 통합 실행은 하지 않았습니다.** 미검증 범위는 validation에 기록되어 있습니다.
