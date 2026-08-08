"""
=================================================================
  INSIDER TRADING DETECTOR — Optimized Synthetic Data Generator v2.0
  Fully vectorized: generates ~110 k trades in < 90 s
=================================================================
"""

import time
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# ── Reproducibility ───────────────────────────────────────────────────────────
SEED = 42
rng  = np.random.default_rng(SEED)

# ── Config ────────────────────────────────────────────────────────────────────
N_TRADERS    = 500
N_COMPANIES  = 60
N_EVENTS     = 280
N_TRADES     = 110_000
N_COMMS      = 35_000
ANOMALY_RATE = 0.07

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

START_DATE      = pd.Timestamp("2023-01-01")
END_DATE        = pd.Timestamp("2024-12-31")
DATE_RANGE_DAYS = (END_DATE - START_DATE).days          # 730
DATE_RANGE_NS   = int(DATE_RANGE_DAYS * 86_400 * 1e9)  # total nanoseconds
START_NS        = START_DATE.value                      # epoch nanoseconds

t0 = time.time()
print("=" * 65)
print("  INSIDER TRADING DETECTOR  —  Data Generator v2.0")
print("=" * 65)
print()


# ══════════════════════════════════════════════════════════════════════════════
#  1. TRADERS  (500 rows)
# ══════════════════════════════════════════════════════════════════════════════
print("[1/5] Generating traders ...")

trader_ids = np.array([f"TRD{i:04d}" for i in range(1, N_TRADERS + 1)])

traders = pd.DataFrame({
    "trader_id"          : trader_ids,
    "department"         : rng.choice(
        ["Equities", "Fixed Income", "Derivatives", "FX", "Commodities"],
        N_TRADERS, p=[0.35, 0.25, 0.20, 0.12, 0.08],
    ),
    "seniority"          : rng.choice(
        ["Junior", "Mid", "Senior", "Director"],
        N_TRADERS, p=[0.25, 0.35, 0.25, 0.15],
    ),
    "avg_daily_trades"   : rng.integers(2, 25, N_TRADERS),
    "avg_trade_value"    : rng.integers(50_000, 5_000_000, N_TRADERS),
    "risk_profile"       : rng.choice(
        ["Low", "Medium", "High"], N_TRADERS, p=[0.50, 0.35, 0.15],
    ),
    "years_experience"   : rng.integers(1, 30, N_TRADERS),
    "network_risk_score" : rng.uniform(0.01, 0.95, N_TRADERS).round(4),
    "peer_group"         : rng.integers(1, 11, N_TRADERS),
})
traders.to_csv(DATA_DIR / "traders.csv", index=False)
print(f"   OK  {N_TRADERS:,} traders saved")


# ══════════════════════════════════════════════════════════════════════════════
#  2. COMPANIES  (60 rows)
# ══════════════════════════════════════════════════════════════════════════════
print("[2/5] Generating companies ...")

_TICKERS = [
    "AAPL","MSFT","GOOGL","AMZN","META","TSLA","NVDA","JPM","GS","MS",
    "BAC","WFC","C","BRK","V","MA","PYPL","NFLX","DIS","BABA",
    "TSM","ASML","INTC","AMD","QCOM","AVGO","TXN","MU","LRCX","KLAC",
    "BA","LMT","RTX","NOC","GD","CAT","DE","MMM","HON","GE",
    "XOM","CVX","COP","SLB","HAL","OXY","VLO","MPC","PSX","EOG",
    "JNJ","PFE","MRK","ABBV","BMY","AMGN","GILD","BIIB","REGN","VRTX",
]

companies = pd.DataFrame({
    "company_id"       : np.array([f"CMP{i:03d}" for i in range(1, N_COMPANIES + 1)]),
    "ticker"           : _TICKERS[:N_COMPANIES],
    "sector"           : rng.choice(
        ["Tech", "Finance", "Defense", "Energy", "Healthcare"], N_COMPANIES
    ),
    "market_cap_bn"    : rng.uniform(5, 3000, N_COMPANIES).round(2),
    "avg_daily_volume" : rng.integers(1_000_000, 100_000_000, N_COMPANIES),
    "volatility"       : rng.uniform(0.10, 0.60, N_COMPANIES).round(4),
    "is_high_risk"     : rng.choice([True, False], N_COMPANIES, p=[0.30, 0.70]),
})
companies.to_csv(DATA_DIR / "companies.csv", index=False)
print(f"   OK  {N_COMPANIES:,} companies saved")


