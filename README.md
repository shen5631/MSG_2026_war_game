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
구현 상태·임시 리소스·검증 결과는 `IMPLEMENTATION_NOTES.md` 참고.
