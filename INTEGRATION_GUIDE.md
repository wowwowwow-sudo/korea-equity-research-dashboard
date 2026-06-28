# 리서치 대시보드 — 실데이터 연동 가이드

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    데이터 소스                               │
│                                                             │
│  FnGuide DataGuide Pro   KRX 데이터포털  KITA K-stat       │
│  (Excel / API)           (REST API)      (REST API)        │
│       └─────────────┬────────┘──────────────┘              │
│                     ▼                                       │
│              backend.py (FastAPI)                          │
│         ┌──────────────────────────┐                       │
│         │ parse_dataguide()        │  → 실적 / 컨센서스    │
│         │ parse_krx_short()        │  → 대차잔고           │
│         │ parse_kita()             │  → 수출입             │
│         │ crawl_news()             │  → 뉴스               │
│         │ calc_*_score()           │  → 점수 계산          │
│         │ snapshot_scores()  (cron)│  → 점수 이력 적재     │
│         └──────────┬───────────────┘                       │
│                    │  /api/company/{ticker}                 │
│                    │  /api/sectors                          │
│                    │  /api/events/{ticker}                  │
│                    ▼                                        │
│         dashboard_api.js (React 훅)                        │
│         ┌──────────────────────────┐                       │
│         │ useSectors()             │  → 메인 화면          │
│         │ useCompany(ticker)       │  → 기업 상세          │
│         │ useScoreHistory(ticker)  │  → 점수 추이 차트     │
│         │ useEvents(ticker)        │  → 이벤트 가점        │
│         └──────────┬───────────────┘                       │
│                    ▼                                        │
│         research_dashboard.jsx (현재 더미 데이터)           │
└─────────────────────────────────────────────────────────────┘
```

---

## 단계별 전환 계획

### Phase 1 — DataGuide 연결 (즉시 가능, 계약 보유)

DataGuide Pro에서 아래 4개 리포트를 Excel로 내보내면 바로 연결됩니다.

| 파일명                     | DataGuide 경로                      | 업데이트 주기 |
|---------------------------|--------------------------------------|--------------|
| `financial_YYYYMMDD.xlsx` | 재무 → 분기실적                      | 분기 1회     |
| `consensus_YYYYMMDD.xlsx` | 컨센서스 → 영업이익예상              | 주 1~2회     |
| `reports_YYYYMMDD.xlsx`   | 리서치 → 애널리스트의견              | 매일         |
| `price_YYYYMMDD.xlsx`     | 시세 → 일별시세 + 시가총액           | 매일         |

```bash
# data/ 폴더에 파일 넣고 서버 실행
mkdir data
mv ~/Downloads/financial_20260626.xlsx data/
uvicorn backend:app --reload
```

### Phase 2 — KRX 대차잔고 (신청 즉시, 무료)

1. [data.krx.co.kr](https://data.krx.co.kr) 회원가입
2. 오픈API 메뉴 → 신청 → 인증키 발급 (영업일 1~2일 소요)
3. `backend.py` 상단 `KRXParser(api_key="YOUR_KEY")` 에 키 입력

```python
# backend.py 7번 섹션
krx = KRXParser(api_key="발급받은키입력")
```

### Phase 3 — 수출입 데이터 (KITA K-stat, 무료)

1. [stat.kita.net](https://stat.kita.net) 회원가입 → API 신청
2. HS코드 매핑 테이블(`HS_MAP`) 작성

```python
# backend.py HS_MAP 확장
HS_MAP = {
    "000660": ["854232", "854231"],   # SK하이닉스 → D램/낸드
    "373220": ["850760"],             # LG에너지솔루션 → 리튬이온전지
    # 신규 종목 추가
}
```

**HS코드 찾는 방법:**
- [관세청 품목분류 시스템](https://unipass.customs.go.kr) → 품목명 검색
- 또는 회사 IR 자료 → 수출 품목 → HS코드 확인

### Phase 4 — 점수 이력 적재 (서버 셋업 후)

```bash
# crontab -e 에 추가 (평일 오후 4시 = 장 마감 후)
0 16 * * 1-5 cd /path/to/app && python -c "
import asyncio
from backend import snapshot_scores
asyncio.run(snapshot_scores())
"
```

---

## React 대시보드 수정 방법

### 최소 변경 (종목 1개씩 점진 전환)

기존 `research_dashboard.jsx` 상단에 아래 임포트 추가:

```jsx
import { useCompanyWithFallback } from './dashboard_api';
```

기업 상세 화면(Screen 3)에서 `co` 변수 교체:

```jsx
// 변경 전
if (screen === "company" && co) {

// 변경 후
function CompanyScreen({ coId, dummyCo }) {
  const { co, loading, fromAPI } = useCompanyWithFallback(coId, dummyCo);

  if (loading) return <LoadingSpinner />;

  // fromAPI === true → 실제 데이터
  // fromAPI === false → 더미 데이터 (API 미연결 종목)
  return <CompanyDetail co={co} isLive={fromAPI} />;
}
```

### 전체 전환

```jsx
// 기존: 더미 데이터 직접 참조
const co = CO[coId];

// 변경: API 훅 사용
const { company: co, loading } = useCompany(coId);
```

---

## 이벤트 가점 등록 방법

이벤트는 자동화가 어렵기 때문에 수동 등록 + 자동 만료 처리합니다.

```bash
# API로 등록 (curl)
curl -X POST "http://localhost:8000/api/events/000660" \
  -d "txt=HBM4 퀄테스트 결과 발표 예정&pts=5&days=30"

# 또는 data/events.json 직접 편집
{
  "000660": [
    { "txt": "HBM4 퀄테스트 결과 발표 예정", "pts": 5, "exp": "2026-07-25" }
  ]
}
```

---

## 파일 구조

```
project/
├── backend.py           ← FastAPI 서버 (데이터 수집 + API)
├── dashboard_api.js     ← React 훅 (API 클라이언트)
├── research_dashboard.jsx  ← 현재 대시보드 (더미 데이터)
├── data/
│   ├── financial_YYYYMMDD.xlsx
│   ├── consensus_YYYYMMDD.xlsx
│   ├── reports_YYYYMMDD.xlsx
│   ├── price_YYYYMMDD.xlsx
│   └── events.json      ← 이벤트 가점 (수동 관리)
└── cache/
    └── score_history.parquet  ← 점수 이력 (cron 적재)
```

---

## 자주 묻는 것들

**Q. DataGuide API vs Excel 어느 게 좋나요?**
DataGuide Pro에 API 모듈이 있으면 API가 낫습니다. 없으면 Excel 내보내기가 더 안정적입니다. `DataGuideParser.parse_financials()`는 Excel 기준으로 작성되어 있습니다.

**Q. KRX API에서 차입비용(대차료율)이 안 나오던데?**
맞습니다. KRX는 대차잔고만 제공하고 차입비용은 증권사 HTS에서만 보입니다. 단기 해결책: 차입비용을 `data/events.json` 처럼 수동 테이블로 관리하거나, 0.5~3.5% 범위를 잔고 비율 기반으로 추정.

**Q. 대시보드를 사내 서버에 띄우려면?**
```bash
# Docker로 패키징
FROM python:3.12
WORKDIR /app
COPY . .
RUN pip install fastapi uvicorn pandas openpyxl httpx beautifulsoup4
CMD ["uvicorn", "backend:app", "--host", "0.0.0.0", "--port", "8000"]
```
React는 `npm run build` 후 FastAPI static files로 서빙 가능.

**Q. 뉴스 크롤링이 막히면?**
네이버 금융은 User-Agent만 맞추면 크롤링 됩니다만, 차단될 경우:
1. 네이버 금융 RSS: `https://finance.naver.com/item/news_news.naver?code={ticker}` RSS 버전 시도
2. BigKinds API (한국언론진흥재단, 무료 신청 가능)
