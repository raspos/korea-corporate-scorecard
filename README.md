# 기업 모멘텀 랭킹 — 공개 정적 페이지

금융감독원 OpenDART 자료로 만든 상장기업 탐색 서비스의 정적 스냅샷입니다.
`site/`가 GitHub Pages 배포 디렉터리이며, 수집 API 서버나 인증키는 포함하지 않습니다.

현재 CII·FSI는 **공시 원문·정정공시 검증 전 탐색값**입니다. 공식 순위와
기업 유형은 검증 후 발표합니다. 자료·산식·결측 처리 및 검증 범위는 사이트의
평가방법론/수집·품질 현황과 `site/docs/weight-validation-report.md`를 확인하세요.

원본 프로젝트에서 `python build_public_site.py`로 공개 파일만 다시 복사합니다.
GitHub 저장소 Settings → Pages → Build and deployment → Source에서
**GitHub Actions**를 선택하면 `main` 푸시 때 배포됩니다.
