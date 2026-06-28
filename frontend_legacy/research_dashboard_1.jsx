import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Area, AreaChart, ReferenceLine,
} from "recharts";

// ─────────────────────────────────────────────────────────────
// PSEUDO-RANDOM (seed-based, so data is stable across renders)
// ─────────────────────────────────────────────────────────────
function seedRand(seed) {
  let s = Math.abs((seed || 1) % 2147483647) || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// ─────────────────────────────────────────────────────────────
// DATA GENERATORS
// ─────────────────────────────────────────────────────────────
const M12 = ["25.07","25.08","25.09","25.10","25.11","25.12","26.01","26.02","26.03","26.04","26.05","26.06"];
const M9  = ["25.10","25.11","25.12","26.01","26.02","26.03","26.04","26.05","26.06"];
const QQ  = ["23Q3","23Q4","24Q1","24Q2","24Q3","24Q4","25Q1","25Q2"];

const genFin = (bRev, bOp, sd) => {
  const r = seedRand(sd);
  return QQ.map((q, i) => {
    const rev = Math.round(bRev * (0.76 + i * 0.046 + r() * 0.055));
    const op  = Math.round(bOp  * (0.48 + i * 0.074 + r() * 0.065));
    return { q, rev, op: Math.max(0, op), opm: Math.max(0, Math.round(Math.max(0, op) / rev * 100)) };
  });
};
const genCons = (base, sd) => {
  const r = seedRand(sd);
  let v1 = base * 0.86, v2 = base * 1.03;
  return M12.map(m => {
    v1 = Math.round(v1 * (1 + (r() - 0.38) * 0.025));
    v2 = Math.round(v2 * (1 + (r() - 0.36) * 0.025));
    return { m, fy1: v1, fy2: v2 };
  });
};
const genScore = (base, sd) => {
  const r = seedRand(sd);
  let v = base - 14;
  return M12.map(m => { v = Math.min(97, Math.max(18, v + (r() - 0.4) * 5 + 1.1)); return { m, score: Math.round(v) }; });
};
const genShort = (base, sd) => {
  const r = seedRand(sd);
  let b = Math.round(base * 0.84);
  return M9.map(m => { b = Math.round(b * (1.012 + r() * 0.022)); return { m, bal: b, ratio: parseFloat((b / base * 0.1).toFixed(2)) }; });
};
const genExport = (base, sd) => {
  const r = seedRand(sd);
  return M9.map((m, i) => ({ m, val: Math.round(base * (0.84 + i * 0.022 + r() * 0.075)), yoy: Math.round(-7 + i * 3.4 + r() * 8) }));
};
const genSpread = (sd) => {
  const r = seedRand(sd);
  let v = 0;
  return M9.map(m => { v += (r() - 0.43) * 2.8; return { m, spread: parseFloat(v.toFixed(1)) }; });
};

// ─────────────────────────────────────────────────────────────
// SECTOR + COMPANY DEFINITIONS
// ─────────────────────────────────────────────────────────────
const SECTORS = [
  { id: "semi",    name: "반도체",   color: "#4f8eff", bg: "rgba(79,142,255,.07)",
    cos: [
      { t:"000660", n:"SK하이닉스",      sc:{e:35,d:28,s:22}, ev:[{txt:"HBM3E 퀄테스트 통과 (NVIDIA향)",pts:5},{txt:"AI서버 수요 확대 수혜",pts:5}],  bRev:17200, bOp:3400, mkt:144300, p:198500, pc:2.3,  br:0.8 },
      { t:"058470", n:"리노공업",        sc:{e:30,d:24,s:18}, ev:[{txt:"패키징 업체 퀄테스트 진행 중",pts:5}],                                       bRev:580,   bOp:220,  mkt:4100,   p:182000, pc:-0.8, br:1.2 },
      { t:"319660", n:"피에스케이",      sc:{e:20,d:16,s:12}, ev:[],                                                                                  bRev:1800,  bOp:280,  mkt:8900,   p:52400,  pc:-1.5, br:2.4 },
    ],
  },
  { id: "bat",     name: "2차전지",  color: "#00c87a", bg: "rgba(0,200,122,.07)",
    cos: [
      { t:"373220", n:"LG에너지솔루션", sc:{e:30,d:25,s:20}, ev:[{txt:"GM 합작 신공장 착공 결정",pts:5}],                                            bRev:7800,  bOp:480,  mkt:666000,  p:285000, pc:1.1,  br:0.6 },
      { t:"247540", n:"에코프로비엠",   sc:{e:22,d:18,s:12}, ev:[],                                                                                   bRev:2800,  bOp:180,  mkt:96400,   p:96400,  pc:-2.1, br:3.2 },
      { t:"003670", n:"포스코퓨처엠",   sc:{e:18,d:14,s:10}, ev:[],                                                                                   bRev:1200,  bOp:60,   mkt:175000,  p:148500, pc:-0.4, br:2.8 },
    ],
  },
  { id: "auto",    name: "자동차",   color: "#ffaa00", bg: "rgba(255,170,0,.07)",
    cos: [
      { t:"005380", n:"현대차",         sc:{e:32,d:26,s:20}, ev:[{txt:"제네시스 전기차 북미 점유율 확대",pts:5}],                                     bRev:42000, bOp:3800, mkt:423000,  p:198500, pc:0.7,  br:0.5 },
      { t:"000270", n:"기아",           sc:{e:28,d:22,s:17}, ev:[],                                                                                   bRev:26000, bOp:2600, mkt:357000,  p:88500,  pc:0.2,  br:0.7 },
      { t:"012330", n:"현대모비스",     sc:{e:20,d:16,s:12}, ev:[],                                                                                   bRev:14000, bOp:580,  mkt:186000,  p:196500, pc:-0.5, br:1.8 },
    ],
  },
  { id: "health",  name: "헬스케어", color: "#b07aff", bg: "rgba(176,122,255,.07)",
    cos: [
      { t:"207940", n:"삼성바이오로직스", sc:{e:28,d:22,s:18}, ev:[{txt:"FDA CMO 승인 기대",pts:5},{txt:"글로벌 빅파마 수주 확대",pts:5}],           bRev:1200,  bOp:480,  mkt:617000,  p:872000, pc:1.8,  br:0.6 },
      { t:"128940", n:"한미약품",         sc:{e:22,d:16,s:14}, ev:[{txt:"GLP-1 글로벌 파트너십 기대",pts:5}],                                        bRev:420,   bOp:65,   mkt:33200,   p:298000, pc:0.8,  br:2.1 },
      { t:"000100", n:"유한양행",         sc:{e:18,d:12,s:10}, ev:[],                                                                                 bRev:580,   bOp:42,   mkt:83200,   p:118500, pc:-1.2, br:1.4 },
    ],
  },
  { id: "def",     name: "방산",     color: "#ff6b3d", bg: "rgba(255,107,61,.07)",
    cos: [
      { t:"012450", n:"한화에어로스페이스", sc:{e:33,d:26,s:22}, ev:[{txt:"폴란드 K9 2차 수주 확정 임박",pts:5},{txt:"호주 IFV 수출 협상 진행",pts:5}], bRev:2800,bOp:380,mkt:114000,p:872000,pc:3.2,br:0.5 },
      { t:"064350", n:"현대로템",           sc:{e:26,d:20,s:15}, ev:[{txt:"폴란드 K2 3차 논의 시작",pts:5}],                                          bRev:1200, bOp:120, mkt:43400,  p:72400, pc:1.1, br:1.1 },
      { t:"079550", n:"LIG넥스원",         sc:{e:22,d:16,s:12}, ev:[],                                                                                bRev:980,  bOp:85,  mkt:43700,  p:182000,pc:-0.2,br:1.9 },
    ],
  },
  { id: "ship",    name: "조선",     color: "#00d4c8", bg: "rgba(0,212,200,.07)",
    cos: [
      { t:"329180", n:"HD현대중공업", sc:{e:30,d:24,s:18}, ev:[{txt:"LNG선 신규 수주 잇따라",pts:5}],                                                 bRev:5200, bOp:280, mkt:115000,p:248000,pc:2.8,br:0.9 },
      { t:"010140", n:"삼성중공업",   sc:{e:24,d:18,s:14}, ev:[],                                                                                     bRev:2800, bOp:95,  mkt:61100, p:11850, pc:0.4, br:1.7 },
      { t:"042660", n:"한화오션",     sc:{e:20,d:14,s:12}, ev:[],                                                                                     bRev:2200, bOp:48,  mkt:78600, p:28600, pc:-0.7,br:2.6 },
    ],
  },
];

const NEWS = {
  "000660":[{t:"SK하이닉스, HBM3E 엔비디아 공급 월 100만개 돌파",d:"06.25"},{t:"[단독] 청주 M15X 증설 투자 내년 착공 확정",d:"06.23"},{t:"메모리 업황 본격 회복…SK하이닉스 최선호",d:"06.20"},{t:"외국인 20거래일 연속 순매수, 수급 안정세",d:"06.18"}],
  "058470":[{t:"리노공업 DDR5 소켓 ASP 인상 확인…목표주가 상향",d:"06.22"},{t:"HBM 전환 수혜 2Q26 사상 최대 실적 전망",d:"06.18"}],
  "319660":[{t:"피에스케이, 고객사 투자 지연…4Q26 실적 하회 우려",d:"06.20"}],
  "373220":[{t:"LGES, GM 합작 배터리 공장 연내 착공 확정",d:"06.24"},{t:"원통형 배터리 출하 회복…전기차 수요 정상화",d:"06.18"}],
  "247540":[{t:"에코프로비엠, NCA 가격 하락…마진 압박 지속",d:"06.21"}],
  "003670":[{t:"포스코퓨처엠, 중국 흑연 경쟁 심화…점유율 방어 과제",d:"06.19"}],
  "005380":[{t:"현대차 2Q26 글로벌 판매 역대 최대…美 +12%",d:"06.24"},{t:"제네시스 북미 점유율 2%대 진입 성공",d:"06.20"}],
  "000270":[{t:"기아 EV6 유럽 판매 회복…전기차 흑자 전환 임박",d:"06.22"}],
  "012330":[{t:"현대모비스, 전동화 부품 증가에도 수익성 둔화",d:"06.18"}],
  "207940":[{t:"삼성바이오, 로슈와 추가 CMO 계약 체결",d:"06.23"},{t:"5공장 가동률 80% 돌파…풀가동 앞당겨져",d:"06.19"}],
  "128940":[{t:"한미약품 GLP-1 글로벌 기술수출 계약 임박설",d:"06.22"}],
  "000100":[{t:"유한양행, 주력 품목 특허 만료 영향 본격화",d:"06.17"}],
  "012450":[{t:"한화에어로, 폴란드 K9 2차 계약 9월 체결 유력",d:"06.25"},{t:"K-방산 수출 1H26 역대 최대…최선호주",d:"06.22"}],
  "064350":[{t:"현대로템 K2 폴란드 3차 협상 본격화",d:"06.21"}],
  "079550":[{t:"LIG넥스원, 수출 확대 노력에도 대형 계약 부재",d:"06.16"}],
  "329180":[{t:"HD현대중공업 LNG선 6척 추가 수주…수주잔고 최대",d:"06.24"},{t:"조선업 슈퍼사이클 재진입 확인",d:"06.20"}],
  "010140":[{t:"삼성중공업, 드릴십 수주 재개…해양 플랫폼 회복",d:"06.19"}],
  "042660":[{t:"한화오션, 후판 가격 상승…3Q26 수익성 하방 압력",d:"06.17"}],
};

const RPT = {
  "000660":{an:"이민준 (NH투자)",    d:"2026.06.10", tp:260000,  r:"BUY",  s:"HBM3E 출하 가속화 및 레거시 D램 반등으로 2H26 분기 영업이익 10조 이상 전망."},
  "058470":{an:"박정훈 (한화투자)",  d:"2026.06.05", tp:230000,  r:"BUY",  s:"DDR5·HBM 전환 ASP 구조 개선 지속. 3Q26 영업이익 사상 최대 전망."},
  "319660":{an:"김태영 (키움)",      d:"2026.05.28", tp:58000,   r:"HOLD", s:"고객사 투자 지연 수주 공백. 단기 실적 불확실성 확대."},
  "373220":{an:"최현수 (삼성증권)",  d:"2026.06.12", tp:370000,  r:"BUY",  s:"북미 IRA 보조금 수혜 유지. GM 합작 가동으로 하반기 실적 개선."},
  "247540":{an:"이수진 (KB증권)",    d:"2026.05.30", tp:110000,  r:"HOLD", s:"니켈 가격 하락으로 수익성 약화. 재고 조정 지속."},
  "003670":{an:"장민호 (대신증권)",  d:"2026.05.25", tp:170000,  r:"HOLD", s:"양·음극재 마진 동반 압박. 실적 회복 시점 2H26 이후."},
  "005380":{an:"오형근 (미래에셋)",  d:"2026.06.08", tp:260000,  r:"BUY",  s:"프리미엄 믹스 개선·북미 수요 견조. FY26 영업이익 신기록 전망."},
  "000270":{an:"정재민 (신한투자)",  d:"2026.06.03", tp:115000,  r:"BUY",  s:"RV 믹스 개선 및 EV 원가 절감으로 수익성 개선 추세 유효."},
  "012330":{an:"강민구 (하나증권)",  d:"2026.05.28", tp:220000,  r:"HOLD", s:"완성차 생산 증가에도 모듈 마진 압박 지속."},
  "207940":{an:"김혜진 (메리츠)",    d:"2026.06.11", tp:1100000, r:"BUY",  s:"CMO 수주잔고 역대 최대. 5공장 가동으로 FY26 매출 20% 성장."},
  "128940":{an:"박소현 (IBK투자)",   d:"2026.06.02", tp:370000,  r:"BUY",  s:"GLP-1 비만치료제 파이프라인 가치 재평가 구간 진입."},
  "000100":{an:"이정훈 (유안타)",    d:"2026.05.22", tp:130000,  r:"HOLD", s:"주력 품목 특허 만료 영향 본격화. 신약 출시 시기 불확실."},
  "012450":{an:"임도현 (DB금융)",    d:"2026.06.14", tp:1100000, r:"BUY",  s:"방산 수출 사이클 정점 미도달. 폴란드·호주 수주로 가시성 극대화."},
  "064350":{an:"강태호 (삼성증권)",  d:"2026.06.06", tp:95000,   r:"BUY",  s:"철도+방산 이중 성장. K2 추가 수주로 중장기 실적 기반 강화."},
  "079550":{an:"정두현 (키움)",      d:"2026.05.29", tp:210000,  r:"HOLD", s:"수출 확대 노력에도 대형 계약 부재로 실적 모멘텀 약화."},
  "329180":{an:"윤혁진 (유진투자)",  d:"2026.06.09", tp:320000,  r:"BUY",  s:"LNG·컨테이너선 수주 호조. 후판 안정화로 수익성 개선 가속."},
  "010140":{an:"이선화 (NH투자)",    d:"2026.06.04", tp:14500,   r:"HOLD", s:"해양 플랫폼 수주 회복. LNG선 경쟁 심화 부담."},
  "042660":{an:"박기현 (교보증권)",  d:"2026.05.26", tp:33000,   r:"HOLD", s:"구조조정 마무리에도 수익성 본격 회복까지 시간 필요."},
};

const PAIR_MAP = {
  "000660":["058470","319660"],"058470":["319660","000660"],"319660":["058470","000660"],
  "373220":["247540","003670"],"247540":["003670","373220"],"003670":["247540","373220"],
  "005380":["000270","012330"],"000270":["012330","005380"],"012330":["000270","005380"],
  "207940":["128940","000100"],"128940":["000100","207940"],"000100":["128940","207940"],
  "012450":["064350","079550"],"064350":["079550","012450"],"079550":["064350","012450"],
  "329180":["010140","042660"],"010140":["042660","329180"],"042660":["010140","329180"],
};

// ─────────────────────────────────────────────────────────────
// BUILD CO LOOKUP
// ─────────────────────────────────────────────────────────────
const CO = {};
SECTORS.forEach(sec => {
  sec.cos.forEach(c => {
    const sd = parseInt(c.t) % 100000;
    CO[c.t] = {
      ...c,
      secId: sec.id, secName: sec.name, secColor: sec.color,
      total: c.sc.e + c.sc.d + c.sc.s,
      bonus: c.ev.reduce((s, e) => s + e.pts, 0),
      fin:   genFin(c.bRev, c.bOp, sd),
      cons:  genCons(c.bOp * 3.8, sd + 50),
      hist:  genScore(c.sc.e + c.sc.d + c.sc.s, sd + 100),
      sb:    genShort(c.mkt * 0.055, sd + 200),
      exp:   genExport(c.bRev * 0.13, sd + 300),
      news:  NEWS[c.t] || [],
      rpt:   RPT[c.t] || null,
    };
  });
});

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const T = {
  bg: "#08090f", card: "#0f1220", cardHov: "#141728",
  border: "#1c2038", borderMid: "#252945",
  t1: "#dde3f8", t2: "#546080", t3: "#343d5a",
  green: "#00c87a", red: "#ff4060", amber: "#ffaa00",
};

const fmt = n => n != null ? Number(n).toLocaleString() : "—";

// ─────────────────────────────────────────────────────────────
// MINI COMPONENTS
// ─────────────────────────────────────────────────────────────

function ScoreTag({ co, large }) {
  return (
    <div style={{ display:"flex", alignItems:"baseline", gap:5 }}>
      <span style={{ fontSize: large?38:22, fontWeight:800, color:T.t1, fontVariantNumeric:"tabular-nums", lineHeight:1 }}>
        {co.total}
      </span>
      {co.bonus > 0 && (
        <span style={{ fontSize: large?16:12, fontWeight:700, color:T.amber, background:"rgba(255,170,0,.13)", padding:"2px 8px", borderRadius:6 }}>
          +{co.bonus}
        </span>
      )}
    </div>
  );
}

function MiniBar({ label, val, max, color }) {
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:T.t2, marginBottom:3 }}>
        <span>{label}</span>
        <span style={{ color:T.t1 }}>{val}<span style={{ color:T.t3 }}>/{max}</span></span>
      </div>
      <div style={{ height:3, background:T.border, borderRadius:2, overflow:"hidden" }}>
        <div style={{ width:`${val/max*100}%`, height:"100%", background:color, borderRadius:2 }} />
      </div>
    </div>
  );
}

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#1a1f35", border:`1px solid ${T.borderMid}`, borderRadius:8, padding:"8px 12px", fontSize:11 }}>
      <div style={{ color:T.t2, marginBottom:4 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color || T.t1, fontWeight:600 }}>
          {p.name}: {typeof p.value==="number" && Math.abs(p.value) > 999 ? fmt(p.value) : p.value}
        </div>
      ))}
    </div>
  );
}