# ══════════════════════════════════════════════════════════════════════════════
#  3. CORPORATE EVENTS  (280 rows)
# ══════════════════════════════════════════════════════════════════════════════
print("[3/5] Generating corporate events ...")

event_offsets_ns = rng.integers(0, DATE_RANGE_NS, N_EVENTS, dtype=np.int64)
event_dates      = pd.to_datetime(START_NS + event_offsets_ns)

events = pd.DataFrame({
    "event_id"        : np.array([f"EVT{i:04d}" for i in range(1, N_EVENTS + 1)]),
    "company_id"      : rng.choice(companies["company_id"].values, N_EVENTS),
    "event_type"      : rng.choice(
        ["Earnings", "M&A", "Dividend", "Restructuring", "Regulatory"],
        N_EVENTS, p=[0.35, 0.30, 0.15, 0.12, 0.08],
    ),
    "event_date"      : event_dates,
    "is_major"        : rng.choice([True, False], N_EVENTS, p=[0.65, 0.35]),
    "expected_impact" : rng.choice(
        ["High", "Medium", "Low"], N_EVENTS, p=[0.40, 0.40, 0.20]
    ),
})
events.to_csv(DATA_DIR / "corporate_events.csv", index=False)
print(f"   OK  {N_EVENTS:,} events saved")


# ══════════════════════════════════════════════════════════════════════════════
#  4. TRADES  (110,000 rows) — fully vectorized
# ══════════════════════════════════════════════════════════════════════════════
print("[4/5] Generating trades ...")

N_ANOM   = int(N_TRADES * ANOMALY_RATE)   # ≈ 7,700
N_NORMAL = N_TRADES - N_ANOM              # ≈ 102,300

# ── Major event timestamps (sorted, nanoseconds) ──────────────────────────────
major_event_ns = (
    events.loc[events["is_major"], "event_date"]
    .sort_values()
    .values
    .astype(np.int64)
)
_H24_NS = np.int64(24 * 3600 * 1_000_000_000)
_H48_NS = np.int64(48 * 3600 * 1_000_000_000)
_H36_NS = np.int64(36 * 3600 * 1_000_000_000)

# ── Anomalous trade timestamps ────────────────────────────────────────────────
#   Distribution:
#     45% within 0–24 h before a major event
#     25% within 24–48 h before a major event   →  total 70% within 48 h
#     30% anywhere in date range (free anomalies)

n_24h  = int(N_ANOM * 0.45)
n_48h  = int(N_ANOM * 0.25)
n_free = N_ANOM - n_24h - n_48h

# 0–24 h window (offset is NEGATIVE → before event)
anchor_24 = rng.choice(major_event_ns, size=n_24h)
off_24    = rng.integers(-_H24_NS, 0, size=n_24h, dtype=np.int64)
ts_24     = anchor_24 + off_24

# 24–48 h window
anchor_48 = rng.choice(major_event_ns, size=n_48h)
off_48    = rng.integers(-_H48_NS, -_H24_NS, size=n_48h, dtype=np.int64)
ts_48     = anchor_48 + off_48

# Free anomalies
ts_free_anom = START_NS + rng.integers(0, DATE_RANGE_NS, n_free, dtype=np.int64)

# Normal trade timestamps
ts_normal = START_NS + rng.integers(0, DATE_RANGE_NS, N_NORMAL, dtype=np.int64)

# Concatenate & shuffle
all_ts_ns  = np.concatenate([ts_24, ts_48, ts_free_anom, ts_normal])
is_anomaly = np.concatenate([
    np.ones(N_ANOM,   dtype=bool),
    np.zeros(N_NORMAL, dtype=bool),
])
perm       = rng.permutation(N_TRADES)
all_ts_ns  = all_ts_ns[perm]
is_anomaly = is_anomaly[perm]

