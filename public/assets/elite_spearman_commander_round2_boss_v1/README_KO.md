# 정예 창병장 (2라운드 보스) 게임용 패키지

- 보스명: 정예 창병장
- 영문명: Elite Spearman Commander
- 라운드: 2
- HP: 500
- 2페이즈 전환: HP 250 이하
- 진영: 거란군
- 기본 방향: 오른쪽
- 공통 캔버스: 567x737

## 포함 동작
- idle: 4프레임
- walk: 6프레임
- attack: 6프레임
- charge: 6프레임
- combo: 8프레임
- phase2: 4프레임
- hurt: 4프레임
- death: 6프레임

## 폴더 설명
- public/assets/.../frames/<action>/ : 장면(동작)별로 잘린 개별 PNG
- public/assets/.../sheets/ : 원본 가로 시트
- public/assets/.../strips/ : 공통 캔버스로 정리한 동작별 strip
- public/assets/.../atlas/ : Phaser용 아틀라스 PNG/JSON
- previews/ : 미리보기 이미지
- src/boss/ : Phaser 연결용 예시 코드

## 주의
- 이 패키지는 지금까지 만든 이미지를 기준으로 동작별로 잘라 폴더화한 버전이다.
- 실제 보스 패턴 연결 시 좌우 반전은 flipX 로 처리한다.
- phase2는 변신/분노 연출용이다.
