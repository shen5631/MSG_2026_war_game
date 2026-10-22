# 여기서 시작 — Claude Code 전달 패키지

이 ZIP은 **완성 게임이 아니라 상세 명세 + 설정 데이터 + 실제 보유 스프라이트**다.
Claude Code가 추가 기획 질문 없이 로컬 개발을 시작하도록 구성했다.

## 사용 방법
1. 새 프로젝트 폴더에 압축을 푼다. `CLAUDE.md`, `docs/`, `spec/`, `public/`이 같은 루트에 있게 한다.
2. 그 폴더를 Claude Code에서 연다. 기존 프로젝트에 넣는 경우 기존 소스/설정은 삭제하지 않는다.
3. 아래 실행 지시문을 그대로 전달한다. 코드 작성이 진행되도록 편집/로컬 실행 권한을 평소 방식으로 승인한다.

## 그대로 전달할 시작 지시문

```text
이 폴더의 CLAUDE.md를 먼저 읽고, docs/GAME_SPEC_KO.md 전체와 spec/*.json,
docs/ASSET_STATUS_KO.md, docs/IMPLEMENTATION_PLAN_KO.md, docs/ACCEPTANCE_TESTS_KO.md를 읽어.

지금부터 '강감찬: 고려의 수호자'를 실제로 구현해.
기획을 다시 요약하거나 확인 질문만 하고 멈추지 말고 프로젝트 파일 생성, 코드 작성,
의존성 설치, 로컬 실행, 테스트와 빌드까지 진행해.

사용자 확정 수치와 3라운드/13웨이브/3보스/엔딩을 그대로 유지해.
미정 부분은 문서의 [구현 기본값]을 사용하고 IMPLEMENTATION_NOTES.md에 기록해.
Phaser는 이번 명세 기준 3.90.0을 고정하고 React + TypeScript + Vite를 사용해.

먼저 현재 폴더를 검사해 기존 파일을 보존하고, 빈 프로젝트면 Vite 앱을 이 루트에 구성해.
public/assets/ganggamchan_v2/의 실제 아틀라스를 연결해서 Chrome에서 첫 실행 화면을 만든 뒤,
이동·검술·패링·차징·지휘·웨이브·보스·보상·재도전·엔딩 순서로 구현해.

없는 적/배경/음원은 존재한다고 가정하지 마.
임시 픽셀 자료나 포즈 재사용으로 기능 구현을 이어갈 수 있지만,
최종 리소스 완성으로 보고하지 말고 교체 목록을 남겨.
현재 제공된 heavy에는 준비 자세 2장만 있다는 점을 반영해.

npm run typecheck, npm run test, npm run build를 실행하고,
가능하면 npm run test:e2e도 실행해 오류를 수정해.
실제 게임패드 테스트처럼 이 환경에서 수행하지 못한 검증은 미실행이라고 명시해.
최종 보고는 실행 방법, 구현 완료 기능, 임시 리소스, 남은 문제, 테스트 결과로 작성해.
계획만 출력하지 말고 첫 구현 단계부터 시작해.
```

## 중요한 자료

| 파일 | 용도 |
|---|---|
| `docs/GAME_SPEC_KO.md` | 상세 기획서 본문 |
| `docs/IMPLEMENTATION_PLAN_KO.md` | 실제 구현 순서/명령/산출물 |
| `docs/ACCEPTANCE_TESTS_KO.md` | 인수 테스트와 회귀 기준 |
| `docs/ASSET_STATUS_KO.md` | 실제 그림의 수량·결손·적용 방법 |
| `docs/DECISION_NOTES_KO.md` | 확정사항과 새로운 기본값의 경계 |
| `spec/locked_rules.json` | 변경하면 안 되는 확정 규칙 |
| `spec/runtime_defaults.json` | 정확한 미정값을 메운 첫 구현 설정 |
| `spec/levels.json` | 모든 웨이브와 구현용 맵 좌표 |
| `spec/input_map.json` | 패드·키보드 액션 |
| `spec/boss_patterns.json` | 보스 공격별 초기 수치 |
| `public/assets/ganggamchan_v2/` | 기존 PNG/아틀라스/프레임 정보 원본 |
| `tools/verify_handoff.py` | 문서 패키지의 수치/파일 무결성 검사 |
| `reference/combat-math.mjs` | Phaser에 독립적인 핵심 수식 예제와 테스트 |

패키지 자체 검사: `python tools/verify_handoff.py`
수식 예제 검사: `node --test reference/combat-math.test.mjs`
이 검사는 실제 게임 실행이나 실제 패드 테스트를 대신하지 않는다.

아직 게임 앱은 구현되지 않았으므로 Claude Code가 프로젝트를 구성하기 전에는 `npm run dev`로 게임이 실행되지 않는다.
