좋아. **라운드 3 배경용 장애물/바닥 요소를 바로 작업할 수 있도록 개별 PNG로 잘라서 폴더형 패키지로 묶었어.**

## 다운로드

### **round3_environment_game_ready_v1.zip**

---

## 미리보기

- `previews/all_assets_contact.png`
- `previews/game_scale.png`
- `START_PREVIEW.html`

---

## 들어있는 것

- **개별 투명 PNG 자산**
  - `terrain_cliffs` 22개
  - `ruins_walls` 14개
  - `platforms` 10개
  - `hazards_barricades` 2개
  - `fortress_props` 26개
  - `small_decor` 19개
- **원본 타일셋 보관본**
- **manifest.json**
- **Phaser 연결용 TypeScript 예시 코드**
- **Claude Code 전달용 지시문**
- **README / 통합 가이드**

---

## 라운드 3 환경 기본 설정

- **테마:** 불타는 밤의 폐허 요새 전장
- **용도:** 최종 라운드 지형, 바닥, 장애물, 배경 소품
- **배경 스타일:** 레트로 픽셀아트
- **파일 형식:** PNG (투명 배경)
- **권장 사용:** 바닥 충돌은 terrain/platforms 위주, 장식은 props/decor 위주

---

## 폴더 구조
```
round3_environment_game_ready_v1/
├─ public/assets/round3_environment_game_ready_v1/
│  ├─ tiles/
│  │  ├─ terrain_cliffs/
│  │  ├─ ruins_walls/
│  │  ├─ platforms/
│  │  ├─ hazards_barricades/
│  │  ├─ fortress_props/
│  │  └─ small_decor/
│  ├─ source/
│  └─ manifest.json
├─ src/environment/
│  └─ PhaserRound3Environment.ts
├─ docs/
│  └─ INTEGRATION_KO.md
├─ examples/
├─ previews/
├─ README_KO.md
├─ CLAUDE_IMPORT.md
└─ START_PREVIEW.html
```

---

## Claude Code에 넣을 때

압축 풀고 아래 파일부터 보면 돼.

1. `README_KO.md`
2. `docs/INTEGRATION_KO.md`
3. `CLAUDE_IMPORT.md`
4. `public/assets/round3_environment_game_ready_v1/manifest.json`

이 자산은 이미 개별 PNG로 분리되어 있으므로 다시 자르지 마.
