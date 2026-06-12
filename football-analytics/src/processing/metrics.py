"""
Transfer Intelligence Score — metric system for Pitch Intelligence channel.

Beyond xG/xA: a composite scoring system that measures true player value
relative to transfer fee paid.
"""

import pandas as pd
import numpy as np


# ─── Metric weights by position group ────────────────────────────────────────
# Each position cares about different things — we weight accordingly

POSITION_WEIGHTS = {
    "FW": {
        "npxg_per90": 0.30,
        "xa_per90": 0.15,
        "progressive_carries_per90": 0.15,
        "shot_creating_actions_per90": 0.15,
        "psxg_minus_xg_per90": 0.10,   # finishing quality above expectation
        "carries_into_box_per90": 0.10,
        "pressure_success_pct": 0.05,
    },
    "AM": {
        "xa_per90": 0.25,
        "shot_creating_actions_per90": 0.20,
        "progressive_passes_per90": 0.20,
        "npxg_per90": 0.15,
        "progressive_carries_per90": 0.10,
        "pressure_success_pct": 0.10,
    },
    "MF": {
        "progressive_passes_per90": 0.25,
        "progressive_carries_per90": 0.20,
        "xa_per90": 0.15,
        "pressures_per90": 0.15,
        "pressure_success_pct": 0.10,
        "tackles_interceptions_per90": 0.10,
        "shot_creating_actions_per90": 0.05,
    },
    "DF": {
        "tackles_interceptions_per90": 0.30,
        "pressure_success_pct": 0.20,
        "pressures_per90": 0.15,
        "progressive_passes_per90": 0.20,
        "aerials_won_pct": 0.15,
    },
    "GK": {
        "psxg_minus_xg_per90": 0.40,   # saves above expectation
        "progressive_passes_per90": 0.30,
        "launch_pct": 0.15,
        "avg_pass_length": 0.15,
    },
}


def compute_per90(df: pd.DataFrame, cols: list[str], minutes_col: str = "minutes") -> pd.DataFrame:
    """Convert counting stats to per-90-minute rates."""
    df = df.copy()
    for col in cols:
        if col in df.columns:
            df[f"{col}_per90"] = (df[col] / df[minutes_col]) * 90
    return df


def compute_ball_progression_index(df: pd.DataFrame) -> pd.DataFrame:
    """
    BPI — combines progressive passes + carries + passes into box.
    Measures how much a player advances the team up the pitch per 90.
    """
    df = df.copy()
    components = []
    if "progressive_passes_per90" in df.columns:
        components.append(df["progressive_passes_per90"])
    if "progressive_carries_per90" in df.columns:
        components.append(df["progressive_carries_per90"])
    if "passes_into_box_per90" in df.columns:
        components.append(df["passes_into_box_per90"] * 1.5)  # weighted higher — direct threat

    if components:
        df["ball_progression_index"] = sum(components)
    return df


def compute_finishing_overperformance(df: pd.DataFrame) -> pd.DataFrame:
    """
    PSxG - xG delta: did the player consistently beat expectations with shot quality?
    Positive = elite finisher / ball striker. Negative = wasteful.
    """
    df = df.copy()
    if "psxg" in df.columns and "npxg" in df.columns:
        df["finishing_overperformance"] = df["psxg"] - df["npxg"]
        df["finishing_overperformance_per90"] = (df["finishing_overperformance"] / df["minutes"]) * 90
    return df


def compute_defensive_contribution(df: pd.DataFrame) -> pd.DataFrame:
    """Combine tackles + interceptions + pressure success into a single defensive score."""
    df = df.copy()
    cols = []
    if "tackles_per90" in df.columns:
        cols.append(df["tackles_per90"])
    if "interceptions_per90" in df.columns:
        cols.append(df["interceptions_per90"])
    if cols:
        df["tackles_interceptions_per90"] = sum(cols)
    return df


