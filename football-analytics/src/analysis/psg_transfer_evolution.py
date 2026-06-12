"""
PSG Transfer Intelligence Evolution — core analysis for Video 1.

Merges FBref performance data with Transfermarkt fee data,
computes Transfer Intelligence Score per signing per season,
and tracks how PSG's recruitment intelligence evolved over time.
"""

import pandas as pd
import numpy as np
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))
from processing.metrics import run_full_pipeline, normalize_to_score

DATA_DIR = Path(__file__).parent.parent.parent / "data"
PROCESSED_DIR = DATA_DIR / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

# Position mapping — FBref uses verbose position names, we simplify
POSITION_MAP = {
    "FW": "FW", "LW": "FW", "RW": "FW",
    "CF": "FW", "ST": "FW",
    "AM": "AM", "SS": "AM",
    "MF": "MF", "CM": "MF", "DM": "MF", "LM": "MF", "RM": "MF",
    "DF": "DF", "CB": "DF", "LB": "DF", "RB": "DF", "WB": "DF",
    "GK": "GK",
}

# PSG era classification for the video narrative
ERA_MAP = {
    "2017-2018": "Galacticos",
    "2018-2019": "Galacticos",
    "2019-2020": "Galacticos",
    "2020-2021": "Galacticos",
    "2021-2022": "Superstar Chaos",
    "2022-2023": "Transition",
    "2023-2024": "Rebuild",
    "2024-2025": "Smart Era",
}


def classify_position(pos_str: str) -> str:
    if not isinstance(pos_str, str):
        return "MF"
    first_pos = pos_str.split(",")[0].strip().upper()
    return POSITION_MAP.get(first_pos, "MF")


def merge_fbref_with_transfers(
    fbref_df: pd.DataFrame,
    transfers_df: pd.DataFrame,
    club_name_fbref: str = "Paris S-G",
) -> pd.DataFrame:
    """
    Join FBref stats for PSG players with their transfer data.

    Matching strategy: fuzzy player name match + season overlap.
    A player signed in summer 2022 appears in FBref as season "2022-2023".
    """
    # filter FBref to only PSG players
    psg_stats = fbref_df[fbref_df["team"].str.contains(club_name_fbref, na=False)].copy()

    # normalize player names for joining (lowercase, strip accents roughly)
    psg_stats["player_key"] = psg_stats["player"].str.lower().str.strip()
    transfers_df["player_key"] = transfers_df["player"].str.lower().str.strip()

    # a signing in season X appears in FBref data for that same season
    merged = psg_stats.merge(
        transfers_df[["player_key", "season", "fee_m", "age_at_signing", "market_value_at_signing_m"]],
        on=["player_key", "season"],
        how="left",
    )

    # for players already at the club (no transfer fee), fill fee with 0
    # so they don't pollute the efficiency analysis — we exclude them later
    merged["is_signing"] = merged["fee_m"].notna()

    return merged


def compute_psg_tis(merged_df: pd.DataFrame) -> pd.DataFrame:
    """Run full metric pipeline on PSG signings, grouped by position."""
    results = []

    for pos_group in ["FW", "AM", "MF", "DF", "GK"]:
        subset = merged_df[
            (merged_df["is_signing"]) &
            (merged_df["position_group"] == pos_group) &
            (merged_df["minutes"] >= 450)  # minimum 5 full games to be meaningful
        ].copy()

        if len(subset) < 2:
            continue

        subset = run_full_pipeline(subset, pos_group)
        results.append(subset)

    if not results:
        return pd.DataFrame()

    return pd.concat(results, ignore_index=True)


def compute_era_averages(tis_df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate TIS by era — this is the core chart for the video.
    Shows the clear narrative: Galacticos era = low TIS, Smart era = high TIS.
    """
    tis_df = tis_df.copy()
    tis_df["era"] = tis_df["season"].map(ERA_MAP)

    era_stats = (
        tis_df.groupby("era")
        .agg(
            avg_tis=("transfer_intelligence_score", "mean"),
            median_tis=("transfer_intelligence_score", "median"),
            avg_fee_m=("fee_m", "mean"),
            total_spend_m=("fee_m", "sum"),
            avg_age_at_signing=("age_at_signing", "mean"),
            n_signings=("player", "count"),
            avg_deployment_rate=("deployment_rate", "mean"),
        )
        .reset_index()
    )

    # era order for the video timeline
    era_order = ["Galacticos", "Superstar Chaos", "Transition", "Rebuild", "Smart Era"]
    era_stats["era_order"] = era_stats["era"].map({e: i for i, e in enumerate(era_order)})
    era_stats = era_stats.sort_values("era_order")

    return era_stats


def get_best_and_worst_signings(tis_df: pd.DataFrame, top_n: int = 5) -> dict:
    """
    Return top N and bottom N signings by TIS.
    The best ones are the video's hero moments, worst ones are the cautionary tales.
    """
    valid = tis_df[tis_df["fee_m"] > 5].copy()  # exclude free transfers from worst list

    best = valid.nlargest(top_n, "transfer_intelligence_score")[
        ["player", "season", "fee_m", "transfer_intelligence_score",
         "performance_score", "age_at_signing", "deployment_rate"]
    ]

    worst = valid.nsmallest(top_n, "transfer_intelligence_score")[
        ["player", "season", "fee_m", "transfer_intelligence_score",
         "performance_score", "age_at_signing", "deployment_rate"]
    ]

    return {"best": best, "worst": worst}


def run_full_analysis(fbref_df: pd.DataFrame, transfers_df: pd.DataFrame) -> dict:
    """End-to-end: merge data → compute TIS → produce summary tables."""

    print("Classifying positions...")
    fbref_df["position_group"] = fbref_df["position"].apply(classify_position)

    print("Merging FBref with transfer data...")
    merged = merge_fbref_with_transfers(fbref_df, transfers_df)

    print("Computing Transfer Intelligence Scores...")
    tis_df = compute_psg_tis(merged)

    if tis_df.empty:
        print("No data after filtering. Check your raw data files.")
        return {}

    print("Computing era averages...")
    era_averages = compute_era_averages(tis_df)

    print("Finding best/worst signings...")
    rankings = get_best_and_worst_signings(tis_df)

    # save for notebook / visualization
    tis_df.to_parquet(PROCESSED_DIR / "psg_tis_by_player.parquet", index=False)
    era_averages.to_parquet(PROCESSED_DIR / "psg_era_averages.parquet", index=False)

    print("\n=== ERA AVERAGES ===")
    print(era_averages[["era", "avg_tis", "avg_fee_m", "avg_age_at_signing", "n_signings"]].to_string(index=False))
    print("\n=== BEST SIGNINGS ===")
    print(rankings["best"].to_string(index=False))
    print("\n=== WORST SIGNINGS ===")
    print(rankings["worst"].to_string(index=False))

    return {
        "player_scores": tis_df,
        "era_averages": era_averages,
        "best_signings": rankings["best"],
        "worst_signings": rankings["worst"],
    }
