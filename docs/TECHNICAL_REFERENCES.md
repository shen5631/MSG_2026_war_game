# 기술·역사 확인 자료

확인일: 2026-10-22. 게임 규칙 자체는 사용자와의 대화가 근거다. 아래는 웹 API/엔진/역사 설명 검증에만 사용했다.
아래 기술 선택/기본값이 공식적으로 유일한 권장 설계라는 뜻은 아니다.

| ID | 공식 자료 | 확인한 범위 |
|---|---|---|
| T01 | Anthropic / Claude Code: How Claude remembers your project | 프로젝트 CLAUDE.md와 지시 파일 |
| T02 | Phaser 공식 3.90.0 release / 3.90.0 API | 이번 구현 기준 버전의 실제 존재와 버전별 문서 |
| T03 | Phaser 공식 API 기본 페이지 | 확인 시 기본 문서는4.1.0,3.90은최신이아님 |
| T04 | Vite Getting Started | Node20.19+/22.12+ 요구,React-TS 프로젝트구성 |
| T05 | React StrictMode | 개발모드Effect 재실행과cleanup 점검 |
| T06 | W3C Gamepad specification / MDN Using Gamepad API | standard매핑·축/버튼·폴링/연결이벤트 |
| T07 | Phaser3.90 Physics.Arcade.World | 고정시뮬레이션·manual step의초단위 |
| T08 | Phaser3.90 ScaleManager | 표시배율,zoom,전체화면 |
| T09 | WHATWG HTML User Activation | 신뢰된입력이벤트에의한활성화,게임패드폴링을동등시하지않음 |
| T10 | MDN Fullscreen API / Page Visibility | 전체화면과탭숨김이벤트 |
| T11 | Chrome Autoplay policy / Web Audio | 소리재생에대한브라우저제한 |
| H01 | 국사편찬위원회 한국사데이터베이스 『고려사』 강감찬 열전 / 우리역사넷 귀주대첩 | 귀주승리·고려군과강감찬의역할,게임결투와역사구분 |

## 주소

```text
T01 https://code.claude.com/docs/en/memory
T02 https://phaser.io/download/release/v3.90.0
T02 https://docs.phaser.io/api-documentation/3.90.0/api-documentation
T03 https://docs.phaser.io/api-documentation/api-documentation
T04 https://vite.dev/guide/
T05 https://react.dev/reference/react/StrictMode
T06 https://w3c.github.io/gamepad/
T06 https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
T07 https://docs.phaser.io/api-documentation/3.90.0/class/physics-arcade-world
T08 https://docs.phaser.io/api-documentation/3.90.0/class/scale-scalemanager
T09 https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event
T10 https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide
T10 https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
T11 https://developer.chrome.com/blog/autoplay
T11 https://developer.chrome.com/blog/web-audio-autoplay
H01 https://db.history.go.kr/id/kr_094r_0010_0030_0060
H01 https://contents.history.go.kr/mobile/kc/view.do?code=kc_age_20&levelId=kc_i200400
```

문서의 기본 수치는 프로젝트별 설계 제안이다. API와패키지지원상태는실제설치시한번더확인하고고정버전/lockfile에기록한다.
