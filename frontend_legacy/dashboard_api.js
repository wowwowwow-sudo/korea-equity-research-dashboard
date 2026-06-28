/**
 * 대시보드 API 클라이언트
 * ──────────────────────────────────────────────────────────────────
 * 더미 데이터 → 실제 API 전환을 위한 유일한 수정 지점.
 * backend.py 서버가 http://localhost:8000 에서 실행 중이어야 합니다.
 *
 * 사용법:
 *   1. 이 파일을 dashboard_api.js 로 저장
 *   2. 대시보드 컴포넌트에서 import { useSectors, useCompany } from './dashboard_api'
 *   3. 더미 CO / SECTORS 객체 대신 이 훅을 사용
 */

import { useState, useEffect, useCallback } from "react";

// ── 기본 설정 ────────────────────────────────────────────────────
const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

// 요청 공통 래퍼 (에러 처리 통일)
async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

// ── 캐시 레이어 (같은 세션 내 중복 요청 방지) ────────────────────
const _cache = {};
async function cachedFetch(path, ttl = 300_000) {
  const now = Date.now();
  if (_cache[path] && now - _cache[path].ts < ttl) {
    return _cache[path].data;
  }
  const data = await apiFetch(path);
  _cache[path] = { data, ts: now };
  return data;
}

// ─────────────────────────────────────────────────────────────────
// 훅 1: 섹터 목록 (메인 화면용)
// ─────────────────────────────────────────────────────────────────
export function useSectors() {
  const [sectors, setSectors] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    cachedFetch("/api/sectors")
      .then(setSectors)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { sectors, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// 훅 2: 기업 상세 데이터 (기업 화면용)
// ─────────────────────────────────────────────────────────────────
export function useCompany(ticker) {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    cachedFetch(`/api/company/${ticker}`, 60_000)  // 1분 캐시
      .then(setCompany)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [ticker]);

  return { company, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// 훅 3: 점수 이력 (기업 상세 차트용)
// ─────────────────────────────────────────────────────────────────
export function useScoreHistory(ticker) {
  const [hist,    setHist]    = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    cachedFetch(`/api/score-history/${ticker}`)
      .then(setHist)
      .catch(() => setHist([]))
      .finally(() => setLoading(false));
  }, [ticker]);

  return { hist, loading };
}

// ─────────────────────────────────────────────────────────────────
// 훅 4: 이벤트 관리 (이벤트 가점 등록/조회)
// ─────────────────────────────────────────────────────────────────
export function useEvents(ticker) {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!ticker) return;
    setLoading(true);
    apiFetch(`/api/events/${ticker}`)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [ticker]);

  useEffect(() => { refresh(); }, [refresh]);

  const addEvent = useCallback(async (txt, pts = 5, days = 45) => {
    const params = new URLSearchParams({ txt, pts, days });
    await fetch(`${BASE_URL}/api/events/${ticker}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    refresh();
  }, [ticker, refresh]);

  return { events, loading, addEvent, refresh };
}


// ─────────────────────────────────────────────────────────────────
// 대시보드 연결 예시 (기존 Dashboard 컴포넌트에서의 사용법)
// ─────────────────────────────────────────────────────────────────
/**
 * [변경 전] 더미 데이터 사용:
 *
 *   const co = CO[coId];
 *   // co.fin, co.cons, co.sb, co.exp, co.news 모두 더미
 *
 * [변경 후] API 사용:
 *
 *   import { useCompany, useEvents } from './dashboard_api';
 *
 *   function CompanyScreen({ coId }) {
 *     const { company: co, loading, error } = useCompany(coId);
 *     const { events, addEvent }            = useEvents(coId);
 *
 *     if (loading) return <Spinner />;
 *     if (error)   return <ErrorMsg msg={error.message} />;
 *     if (!co)     return null;
 *
 *     // co.fin, co.cons, co.sb, co.exp, co.news → 실제 데이터
 *     // co.ev 대신 events 훅 사용
 *     return <CompanyDetail co={{ ...co, ev: events }} />;
 *   }
 */


// ─────────────────────────────────────────────────────────────────
// 점진적 전환 어댑터
// ─────────────────────────────────────────────────────────────────
/**
 * API가 아직 연결 안 된 종목은 더미 데이터로 fallback하는 어댑터.
 * 실제 데이터 연결이 완료된 종목부터 순차 전환 가능.
 *
 * 사용법:
 *   const co = useCompanyWithFallback(ticker, DUMMY_CO[ticker]);
 */
export function useCompanyWithFallback(ticker, dummyFallback) {
  const { company, loading, error } = useCompany(ticker);

  if (loading) return { co: dummyFallback, loading: true, fromAPI: false };
  if (error || !company) return { co: dummyFallback, loading: false, fromAPI: false };

  // API 데이터와 더미 데이터 병합 (API 데이터 우선)
  const merged = {
    ...dummyFallback,    // 더미에만 있는 필드 (예: pairCandidates 등)
    ...company,          // API 데이터로 덮어쓰기
    ev: dummyFallback?.ev ?? [],   // 이벤트는 별도 훅에서 관리
  };

  return { co: merged, loading: false, fromAPI: true };
}


// ─────────────────────────────────────────────────────────────────
// DataGuide Excel 직접 업로드 처리 (백엔드 없이 프론트엔드에서 처리)
// 백엔드 API가 준비되기 전 임시 방편으로 사용 가능
// ─────────────────────────────────────────────────────────────────
/**
 * 사용법:
 *   <input type="file" onChange={(e) => parseExcelFile(e.target.files[0], ticker).then(setCoData)} />
 */
export async function parseExcelFile(file, ticker) {
  // SheetJS (xlsx) 사용
  const { read, utils } = await import("xlsx");

  const buf  = await file.arrayBuffer();
  const wb   = read(buf, { type: "array" });

  const result = {};

  // 분기실적 시트 파싱
  if (wb.SheetNames.includes("분기실적")) {
    const ws   = wb.Sheets["분기실적"];
    const data = utils.sheet_to_json(ws, { defval: null });
    // 파싱 로직은 backend.py DataGuideParser.parse_financials() 참고
    result.fin = data
      .filter(row => String(row["종목코드"] || "").includes(ticker))
      .slice(-8)
      .map(row => ({
        q:   String(row["분기"] || ""),
        rev: Math.round((Number(row["매출액"] || 0)) / 1e8),
        op:  Math.round((Number(row["영업이익"] || 0)) / 1e8),
        opm: Number(row["영업이익률"] || 0),
      }));
  }

  // 컨센서스 시트 파싱
  if (wb.SheetNames.includes("컨센서스")) {
    const ws   = wb.Sheets["컨센서스"];
    const data = utils.sheet_to_json(ws, { defval: null });
    result.cons = data
      .filter(row => String(row["종목코드"] || "").includes(ticker))
      .slice(-12)
      .map(row => ({
        m:   String(row["기준월"] || "").slice(2, 7).replace("-", "."),
        fy1: Math.round(Number(row["FY1_영업이익"] || 0) / 1e8),
        fy2: Math.round(Number(row["FY2_영업이익"] || 0) / 1e8),
      }));
  }

  return result;
}
