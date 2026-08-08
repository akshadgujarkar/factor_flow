import type {
  Alert,
  BlockchainRecord,
  DataSource,
  Explainability,
  FraudType,
  ModelCard,
  Severity,
  TimelineEvent,
  Trade,
} from "@/types/sentinel";

export const COMPANIES: { symbol: string; company: string; sector: string }[] = [
  { symbol: "NVCX", company: "NovaCortex Ltd", sector: "Semiconductors" },
  { symbol: "ABC", company: "ABC Ltd", sector: "Industrials" },
  { symbol: "HELIX", company: "Helix Biosciences", sector: "Pharma" },
  { symbol: "ORBT", company: "Orbital Systems", sector: "Aerospace" },
  { symbol: "VRDN", company: "Veridian Energy", sector: "Energy" },
  { symbol: "TRMX", company: "TerraMax Mining", sector: "Materials" },
  { symbol: "QNTF", company: "Quantfleet Capital", sector: "Financials" },
  { symbol: "SOLR", company: "Solaris Grid", sector: "Utilities" },
];

export const TRADERS = [
  "T102",
  "T118",
  "T203",
  "T244",
  "T307",
  "T391",
  "T410",
  "T455",
  "T502",
  "T577",
];

export const INVESTIGATORS = [
  "A. Raghavan",
  "M. Okafor",
  "L. Bergström",
  "S. Nakamura",
  "Unassigned",
];

export const FRAUD_TYPES: FraudType[] = [
  "Insider Trading",
  "Market Manipulation",
  "Pump and Dump",
  "Wash Trading",
  "Spoofing",
  "Front Running",
];

const FEATURES = [
  "Trade Timing",
  "Large Order Size",
  "Communication Pattern",
  "Previous Behaviour",
  "Price Impact",
  "Counterparty Overlap",
  "Order Cancellation Rate",
  "Pre-Announcement Window",
];

/** Deterministic PRNG so SSR and the first client render agree. */
export function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const pick = <T,>(rng: () => number, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length)] as T;