trade_timestamps = pd.to_datetime(all_ts_ns)

# ── Trader & company assignments ──────────────────────────────────────────────
t_idx = rng.integers(0, N_TRADERS,  N_TRADES)
c_idx = rng.integers(0, N_COMPANIES, N_TRADES)

trader_ids_col   = traders["trader_id"].values[t_idx]
company_ids_col  = companies["company_id"].values[c_idx]
tickers_col      = companies["ticker"].values[c_idx]
network_risk_col = traders["network_risk_score"].values[t_idx]
peer_group_col   = traders["peer_group"].values[t_idx]

# ── hours_to_next_event & hours_since_last_event (vectorized searchsorted) ────
si            = np.searchsorted(major_event_ns, all_ts_ns, side="right")
next_idx      = np.clip(si, 0, len(major_event_ns) - 1)
prev_idx      = np.clip(si - 1, 0, len(major_event_ns) - 1)

next_event_ns = major_event_ns[next_idx]
prev_event_ns = major_event_ns[prev_idx]

HRS_NS = 3_600_000_000_000.0  # nanoseconds per hour
hours_to_next   = (next_event_ns - all_ts_ns) / HRS_NS
hours_since_last= (all_ts_ns - prev_event_ns) / HRS_NS

hours_to_next    = np.clip(hours_to_next,    -500, 500)
hours_since_last = np.clip(hours_since_last,    0, 500)

is_pre_event_window = ((hours_to_next >= 0) & (hours_to_next <= 48)).astype(np.int8)

# ── Volume & statistical features ─────────────────────────────────────────────
volume_ratio = np.where(
    is_anomaly,
    rng.uniform(3.0, 12.0, N_TRADES),
    rng.uniform(0.3,  2.5, N_TRADES),
).round(4)

volume_zscore_30d = np.where(
    is_anomaly,
    rng.uniform(2.0, 7.0, N_TRADES),
    rng.normal(0.0,  1.0, N_TRADES),
).round(4)

peer_group_deviation = np.where(
    is_anomaly,
    rng.uniform(2.5, 6.0, N_TRADES),
    rng.uniform(-1.5, 1.5, N_TRADES),
).round(4)

# ── Communication spike ratio ─────────────────────────────────────────────────
#   55% of anomalous trades must have spike (≥ 2.5)
comm_spike_flag = np.zeros(N_TRADES, dtype=bool)
anom_indices    = np.where(is_anomaly)[0]
n_spike_trades  = int(N_ANOM * 0.55)
spike_trade_idx = rng.choice(anom_indices, size=n_spike_trades, replace=False)
comm_spike_flag[spike_trade_idx] = True

communication_spike_ratio = np.where(
    comm_spike_flag,
    rng.uniform(2.5, 8.0, N_TRADES),
    np.where(
        is_anomaly,
        rng.uniform(0.8, 2.5, N_TRADES),
        rng.uniform(0.1, 1.5, N_TRADES),
    ),
).round(4)

# ── Trade mechanics ───────────────────────────────────────────────────────────
actions     = rng.choice(["BUY", "SELL"], N_TRADES, p=[0.52, 0.48])
instruments = rng.choice(
    ["Equity", "Options", "Futures", "ETF"],
    N_TRADES, p=[0.60, 0.20, 0.12, 0.08],
)
order_types = rng.choice(
    ["Market", "Limit", "Stop"],
    N_TRADES, p=[0.55, 0.35, 0.10],
)
quantities  = rng.integers(100, 100_000, N_TRADES)
prices      = np.clip(
    companies["market_cap_bn"].values[c_idx] * rng.uniform(0.5, 5.0, N_TRADES),
    5.0, 5000.0,
).round(2)
trade_values = (quantities * prices).round(2)

