# MSG_2026_war_game
2026&lt;MSG> 관악구 (청아즐 페스티벌) 부스 운영 강감찬게임


## 강감찬: 고려의 수호자 — 실행 방법

요구: Node.js 22.12 이상, Chrome.

```bash
npm install
npm run dev            # http://localhost:5173 (개발 서버)
npm run build          # dist/ 생성 (타입 검사 포함)
npm run preview        # 빌드 결과 확인
npm run test           # 단위 시험 1회 실행
npm run test:e2e       # Playwright (로컬 Chrome 사용)
npm run verify:assets  # 런타임 자산/프레임 검사
```

`index.html`을 파일로 직접 열지 말고 개발 서버나 HTTP(S) 정적 서버로 실행한다.
개발 서버에서 `?debug=1`을 붙이면 히트박스가 표시된다.

### 테스트 패널 (개발 서버 전용)
`npm run dev`로 실행한 화면에서 키보드 `` ` `` (숫자 1 왼쪽 키)를 누르면 오른쪽에 테스트 패널이 열린다. 마우스로 누른다.
- **바로 가기**: 1·2·3라운드 시작, 현재 라운드 보스전, 엔딩, 결과 화면
- **전투**: 현재 웨이브 정리, HP 회복, 쿨타임 초기화, 무적 ON/OFF(라운드를 바꿔도 유지), 보스 2페이즈 직전(HP를 전환 기준 +1로), 보스 처치
- **강화**: 검술·패링·지휘 횟수 조절(총 2회, 다음 라운드 시작부터 적용)

배포 빌드(`npm run build`)에는 패널이 포함되지 않는다.
구현 상태·임시 리소스·검증 결과는 `IMPLEMENTATION_NOTES.md` 참고.
