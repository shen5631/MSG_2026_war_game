# 거란군 기병 V6 — 프레임 안전 분리 / Phaser 표시 패키지

**거란군 일반 적 `cavalry`**, 3라운드용. 아군/보스 아님. 전투 수치와 기존 AI는 수정하지 않음.

## 우선 확인

- `START_PREVIEW.html`: 실제 이미지를 동작별 재생, 한 장씩 넘기기, 좌우 반전, 투명 여백 확인
- `previews/all_frames_contact.png`: 34개 PNG 컨택트시트
- `previews/animation_preview.gif`: 질주 애니메이션
- `previews/game_scale.png`: 게임 논리 픽셀 크기 확인
- `validation/VALIDATION_KO.md`: **실제 수행한** 검사와 미검증 범위

## 포함 그림

| 상태 | 개별 투명 PNG 수 | FPS |
|---|---:|---:|
| idle | 4 | 5 |
| walk | 6 | 9 |
| run | 6 | 12 |
| attack | 6 | 10 |
| charge | 2 | 10 |
| hurt | 4 | 10 |
| death | 6 | 8 |

개별 게임용 프레임은 448×256 RGBA, origin `(224,220)`이고 실제 캐릭터는 그보다 작음. 넉넉한 투명 여백이 있어 정해진 격자로 또 나누면 안 됨. 각 상태 프레임 간 발 기준과 말 중심을 보정했으며, 합친 아틀라스·원본 시트·독립 원본 해상도 분리본도 제공함.

## 이미지 제작 규칙

7개 원본에서 최대 불투명 연결 실루엣을 **각각 직접 분리**, 부드러운 외곽 알파를 해당 실루엣으로 되돌렸다. 이웃 객체의 창·말꼬리 조각을 함께 복사하지 않았음. 원본 끝에서 이미 잘린 4개의 프레임은 다른 완전한 포즈로 대체(재사용)함. 정확한 파일명 및 출처는 `manifest.json` 참고.

**화면 캔버스의 빈 여백은 잘림 방지용이지 실제 적의 충돌영역이 아니다.** 실제 게임 640×360, 픽셀 아트 nearest-neighbor 확대, Phaser origin/scale=1로 시작할 것.

## 코드

`src/enemy/core.ts`: 프레임 이름 및 시간 기반 선택·공격 판정 박스 예제. `src/enemy/PhaserCavalryView.ts`: existing AI를 받아 표시하는 **Phaser 구조형 어댑터**. `examples/ExistingGameIntegration.ts`: 연결 예제. 실제 게임의 적 AI·이동·충돌·장애물 회피를 새로 추가하는 패키지가 아님.

`CLAUDE_IMPORT.md`에 복사·연결 지시문, `docs/INTEGRATION_KO.md`에 적용 주의사항 제공.