def normalize_to_score(series: pd.Series) -> pd.Series:
    """Min-max normalize a series to 0–100 scale."""
    mn, mx = series.min(), series.max()
    if mx == mn:
        return pd.Series([50.0] * len(series), index=series.index)
    return ((series - mn) / (mx - mn)) * 100


def compute_performance_score(df: pd.DataFrame, position_group: str) -> pd.DataFrame:
    """
    Weighted performance score (0–100) for a given position group.
    This is the numerator of the Transfer Intelligence Score.
    """
    df = df.copy()
    weights = POSITION_WEIGHTS.get(position_group, POSITION_WEIGHTS["MF"])

    score = pd.Series(0.0, index=df.index)
    total_weight_used = 0.0

    for metric, weight in weights.items():
        if metric in df.columns:
            normalized = normalize_to_score(df[metric].fillna(0))
            score += normalized * weight
            total_weight_used += weight

    # rescale if some metrics were missing
    if total_weight_used > 0:
        score = score / total_weight_used * 100

    df["performance_score"] = score.round(2)
    return df


def compute_transfer_intelligence_score(df: pd.DataFrame) -> pd.DataFrame:
    """
    Transfer Intelligence Score (TIS) — the channel's core metric.

    TIS = (Performance Score × Deployment Rate × Age Factor) / log(Fee + 1)

    - Performance Score: position-weighted output quality (0–100)
    - Deployment Rate: % of available minutes actually played (rewards clubs
      who use their signings properly)
    - Age Factor: younger signings score higher — more upside, longer value window
    - Fee: log-scaled so a €1M and €2M deal aren't treated the same as
      a €100M and €200M deal

    Higher TIS = better return on investment.
    """
    df = df.copy()

    # deployment rate: minutes played vs max available (38 games × 90 min)
    max_minutes = 38 * 90
    df["deployment_rate"] = (df["minutes"] / max_minutes).clip(0, 1)

    # age factor: peaks at 21 (1.0), decays toward 0.5 at 30+
    # signing a 21-year-old is worth twice as much as a 30-year-old, all else equal
    df["age_factor"] = np.where(
        df["age_at_signing"] <= 23,
        1.0,
        np.maximum(0.5, 1.0 - (df["age_at_signing"] - 23) * 0.05)
    )

    # fee scaling — log base to compress the extremes
    # a €200M signing needs to be astronomically better to justify vs €20M
    df["fee_log_scaled"] = np.log1p(df["fee_m"].fillna(0.1))

    df["transfer_intelligence_score"] = (
        df["performance_score"]
        * df["deployment_rate"]
        * df["age_factor"]
        / df["fee_log_scaled"]
    ).round(3)

    return df


def compute_market_value_efficiency(df: pd.DataFrame) -> pd.DataFrame:
    """
    Did the club buy the player BELOW market value?
    fee_paid vs market_value_at_signing → premium or discount?
    """
    df = df.copy()
    if "fee_m" in df.columns and "market_value_at_signing_m" in df.columns:
        df["fee_premium_pct"] = (
            (df["fee_m"] - df["market_value_at_signing_m"])
            / df["market_value_at_signing_m"].replace(0, np.nan)
        ) * 100
        # negative = bought below market (good), positive = overpaid
    return df


def run_full_pipeline(df: pd.DataFrame, position_group: str) -> pd.DataFrame:
    """Run all metric computations in sequence."""
    counting_cols = [
        "npxg", "xa", "progressive_passes", "progressive_carries",
        "shot_creating_actions", "pressures", "tackles", "interceptions",
        "carries_into_box", "passes_into_box", "aerials_won",
    ]
    df = compute_per90(df, counting_cols)
    df = compute_ball_progression_index(df)
    df = compute_finishing_overperformance(df)
    df = compute_defensive_contribution(df)
    df = compute_performance_score(df, position_group)
    df = compute_transfer_intelligence_score(df)
    df = compute_market_value_efficiency(df)
    return df
