# YC Manager · 영앤클래식 관리자

영앤클래식(https://byoorim09-bot.github.io/Mine-/)의 **관리자 전용** 대시보드입니다.
방문자·조회수·제휴 클릭·전환율(CTR)·인기 콘텐츠·유입 경로를 Firebase RTDB(`youngclassic-stats`)에서 읽어 보여 줍니다.

- 주소: https://byoorim09-bot.github.io/yc-admin/
- 비밀번호: 관리자 PIN 4자리
- 검색 노출: `noindex` + `robots.txt`(이 폴더 전체 차단)
- 홈 화면 추가(PWA): 매니페스트 `id / start_url / scope = /yc-admin/`
  → 영앤클래식 본체(`/Mine-/`)와 **스코프가 겹치지 않아** 휴대폰에서 각각 다른 앱으로 설치됩니다.

## 파일

| 파일 | 설명 |
| --- | --- |
| `index.html` | 관리자 대시보드(잠금 화면 · 통계 · 📲 홈 화면 추가 · 카톡 탈출 배너 · 뒤로가기) |
| `admin.html` | `/yc-admin/`으로 보내는 안내 페이지 |
| `manifest.webmanifest` | 웹 앱 매니페스트(scope `/yc-admin/`) |
| `sw.js` | 서비스 워커(설치 조건 충족 · 화면은 네트워크 우선) |
| `yc-admin-icon-512.png` · `yc-admin-icon-192.png` · `yc-admin-apple-touch-icon.png` · `yc-admin-favicon.png` | 앱 아이콘 4종 |

기존 주소 `https://byoorim09-bot.github.io/Mine-/admin.html`은 이 주소로 자동 이동합니다.

## 배포 위치

`byoorim09-bot.github.io` 저장소(사용자 사이트, `main` 브랜치)의 `yc-admin/` 폴더가 그대로 공개됩니다.
GitHub Pages는 이 저장소의 `main`을 바라보므로, 폴더에 파일을 넣고 푸시하면 바로 반영됩니다.