# ── Behavioural / derived signals ─────────────────────────────────────────────
after_hours_flag            = ((trade_timestamps.hour < 9) | (trade_timestamps.hour >= 17)).astype(np.int8)
consecutive_profitable_trades = np.where(
    is_anomaly, rng.integers(3, 15, N_TRADES), rng.integers(0, 5, N_TRADES)
)
pnl_pct = np.where(
    is_anomaly,
    rng.uniform(0.05, 0.35, N_TRADES),
    rng.normal(0.01, 0.03, N_TRADES),
).round(4)
price_impact_proxy = np.where(
    is_anomaly,
    rng.uniform(0.03, 0.20, N_TRADES),
    rng.uniform(0.001, 0.05, N_TRADES),
).round(5)
unusual_instrument_flag = (
    ((instruments == "Options") | (instruments == "Futures")) & (volume_ratio > 3.0)
).astype(np.int8)

buy_sell_ratio = np.where(
    is_anomaly,
    rng.uniform(2.5, 8.0, N_TRADES),
    rng.uniform(0.5, 2.0, N_TRADES),
).round(4)
trade_frequency_1h  = np.where(is_anomaly, rng.integers(3, 15, N_TRADES), rng.integers(1, 5, N_TRADES))
trade_frequency_24h = np.where(is_anomaly, rng.integers(10, 50, N_TRADES), rng.integers(2, 20, N_TRADES))

# ── Assemble DataFrame ────────────────────────────────────────────────────────
trades = pd.DataFrame({
    "trade_id"                     : [f"TRD{i:07d}" for i in range(1, N_TRADES + 1)],
    "trader_id"                    : trader_ids_col,
    "company_id"                   : company_ids_col,
    "ticker"                       : tickers_col,
    "trade_timestamp"              : trade_timestamps,
    "action"                       : actions,
    "instrument"                   : instruments,
    "order_type"                   : order_types,
    "quantity"                     : quantities,
    "price"                        : prices,
    "trade_value"                  : trade_values,
    "volume_ratio"                 : volume_ratio,
    "volume_zscore_30d"            : volume_zscore_30d,
    "hours_to_next_event"          : hours_to_next.round(2),
    "hours_since_last_event"       : hours_since_last.round(2),
    "is_pre_event_window"          : is_pre_event_window,
    "peer_group_deviation"         : peer_group_deviation,
    "communication_spike_ratio"    : communication_spike_ratio,
    "buy_sell_ratio"               : buy_sell_ratio,
    "unusual_instrument_flag"      : unusual_instrument_flag,
    "after_hours_flag"             : after_hours_flag,
    "consecutive_profitable_trades": consecutive_profitable_trades,
    "price_impact_proxy"           : price_impact_proxy,
    "network_risk"                 : network_risk_col.round(4),
    "peer_group"                   : peer_group_col,
    "trade_frequency_1h"           : trade_frequency_1h,
    "trade_frequency_24h"          : trade_frequency_24h,
    "pnl_pct"                      : pnl_pct,
    "is_anomalous"                 : is_anomaly.astype(np.int8),
})

# Save — use faster CSV writer settings
trades.to_csv(DATA_DIR / "trades.csv", index=False)
print(f"   OK  {N_TRADES:,} trades saved")


# ══════════════════════════════════════════════════════════════════════════════
#  5. COMMUNICATIONS  (35,000 rows)
# ══════════════════════════════════════════════════════════════════════════════
print("[5/5] Generating communications ...")

# Spike comms — linked to anomalous trades with comm_spike_flag
spike_mask_series = pd.Series(comm_spike_flag)
spike_rows        = trades[comm_spike_flag.astype(bool)]

n_spike_comms  = min(len(spike_rows), int(N_COMMS * 0.55))
n_normal_comms = N_COMMS - n_spike_comms

# Sample from spike trades (with replacement if needed)
chosen_spike = rng.integers(0, len(spike_rows), n_spike_comms)
spike_ts_ns  = spike_rows["trade_timestamp"].values.astype(np.int64)[chosen_spike]
spike_offsets_ns = rng.integers(0, int(_H36_NS), n_spike_comms, dtype=np.int64)
spike_comm_ts    = pd.to_datetime(spike_ts_ns - spike_offsets_ns)
spike_linked_ids = spike_rows["trade_id"].values[chosen_spike]
spike_trader_ids = spike_rows["trader_id"].values[chosen_spike]

