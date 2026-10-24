# 기업 모멘텀 랭킹 — 공개 정적 페이지

금융감독원 OpenDART 자료로 만든 상장기업 탐색 서비스의 정적 스냅샷입니다.
`site/`가 GitHub Pages 배포 디렉터리이며, 수집 API 서버나 인증키는 포함하지 않습니다.

현재 CII·FSI는 **공시 원문·정정공시 검증 전 결과**입니다. 완전지표 기업의
순위와 유형을 먼저 공개하며 검증 후 바뀔 수 있습니다. 자료·산식·결측 처리 및 검증 범위는 사이트의
평가방법론/수집·품질 현황과 `site/docs/weight-validation-report.md`를 확인하세요.
종합 현황의 종합점수는 두 지수가 모두 산출된 기업에 대해
`CII × 0.5 + FSI × 0.5`로 계산한 100점 만점 점수입니다.
수집 코드는 연결재무제표(CFS)를 요청하지만, 기존 원자료에는 요청 구분이 기록되지 않아
기업·연도별 연결/별도 기준은 공시 원문 대조 전까지 미확인으로 표시합니다.

원본 프로젝트에서 `python build_public_site.py`로 공개 파일만 다시 복사합니다.
GitHub 저장소 Settings → Pages → Build and deployment → Source에서
**GitHub Actions**를 선택하면 `main` 푸시 때 배포됩니다.