export function severityFor(score: number): Severity {
  if (score >= 85) return "Critical";
  if (score >= 65) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

export const BASE_TIME = Date.parse("2026-08-07T10:15:02Z");

export function makeTrade(rng: () => number, index: number, at: number): Trade {
  const c = pick(rng, COMPANIES);
  return {
    trade_id: `TR-${10291 + index}`,
    trader_id: pick(rng, TRADERS),
    company: c.company,
    symbol: c.symbol,
    trade_type: rng() > 0.45 ? "BUY" : "SELL",
    quantity: Math.round((500 + rng() * 90_000) / 100) * 100,
    price: Math.round((60 + rng() * 900) * 100) / 100,
    timestamp: new Date(at).toISOString(),
  };
}

export function makeReasons(rng: () => number): Explainability[] {
  const shuffled = [...FEATURES].sort(() => rng() - 0.5).slice(0, 5);
  const raw = shuffled.map(() => 10 + rng() * 40);
  const total = raw.reduce((a, b) => a + b, 0);
  return shuffled
    .map((feature, i) => ({
      feature,
      impact: Math.round(((raw[i] as number) / total) * 100),
    }))
    .sort((a, b) => b.impact - a.impact);
}

export function makeAlert(rng: () => number, index: number, at: number, trade?: Trade): Alert {
  const c = trade
    ? { symbol: trade.symbol, company: trade.company }
    : pick(rng, COMPANIES);
  const probability = Math.round((0.42 + rng() * 0.57) * 100) / 100;
  const risk = Math.min(99, Math.round(probability * 100 + (rng() * 8 - 4)));
  const fraudType = pick(rng, FRAUD_TYPES);
  return {
    alert_id: `ALT-${4820 + index}`,
    case_id: `INV-2026-${String(index + 1).padStart(3, "0")}`,
    trader_id: trade?.trader_id ?? pick(rng, TRADERS),
    stock: c.symbol,
    company: c.company,
    risk_score: risk,
    severity: severityFor(risk),
    status: pick(rng, ["Pending", "Investigating", "Closed"] as const),
    fraud_type: fraudType,
    fraud_probability: probability,
    anomaly_score: Math.round((probability - 0.05 + rng() * 0.1) * 100) / 100,
    created_at: new Date(at).toISOString(),
    assigned_to: pick(rng, INVESTIGATORS),
    reason: `${fraudType} pattern detected on ${c.symbol}: clustered orders inside a restricted pre-announcement window with abnormal size relative to the trader's 90-day baseline.`,
    top_reasons: makeReasons(rng),
  };
}

export function seedTrades(count = 14): Trade[] {
  const rng = makeRng(20260807);
  return Array.from({ length: count }, (_, i) =>
    makeTrade(rng, i, BASE_TIME - (count - i) * 2600),
  ).reverse();
}

export function seedAlerts(count = 18): Alert[] {
  const rng = makeRng(77341);
  const list = Array.from({ length: count }, (_, i) =>
    makeAlert(rng, i, BASE_TIME - (count - i) * 3_600_000),
  );
  // Guarantee a hero case for the demo story.
  list[0] = {
    ...(list[0] as Alert),
    alert_id: "ALT-4820",
    case_id: "INV-2026-001",
    trader_id: "T102",
    stock: "NVCX",
    company: "NovaCortex Ltd",
    risk_score: 90,
    severity: "Critical",
    status: "Investigating",
    fraud_type: "Insider Trading",
    fraud_probability: 0.91,
    anomaly_score: 0.88,
    assigned_to: "A. Raghavan",
    reason:
      "Trader T102 accumulated 50,000 NVCX shares across 6 orders in the 34 hours preceding an unscheduled earnings release, after repeated contact with a company insider. Order size is 11x the trader's 90-day median.",
    top_reasons: [
      { feature: "Trade Timing", impact: 35 },
      { feature: "Large Order Size", impact: 25 },
      { feature: "Communication Pattern", impact: 20 },
      { feature: "Previous Behaviour", impact: 15 },
      { feature: "Price Impact", impact: 5 },
    ],
  };
  return list.reverse();
}

export function seedBlockchain(): BlockchainRecord[] {
  const rng = makeRng(90210);
  return Array.from({ length: 6 }, (_, i) => ({
    tx_hash: makeTxHash(rng),
    case_id: `INV-2026-${String(40 + i).padStart(3, "0")}`,
    trader_id: pick(rng, TRADERS),
    stock: pick(rng, COMPANIES).symbol,
    fraud_type: pick(rng, FRAUD_TYPES),
    confidence: 78 + Math.floor(rng() * 21),
    timestamp: new Date(BASE_TIME - (i + 1) * 7_200_000).toISOString(),
    anchored: true,
    confirmed_by: pick(rng, INVESTIGATORS.slice(0, 4)),
    confirmed_role: (rng() > 0.5 ? "Investigator" : "Compliance Officer") as "Investigator" | "Compliance Officer",
    reason: "Case confirmed by investigator after review of AI evidence bundle.",
    block: 8_412_003 - i * 37,
  })).reverse();
}

export function makeTxHash(rng: () => number = Math.random) {
  const hex = "0123456789abcdef";
  let out = "0x";
  for (let i = 0; i < 64; i++) out += hex[Math.floor(rng() * 16)];
  return out;
}

export const MODELS: ModelCard[] = [
  {
    id: "m-insider",
    name: "Insider Trading",
    status: "Active",
    confidence: 94.2,
    detections: 137,
    last_scan: "12s ago",
    description: "Gradient-boosted ensemble over pre-announcement trade windows.",
  },
  {
    id: "m-manip",
    name: "Market Manipulation",
    status: "Active",
    confidence: 91.6,
    detections: 88,
    last_scan: "9s ago",
    description: "Sequence model on order-book pressure and quote stuffing.",
  },
  {
    id: "m-pump",
    name: "Pump and Dump",
    status: "Active",
    confidence: 89.1,
    detections: 42,
    last_scan: "21s ago",
    description: "Volume/sentiment divergence detector across small caps.",
  },
  {
    id: "m-wash",
    name: "Wash Trading",
    status: "Active",
    confidence: 96.4,
    detections: 61,
    last_scan: "5s ago",
    description: "Graph clustering over self-matched counterparty accounts.",
  },
  {
    id: "m-spoof",
    name: "Spoofing",
    status: "Active",
    confidence: 92.8,
    detections: 74,
    last_scan: "3s ago",
    description: "Cancel-to-fill ratio anomaly scoring at microsecond depth.",
  },
  {
    id: "m-front",
    name: "Front Running",
    status: "Active",
    confidence: 88.7,
    detections: 29,
    last_scan: "31s ago",
    description: "Latency-arbitrage detection ahead of block order execution.",
  },
];

export const DATA_SOURCES: DataSource[] = [
  {
    id: "ds-trading",
    name: "Trading Data",
    status: "Connected",
    fields: ["trade_id", "trader_id", "symbol", "quantity", "price", "timestamp"],
    throughput: "18.4k msg/s",
    latency: "42 ms",
  },
  {
    id: "ds-market",
    name: "Market Data",
    status: "Connected",
    fields: ["order_book", "OHLCV", "volatility", "index_moves", "halts"],
    throughput: "61.2k msg/s",
    latency: "17 ms",
  },
  {
    id: "ds-comm",
    name: "Communication Metadata",
    status: "Connected",
    fields: ["sender_hash", "recipient_hash", "channel", "frequency", "burst_score"],
    throughput: "2.1k msg/s",
    latency: "310 ms",
  },
  {
    id: "ds-company",
    name: "Company Information",
    status: "Connected",
    fields: ["insider_list", "filings", "earnings_calendar", "board_changes"],
    throughput: "340 rec/min",
    latency: "1.2 s",
  },
  {
    id: "ds-history",
    name: "Historical Fraud Dataset",
    status: "Connected",
    fields: ["case_id", "verdict", "regulator", "penalty", "labels"],
    throughput: "140 rec/min",
    latency: "1.5 s",
  },
];

export const CASE_TIMELINE: TimelineEvent[] = [
  { id: "e1", time: "Aug 05 · 09:12", label: "Encrypted call logged", detail: "T102 ↔ insider node E-441, 14 min duration", kind: "comm" },
  { id: "e2", time: "Aug 05 · 14:47", label: "First accumulation order", detail: "BUY 8,000 NVCX @ 412.20", kind: "trade" },
  { id: "e3", time: "Aug 06 · 10:03", label: "Order size escalation", detail: "BUY 22,000 NVCX across 3 child orders", kind: "trade" },
  { id: "e4", time: "Aug 06 · 16:55", label: "Model flag raised", detail: "Insider Trading model → probability 0.78", kind: "ai" },
  { id: "e5", time: "Aug 07 · 08:30", label: "Unscheduled earnings release", detail: "NVCX +14.6% on open, volume 6.2x ADV", kind: "market" },
  { id: "e6", time: "Aug 07 · 10:15", label: "Liquidation attempt", detail: "SELL 50,000 NVCX @ 481.90", kind: "trade" },
  { id: "e7", time: "Aug 07 · 10:16", label: "Critical alert generated", detail: "Risk score 90 · routed to A. Raghavan", kind: "system" },
];

export const NETWORK = {
  nodes: [
    { id: "T102", label: "Trader T102", type: "trader", x: 50, y: 50 },
    { id: "E441", label: "Insider E-441", type: "employee", x: 18, y: 22 },
    { id: "BRK", label: "Broker Meridian", type: "broker", x: 84, y: 26 },
    { id: "ACC1", label: "Account T102-B", type: "account", x: 16, y: 80 },
    { id: "ACC2", label: "Account KYC-9F", type: "account", x: 52, y: 90 },
    { id: "ACC3", label: "Shell Ltd VX", type: "account", x: 88, y: 76 },
  ],
  edges: [
    { from: "T102", to: "E441", weight: 0.92, label: "12 calls" },
    { from: "T102", to: "BRK", weight: 0.64, label: "order flow" },
    { from: "T102", to: "ACC1", weight: 0.81, label: "co-owned" },
    { from: "T102", to: "ACC2", weight: 0.47, label: "same device" },
    { from: "BRK", to: "ACC3", weight: 0.58, label: "settlement" },
    { from: "E441", to: "ACC3", weight: 0.35, label: "funds" },
  ],
} as const;