# Normal comms — random timestamps
normal_comm_ts_ns = START_NS + rng.integers(0, DATE_RANGE_NS, n_normal_comms, dtype=np.int64)
normal_comm_ts    = pd.to_datetime(normal_comm_ts_ns)
normal_trader_ids = traders["trader_id"].values[rng.integers(0, N_TRADERS, n_normal_comms)]

# Assemble
all_comm_ts     = np.concatenate([spike_comm_ts.values, normal_comm_ts.values])
all_comm_ts     = pd.to_datetime(all_comm_ts)
all_trader_ids  = np.concatenate([spike_trader_ids, normal_trader_ids])
linked_ids      = np.concatenate([spike_linked_ids, np.full(n_normal_comms, "", dtype=object)])
is_flagged_comm = np.concatenate([
    np.ones(n_spike_comms, dtype=np.int8),
    rng.choice([1, 0], n_normal_comms, p=[0.05, 0.95]).astype(np.int8),
])
keyword_hits = np.concatenate([
    rng.integers(3, 15, n_spike_comms),
    rng.integers(0,  4, n_normal_comms),
])

comms = pd.DataFrame({
    "comm_id"         : [f"COM{i:07d}" for i in range(1, N_COMMS + 1)],
    "trader_id"       : all_trader_ids,
    "timestamp"       : all_comm_ts,
    "channel"         : rng.choice(
        ["Email", "Chat", "Phone", "Bloomberg"], N_COMMS, p=[0.40, 0.30, 0.20, 0.10]
    ),
    "sentiment"       : rng.choice(
        ["Neutral", "Positive", "Negative", "Urgent"], N_COMMS, p=[0.50, 0.25, 0.15, 0.10]
    ),
    "is_flagged"      : is_flagged_comm,
    "linked_trade_id" : linked_ids,
    "counterparty_id" : traders["trader_id"].values[rng.integers(0, N_TRADERS, N_COMMS)],
    "keyword_hits"    : keyword_hits,
})
comms.to_csv(DATA_DIR / "communications.csv", index=False)
print(f"   OK  {N_COMMS:,} communications saved")


# ══════════════════════════════════════════════════════════════════════════════
#  DIAGNOSTICS
# ══════════════════════════════════════════════════════════════════════════════
elapsed = time.time() - t0

anom  = trades[trades["is_anomalous"] == 1]
norm  = trades[trades["is_anomalous"] == 0]

pct_within_48h = (anom["hours_to_next_event"].between(0, 48)).mean() * 100
pct_within_24h = (anom["hours_to_next_event"].between(0, 24)).mean() * 100
pct_comm_spike = (anom["communication_spike_ratio"] >= 2.5).mean() * 100

print()
print("=" * 65)
print("  DIAGNOSTICS")
print("=" * 65)
print(f"  Total trades             : {N_TRADES:,}")
print(f"  Anomaly rate             : {len(anom) / N_TRADES * 100:.2f}%  (target 7.00%)")
print(f"  Anomalous within 48 h    : {pct_within_48h:.1f}%   (target >= 70%)")
print(f"  Anomalous within 24 h    : {pct_within_24h:.1f}%   (target >= 45%)")
print(f"  Anomalous with comm spike: {pct_comm_spike:.1f}%   (target >= 55%)")
print(f"  Avg volume_ratio - anom  : {anom['volume_ratio'].mean():.3f}")
print(f"  Avg volume_ratio - normal: {norm['volume_ratio'].mean():.3f}")
print(f"  Avg peer_group_dev - anom: {anom['peer_group_deviation'].mean():.3f}")
print(f"  Avg peer_group_dev - norm: {norm['peer_group_deviation'].mean():.3f}")
print(f"  Pre-event window rate    : {is_pre_event_window.mean()*100:.1f}% of all trades")
print()
print(f"  Time elapsed             : {elapsed:.1f} s")
print(f"  Files written to         : {DATA_DIR.resolve()}")
print("=" * 65)