function ChangeTag({ v }) {
  const pos = v >= 0;
  return <span style={{ color: pos ? T.green : T.red, fontWeight:600, fontSize:12 }}>{pos?"▲":"▼"} {Math.abs(v)}%</span>;
}

function RatingBadge({ r }) {
  const map = { BUY:{ bg:"rgba(0,200,122,.15)", c:"#00c87a" }, HOLD:{ bg:"rgba(255,170,0,.15)", c:"#ffaa00" }, SELL:{ bg:"rgba(255,64,96,.15)", c:"#ff4060" } };
  const s = map[r] || map.HOLD;
  return <span style={{ background:s.bg, color:s.c, padding:"2px 8px", borderRadius:4, fontSize:11, fontWeight:700 }}>{r}</span>;
}

function Card({ children, style = {} }) {
  return <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:18, ...style }}>{children}</div>;
}

function SectionTitle({ children }) {
  return <div style={{ fontSize:13, fontWeight:700, color:T.t1, marginBottom:14 }}>{children}</div>;
}

// ─────────────────────────────────────────────────────────────
// CHART WRAPPERS
// ─────────────────────────────────────────────────────────────

function FinChart({ co }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={co.fin} margin={{ top:4, right:8, bottom:0, left:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
        <XAxis dataKey="q" tick={{ fill:T.t2, fontSize:9 }} />
        <YAxis yAxisId="l" tick={{ fill:T.t2, fontSize:9 }} tickFormatter={v => v >= 10000 ? `${Math.round(v/1000)}k` : v} />
        <YAxis yAxisId="r" orientation="right" unit="%" tick={{ fill:T.t2, fontSize:9 }} domain={[0,"auto"]} />
        <Tooltip content={<Tip />} />
        <Bar yAxisId="l" dataKey="rev" name="매출(억)" fill={T.borderMid} radius={[3,3,0,0]} />
        <Bar yAxisId="l" dataKey="op"  name="영업이익(억)" fill={co.secColor} radius={[3,3,0,0]} />
        <Line yAxisId="r" type="monotone" dataKey="opm" name="OPM" stroke={T.amber} strokeWidth={2} dot={false} unit="%" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ConsChart({ co }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={co.cons} margin={{ top:4, right:8, bottom:0, left:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
        <XAxis dataKey="m" tick={{ fill:T.t2, fontSize:9 }} />
        <YAxis tick={{ fill:T.t2, fontSize:9 }} tickFormatter={v => v >= 10000 ? `${Math.round(v/1000)}k` : v} />
        <Tooltip content={<Tip />} />
        <Line type="monotone" dataKey="fy1" name="FY1 추정(억)" stroke={co.secColor} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="fy2" name="FY2 추정(억)" stroke={T.amber} strokeWidth={2} dot={false} strokeDasharray="5 4" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ScoreChart({ co }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={co.hist} margin={{ top:4, right:8, bottom:0, left:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
        <XAxis dataKey="m" tick={{ fill:T.t2, fontSize:9 }} />
        <YAxis domain={[0,100]} tick={{ fill:T.t2, fontSize:9 }} />
        <Tooltip content={<Tip />} />
        <Line type="monotone" dataKey="score" name="점수" stroke={co.secColor} strokeWidth={2.5} dot={{ r:3, fill:co.secColor }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ExpChart({ co }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={co.exp} margin={{ top:4, right:8, bottom:0, left:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
        <XAxis dataKey="m" tick={{ fill:T.t2, fontSize:9 }} />
        <YAxis yAxisId="l" tick={{ fill:T.t2, fontSize:9 }} />
        <YAxis yAxisId="r" orientation="right" unit="%" tick={{ fill:T.t2, fontSize:9 }} />
        <Tooltip content={<Tip />} />
        <Bar yAxisId="l" dataKey="val" name="수출액(백만$)" fill={`${co.secColor}50`} radius={[3,3,0,0]} />
        <Line yAxisId="r" type="monotone" dataKey="yoy" name="YoY" stroke={co.secColor} strokeWidth={2} dot={false} unit="%" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function SbChart({ co }) {
  return (
    <ResponsiveContainer width="100%" height={130}>
      <ComposedChart data={co.sb} margin={{ top:4, right:8, bottom:0, left:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
        <XAxis dataKey="m" tick={{ fill:T.t2, fontSize:9 }} />
        <YAxis tick={{ fill:T.t2, fontSize:9 }} />
        <Tooltip content={<Tip />} />
        <Bar dataKey="bal" name="대차잔고(억)" fill="rgba(255,64,96,.25)" radius={[3,3,0,0]} />
        <Line type="monotone" dataKey="bal" name=" " stroke={T.red} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function SpreadChart({ data, longName, shortName }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top:4, right:8, bottom:0, left:0 }}>
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f8eff" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#4f8eff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
        <XAxis dataKey="m" tick={{ fill:T.t2, fontSize:9 }} />
        <YAxis tick={{ fill:T.t2, fontSize:9 }} unit="%" />
        <Tooltip content={<Tip />} />
        <ReferenceLine y={0} stroke={T.borderMid} strokeDasharray="4 3" />
        <Area type="monotone" dataKey="spread" name="스프레드" stroke="#4f8eff" fill="url(#sg)" strokeWidth={2} unit="%" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [screen, setScreen]   = useState("main");
  const [secId, setSecId]     = useState(null);
  const [coId, setCoId]       = useState(null);
  const [longId, setLongId]   = useState(null);
  const [pairId, setPairId]   = useState(null);
  const [ipMap, setIpMap]     = useState({});
  const [ipLoad, setIpLoad]   = useState({});

  const sec = SECTORS.find(s => s.id === secId);
  const co  = coId ? CO[coId] : null;
  const longCo = longId ? CO[longId] : null;

  // ─ LLM Investment Point Generation ─
  const genIP = async (ticker) => {
    if (ipLoad[ticker]) return;
    const c = CO[ticker];
    setIpLoad(x => ({ ...x, [ticker]: true }));
    try {
      const fin2 = c.fin.slice(-2);
      const con  = c.cons;
      const c1   = con[con.length - 1];
      const c4   = con[con.length - 4] || con[0];
      const dir  = c1?.fy1 > c4?.fy1 ? "상향 조정 중" : "하향 조정 중";
      const ctx  = `기업명: ${c.n} (${ticker})\n섹터: ${c.secName}\n시가총액: ${fmt(c.mkt)}억원\n\n[최근 2분기 실적]\n${fin2.map(f => `${f.q}: 매출 ${fmt(f.rev)}억 / 영업이익 ${fmt(f.op)}억 (OPM ${f.opm}%)`).join("\n")}\n\n[컨센서스]\nFY1 영업이익 추정 ${dir}\n3개월 전: ${fmt(c4?.fy1)}억 → 현재: ${fmt(c1?.fy1)}억\n\n[이벤트]\n${c.ev.length ? c.ev.map(e => `- ${e.txt}`).join("\n") : "없음"}\n\n[점수 구성]\n실적 ${c.sc.e}/40 | 데이터 ${c.sc.d}/35 | 수급 ${c.sc.s}/25`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 800,
          messages: [{
            role: "user",
            content: `당신은 한국 주식 리서치 애널리스트입니다. 아래 데이터만 근거로 투자 포인트 3가지를 JSON으로만 출력하세요. 데이터 외 내용 금지. 형식(마크다운 없이 순수 JSON): {"points":[{"title":"...","body":"..."},{"title":"...","body":"..."},{"title":"...","body":"..."}]}\n\n${ctx}`
          }]
        }),
      });
      const data  = await res.json();
      const text  = data.content?.[0]?.text || "{}";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setIpMap(x => ({ ...x, [ticker]: parsed.points || [] }));
    } catch {
      setIpMap(x => ({ ...x, [ticker]: [{ title: "생성 실패", body: "데이터 처리 중 오류가 발생했습니다." }] }));
    } finally {
      setIpLoad(x => ({ ...x, [ticker]: false }));
    }
  };

  // ─ Navigation ─
  const goMain    = () => { setScreen("main"); setSecId(null); setCoId(null); };
  const goSector  = (id) => { setSecId(id); setScreen("sector"); };
  const goCompany = (id) => { setCoId(id); setScreen("company"); };
  const goLS      = (id) => { setLongId(id); setPairId(null); setScreen("ls"); };

  // ─ Pair computation ─
  const getPairs = (lt) => {
    if (!lt) return [];
    return (PAIR_MAP[lt] || []).map(pt => {
      const pc = CO[pt]; if (!pc) return null;
      const r = seedRand(parseInt(pt) % 1000 + parseInt(lt) % 1000 + 7);
      const cor = Math.round(62 + r() * 33);
      const ind = Math.round(75 + r() * 25);
      const prd = Math.round(55 + r() * 40);
      const rev = Math.round(48 + r() * 47);
      const tot = Math.round(cor * 0.3 + ind * 0.25 + prd * 0.25 + rev * 0.2);
      return { t: pt, co: pc, cor, ind, prd, rev, tot, spread: genSpread(parseInt(pt) % 500 + parseInt(lt) % 500 + 3) };
    }).filter(Boolean).sort((a, b) => b.tot - a.tot);
  };
  const pairs   = getPairs(longId);
  const selPair = pairId ? pairs.find(p => p.t === pairId) : null;

  // ─────────────────────────────────────────────────────────────
  // SCREEN 1 — MAIN
  // ─────────────────────────────────────────────────────────────
  if (screen === "main") return (
    <div style={{ background:T.bg, minHeight:"100vh", padding:24, fontFamily:"-apple-system,'Segoe UI',sans-serif", color:T.t1 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <div>
          <div style={{ fontSize:10, color:T.t2, letterSpacing:2.5, marginBottom:6 }}>EQUITY RESEARCH · 섹터 점수 랭킹</div>
          <div style={{ fontSize:26, fontWeight:800, letterSpacing:-0.5 }}>대시보드</div>
        </div>
        <div style={{ fontSize:12, color:T.t2 }}>2026.06.26 기준</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
        {SECTORS.map(s => {
          const cos = s.cos.map(c => CO[c.t]).sort((a,b) => b.total - a.total);
          const avg = Math.round(cos.reduce((sum, c) => sum + c.total, 0) / cos.length);
          return (
            <div key={s.id} onClick={() => goSector(s.id)}
              style={{ background:T.card, border:`1px solid ${T.border}`, borderTop:`2px solid ${s.color}`, borderRadius:14, padding:18, cursor:"pointer", transition:"border-color .2s, background .2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = T.cardHov; e.currentTarget.style.borderColor = s.color; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.card; e.currentTarget.style.borderColor = T.border; e.currentTarget.style.borderTopColor = s.color; }}>

              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div style={{ fontSize:16, fontWeight:700, color:s.color }}>{s.name}</div>
                <div style={{ fontSize:10, color:T.t2, background:T.border, padding:"3px 9px", borderRadius:20 }}>평균 {avg}점</div>
              </div>

              {cos.map((c, i) => (
                <div key={c.t} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom: i < cos.length-1 ? `1px solid ${T.border}` : "none" }}>
                  <div style={{ fontSize:11, color:T.t3, fontWeight:700, width:14, flexShrink:0 }}>{i+1}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.n}</div>
                    <ChangeTag v={c.pc} />
                  </div>
                  <ScoreTag co={c} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // SCREEN 2 — SECTOR DETAIL
  // ─────────────────────────────────────────────────────────────
  if (screen === "sector" && sec) {
    const cos = sec.cos.map(c => CO[c.t]).sort((a,b) => (b.total+b.bonus) - (a.total+a.bonus));
    return (
      <div style={{ background:T.bg, minHeight:"100vh", padding:24, fontFamily:"-apple-system,'Segoe UI',sans-serif", color:T.t1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
          <button onClick={goMain} style={{ background:"none", border:`1px solid ${T.border}`, color:T.t2, padding:"6px 14px", borderRadius:8, cursor:"pointer", fontSize:12 }}>← 전체</button>
          <span style={{ color:T.t3 }}>/</span>
          <span style={{ fontSize:20, fontWeight:800, color:sec.color }}>{sec.name}</span>
          <span style={{ fontSize:12, color:T.t2, marginLeft:"auto" }}>총 {cos.length}개 종목</span>
        </div>

        <Card style={{ padding:0, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"44px 1fr 200px 160px 120px", padding:"10px 20px", borderBottom:`1px solid ${T.border}`, fontSize:11, color:T.t2 }}>
            <div>#</div><div>종목</div><div>점수 구성</div><div>종합점수</div><div>주가</div>
          </div>
          {cos.map((c, i) => (
            <div key={c.t} onClick={() => goCompany(c.t)}
              style={{ display:"grid", gridTemplateColumns:"44px 1fr 200px 160px 120px", padding:"16px 20px", borderBottom: i < cos.length-1 ? `1px solid ${T.border}` : "none", cursor:"pointer", transition:"background .15s" }}
              onMouseEnter={e => e.currentTarget.style.background = T.cardHov}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

              <div style={{ fontSize:15, fontWeight:800, color:T.t3, alignSelf:"center" }}>{i+1}</div>

              <div style={{ alignSelf:"center" }}>
                <div style={{ fontSize:15, fontWeight:700 }}>{c.n}</div>
                <div style={{ fontSize:11, color:T.t2, marginTop:2 }}>{c.t} · 시총 {fmt(c.mkt)}억</div>
              </div>

              <div style={{ alignSelf:"center", paddingRight:16 }}>
                <MiniBar label="실적" val={c.sc.e} max={40} color={sec.color} />
                <MiniBar label="데이터" val={c.sc.d} max={35} color={sec.color} />
                <MiniBar label="수급" val={c.sc.s} max={25} color={sec.color} />
              </div>

              <div style={{ alignSelf:"center" }}>
                <ScoreTag co={c} />
                {c.ev.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
                    {c.ev.map((e, j) => (
                      <span key={j} style={{ fontSize:10, color:T.amber, background:"rgba(255,170,0,.1)", padding:"2px 7px", borderRadius:4 }}>
                        +{e.pts} {e.txt.length > 14 ? e.txt.slice(0,14)+"…" : e.txt}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ alignSelf:"center" }}>
                <div style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>{fmt(c.p)}원</div>
                <ChangeTag v={c.pc} />
              </div>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // SCREEN 3 — COMPANY DETAIL
  // ─────────────────────────────────────────────────────────────
  if (screen === "company" && co) {
    const sb = co.sb;
    const sbLast = sb[sb.length-1];
    const sbM1   = sb[sb.length-5] || sb[0];
    const sbChg  = parseFloat(((sbLast.bal - sbM1.bal) / sbM1.bal * 100).toFixed(1));
    const ip  = ipMap[co.t];
    const rpt = co.rpt;

    return (
      <div style={{ background:T.bg, minHeight:"100vh", padding:24, fontFamily:"-apple-system,'Segoe UI',sans-serif", color:T.t1 }}>
        {/* Top nav */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
          <button onClick={() => goSector(co.secId)} style={{ background:"none", border:`1px solid ${T.border}`, color:T.t2, padding:"6px 14px", borderRadius:8, cursor:"pointer", fontSize:12 }}>← {co.secName}</button>
          <button onClick={() => goLS(co.t)} style={{ marginLeft:"auto", background:co.secColor, color:"#fff", border:"none", padding:"7px 18px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:700 }}>
            롱숏 페어 찾기 →
          </button>
        </div>

        {/* Header card */}
        <Card style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:24, marginBottom:14, borderTop:`3px solid ${co.secColor}` }}>
          <div>
            <div style={{ fontSize:24, fontWeight:800, marginBottom:4 }}>{co.n}</div>
            <div style={{ display:"flex", gap:14, fontSize:12, color:T.t2 }}>
              <span>{co.t}</span>
              <span style={{ color:co.secColor }}>{co.secName}</span>
              <span>시총 {fmt(co.mkt)}억</span>
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:22, fontWeight:800 }}>{fmt(co.p)}원</div>
            <ChangeTag v={co.pc} />
          </div>
          <div style={{ borderLeft:`1px solid ${T.border}`, paddingLeft:24 }}>
            <div style={{ fontSize:10, color:T.t2, marginBottom:8 }}>종합점수 (기준일 기준)</div>
            <ScoreTag co={co} large />
            <div style={{ fontSize:10, color:T.t2, marginTop:6 }}>
              실적{co.sc.e} · 데이터{co.sc.d} · 수급{co.sc.s}
            </div>
          </div>
        </Card>

        {/* Row 1 */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>

          {/* Investment Points */}
          <Card>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <SectionTitle children="투자 포인트" />
              <button onClick={() => genIP(co.t)} disabled={ipLoad[co.t]}
                style={{ background: ipLoad[co.t] ? T.border : co.secColor, color: ipLoad[co.t] ? T.t2 : "#fff",
                          border:"none", padding:"5px 13px", borderRadius:7, cursor: ipLoad[co.t] ? "default" : "pointer",
                          fontSize:11, fontWeight:700 }}>
                {ipLoad[co.t] ? "⏳ 생성 중..." : ip ? "🔄 재생성" : "✨ LLM 생성"}
              </button>
            </div>
            {!ip && !ipLoad[co.t] && (
              <div style={{ color:T.t2, fontSize:12, textAlign:"center", padding:"30px 0", lineHeight:1.7 }}>
                LLM 생성 버튼을 클릭하면<br/>실적·컨센서스·이벤트 데이터를 기반으로<br/>투자 포인트를 자동 생성합니다
              </div>
            )}
            {ip && ip.map((pt, i) => (
              <div key={i} style={{ marginBottom: i < ip.length-1 ? 12 : 0, paddingBottom: i < ip.length-1 ? 12 : 0, borderBottom: i < ip.length-1 ? `1px solid ${T.border}` : "none" }}>
                <div style={{ fontSize:12, fontWeight:700, color:co.secColor, marginBottom:5 }}>{i+1}. {pt.title}</div>
                <div style={{ fontSize:11, color:T.t2, lineHeight:1.65 }}>{pt.body || pt.content}</div>
              </div>
            ))}
          </Card>

          {/* Latest Report + Score Breakdown */}
          <Card>
            <SectionTitle>최신 리포트 컨센서스</SectionTitle>
            {rpt ? (
              <>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600 }}>{rpt.an}</div>
                    <div style={{ fontSize:11, color:T.t2, marginTop:2 }}>{rpt.d}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <RatingBadge r={rpt.r} />
                    <div style={{ fontSize:15, fontWeight:800, marginTop:5 }}>TP {fmt(rpt.tp)}원</div>
                  </div>
                </div>
                <div style={{ fontSize:12, color:T.t2, lineHeight:1.65, borderTop:`1px solid ${T.border}`, paddingTop:12 }}>
                  {rpt.s}
                </div>
              </>
            ) : <div style={{ color:T.t2, fontSize:12 }}>리포트 없음</div>}

            <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${T.border}` }}>
              <div style={{ fontSize:10, color:T.t2, marginBottom:10 }}>점수 구성 상세</div>
              <MiniBar label="실적 (max 40)" val={co.sc.e} max={40} color={co.secColor} />
              <MiniBar label="데이터 (max 35)" val={co.sc.d} max={35} color={co.secColor} />
              <MiniBar label="수급 (max 25)" val={co.sc.s} max={25} color={co.secColor} />
              {co.ev.length > 0 && (
                <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:5 }}>
                  {co.ev.map((e, i) => (
                    <div key={i} style={{ fontSize:11, color:T.amber, background:"rgba(255,170,0,.1)", padding:"5px 10px", borderRadius:7 }}>
                      +{e.pts}pt · {e.txt}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Row 2 — Financials + Consensus */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
          <Card>
            <SectionTitle>분기 실적 추이 (억원)</SectionTitle>
            <FinChart co={co} />
          </Card>
          <Card>
            <SectionTitle>컨센서스 추이 — FY1/FY2 영업이익 추정 (억원)</SectionTitle>
            <ConsChart co={co} />
          </Card>
        </div>

        {/* Row 3 — Score history + Export */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
          <Card>
            <SectionTitle>점수 1년 추이</SectionTitle>
            <ScoreChart co={co} />
          </Card>
          <Card>
            <SectionTitle>관련 수출 데이터 (백만달러 · YoY%)</SectionTitle>
            <ExpChart co={co} />
          </Card>
        </div>

        {/* Row 4 — Short balance + News */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <Card>
            <SectionTitle>대차잔고</SectionTitle>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
              {[
                { label:"잔고",         val:`${fmt(sbLast.bal)}억`,                          warn:false },
                { label:"1개월 증감율", val:`${sbChg > 0 ? "+" : ""}${sbChg}%`,             warn: sbChg > 10 },
                { label:"잔고/시총",    val:`${sbLast.ratio}%`,                              warn: sbLast.ratio > 2 },
              ].map((item, i) => (
                <div key={i} style={{ background:T.bg, borderRadius:9, padding:"10px 12px", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:T.t2, marginBottom:5 }}>{item.label}</div>
                  <div style={{ fontSize:15, fontWeight:700, color: item.warn ? T.red : T.t1 }}>{item.val}</div>
                </div>
              ))}
            </div>
            <SbChart co={co} />
            {sbChg > 15 && (
              <div style={{ marginTop:10, fontSize:11, color:T.red, background:"rgba(255,64,96,.08)", padding:"8px 12px", borderRadius:7 }}>
                ⚠ 대차잔고가 1개월 전 대비 {sbChg}% 급증 — 숏 스퀴즈 리스크 주의
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>관련 뉴스</SectionTitle>
            {co.news.map((item, i) => (
              <div key={i} style={{ display:"flex", gap:12, padding:"10px 0", borderBottom: i < co.news.length-1 ? `1px solid ${T.border}` : "none" }}>
                <div style={{ fontSize:11, color:T.t2, whiteSpace:"nowrap", marginTop:2 }}>{item.d}</div>
                <div style={{ fontSize:12, color:T.t1, lineHeight:1.55 }}>{item.t}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // SCREEN 4 — LONG-SHORT PAIR FINDER
  // ─────────────────────────────────────────────────────────────
  if (screen === "ls") {
    return (
      <div style={{ background:T.bg, minHeight:"100vh", padding:24, fontFamily:"-apple-system,'Segoe UI',sans-serif", color:T.t1 }}>
        {/* Nav */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
          {coId && (
            <button onClick={() => setScreen("company")} style={{ background:"none", border:`1px solid ${T.border}`, color:T.t2, padding:"6px 14px", borderRadius:8, cursor:"pointer", fontSize:12 }}>
              ← {co?.n}
            </button>
          )}
          <span style={{ fontSize:20, fontWeight:800 }}>롱숏 페어 파인더</span>
        </div>

        {/* Long selector */}
        <Card style={{ marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>롱 포지션 선택</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {SECTORS.map(s => s.cos.map(cd => {
              const sel = longId === cd.t;
              return (
                <button key={cd.t} onClick={() => { setLongId(cd.t); setPairId(null); }}
                  style={{ background: sel ? s.color : T.border, color: sel ? "#fff" : T.t2, border:"none",
                            padding:"6px 14px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight: sel ? 700 : 400, transition:"all .15s" }}>
                  {CO[cd.t].n}
                </button>
              );
            }))}
          </div>
        </Card>

        {longCo && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
              {/* Long summary */}
              <Card style={{ borderTop:`2px solid ${longCo.secColor}` }}>
                <div style={{ fontSize:10, color:longCo.secColor, letterSpacing:2, marginBottom:8 }}>LONG</div>
                <div style={{ fontSize:20, fontWeight:800, marginBottom:4 }}>{longCo.n}</div>
                <div style={{ fontSize:12, color:T.t2, marginBottom:16 }}>{longCo.secName} · {longCo.t}</div>
                <div style={{ display:"flex", gap:24 }}>
                  <div><div style={{ fontSize:10, color:T.t2, marginBottom:4 }}>현재가</div><div style={{ fontSize:14, fontWeight:600 }}>{fmt(longCo.p)}원</div></div>
                  <div><div style={{ fontSize:10, color:T.t2, marginBottom:4 }}>종합점수</div><ScoreTag co={longCo} /></div>
                  <div><div style={{ fontSize:10, color:T.t2, marginBottom:4 }}>차입비용(연)</div><div style={{ fontSize:14, fontWeight:600, color:longCo.br < 1 ? T.green : T.t1 }}>{longCo.br}%</div></div>
                </div>
              </Card>

              {/* Pair candidates */}
              <Card>
                <SectionTitle>숏 페어 후보 (점수 순)</SectionTitle>
                {pairs.map((pair, i) => (
                  <div key={pair.t} onClick={() => setPairId(pairId === pair.t ? null : pair.t)}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 0",
                              borderBottom: i < pairs.length-1 ? `1px solid ${T.border}` : "none",
                              cursor:"pointer", opacity: selPair && selPair.t !== pair.t ? 0.45 : 1, transition:"opacity .2s" }}>
                    <div style={{ fontSize:15, fontWeight:800, color:T.red, width:22 }}>{i+1}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:600 }}>{pair.co.n}</div>
                      <div style={{ fontSize:11, color:T.t2 }}>종목점수 {pair.co.total} · 차입 {pair.co.br}%</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:18, fontWeight:800, color:T.red }}>{pair.tot}<span style={{ fontSize:11, color:T.t2, fontWeight:400 }}>점</span></div>
                      <div style={{ fontSize:10, color:T.t2 }}>페어 점수</div>
                    </div>
                    <div style={{ fontSize:16, color:T.t3 }}>{selPair?.t === pair.t ? "▼" : "▶"}</div>
                  </div>
                ))}
              </Card>
            </div>

            {/* Pair detail */}
            {selPair && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                {/* Factor breakdown */}
                <Card>
                  <SectionTitle>페어 요인 분석 — {longCo.n} (Long) × {selPair.co.n} (Short)</SectionTitle>
                  {[
                    { label:"주가 상관관계", val:selPair.cor, color:"#4f8eff" },
                    { label:"동일 업종",     val:selPair.ind, color:"#00c87a" },
                    { label:"유사 제품군",   val:selPair.prd, color:"#ffaa00" },
                    { label:"매출 역방향성", val:selPair.rev, color:"#ff6b3d" },
                  ].map(item => (
                    <div key={item.label} style={{ marginBottom:14 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
                        <span style={{ color:T.t2 }}>{item.label}</span>
                        <span style={{ fontWeight:700, color:item.color }}>{item.val}점</span>
                      </div>
                      <div style={{ height:6, background:T.border, borderRadius:3, overflow:"hidden" }}>
                        <div style={{ width:`${item.val}%`, height:"100%", background:item.color, borderRadius:3 }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:12, color:T.t2 }}>숏 차입 비용 (연)</span>
                    <span style={{ fontSize:15, fontWeight:700, color: selPair.co.br > 2.5 ? T.red : T.t1 }}>{selPair.co.br}%
                      {selPair.co.br > 2.5 && <span style={{ fontSize:10, color:T.red, marginLeft:6 }}>⚠ 비용 높음</span>}
                    </span>
                  </div>
                </Card>

                {/* Spread chart */}
                <Card>
                  <SectionTitle>페어 스프레드 추이 (누적 상대수익률 %)</SectionTitle>
                  <div style={{ fontSize:11, color:T.t2, marginBottom:14 }}>
                    양수 = {longCo.n} 우위 &nbsp;·&nbsp; 음수 = {selPair.co.n} 우위
                  </div>
                  <SpreadChart data={selPair.spread} longName={longCo.n} shortName={selPair.co.n} />
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:12, fontSize:11 }}>
                    <span style={{ color:T.t2 }}>현재 스프레드</span>
                    <span style={{ fontWeight:700, color: selPair.spread[selPair.spread.length-1]?.spread > 0 ? T.green : T.red }}>
                      {selPair.spread[selPair.spread.length-1]?.spread > 0 ? "+" : ""}{selPair.spread[selPair.spread.length-1]?.spread}%
                    </span>
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return null;
}
