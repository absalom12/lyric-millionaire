"""
FBref data puller via soccerdata.

Pulls the full deep stat suite per player per season:
shooting, passing, possession, defense, misc — everything FBref tracks.
"""

import pandas as pd
import soccerdata as sd
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent.parent / "data" / "raw"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Leagues and seasons we care about for the PSG analysis
DEFAULT_LEAGUES = ["FRA-Ligue 1", "ENG-Premier League", "ESP-La Liga", "GER-Bundesliga", "ITA-Serie A"]
DEFAULT_SEASONS = ["2017-2018", "2018-2019", "2019-2020", "2020-2021",
                   "2021-2022", "2022-2023", "2023-2024", "2024-2025"]


def get_fbref_reader(leagues: list[str], seasons: list[str]) -> sd.FBref:
    return sd.FBref(leagues=leagues, seasons=seasons)


def pull_standard_stats(leagues=DEFAULT_LEAGUES, seasons=DEFAULT_SEASONS) -> pd.DataFrame:
    """Goals, assists, xG, xA, minutes, age — the basics."""
    fbref = get_fbref_reader(leagues, seasons)
    df = fbref.read_player_season_stats(stat_type="standard")
    df.to_parquet(DATA_DIR / "standard_stats.parquet")
    return df


def pull_shooting_stats(leagues=DEFAULT_LEAGUES, seasons=DEFAULT_SEASONS) -> pd.DataFrame:
    """
    Includes PSxG (post-shot xG) — key for measuring finishing quality.
    PSxG > xG = elite finisher. PSxG < xG = wasteful.
    """
    fbref = get_fbref_reader(leagues, seasons)
    df = fbref.read_player_season_stats(stat_type="shooting")
    df.to_parquet(DATA_DIR / "shooting_stats.parquet")
    return df


def pull_passing_stats(leagues=DEFAULT_LEAGUES, seasons=DEFAULT_SEASONS) -> pd.DataFrame:
    """
    Progressive passes, key passes, passes into final third, passes into box.
    This is where midfield value lives — often invisible to casual fans.
    """
    fbref = get_fbref_reader(leagues, seasons)
    df = fbref.read_player_season_stats(stat_type="passing")
    df.to_parquet(DATA_DIR / "passing_stats.parquet")
    return df


def pull_possession_stats(leagues=DEFAULT_LEAGUES, seasons=DEFAULT_SEASONS) -> pd.DataFrame:
    """
    Progressive carries, carries into box, dribbles, miscontrols.
    Ball progression on the ground — different from passing progression.
    """
    fbref = get_fbref_reader(leagues, seasons)
    df = fbref.read_player_season_stats(stat_type="possession")
    df.to_parquet(DATA_DIR / "possession_stats.parquet")
    return df


def pull_defense_stats(leagues=DEFAULT_LEAGUES, seasons=DEFAULT_SEASONS) -> pd.DataFrame:
    """
    Pressures, pressure success rate, tackles, interceptions, blocks.
    Shows contribution in the pressing game — critical for modern football.
    """
    fbref = get_fbref_reader(leagues, seasons)
    df = fbref.read_player_season_stats(stat_type="defense")
    df.to_parquet(DATA_DIR / "defense_stats.parquet")
    return df


def pull_gca_stats(leagues=DEFAULT_LEAGUES, seasons=DEFAULT_SEASONS) -> pd.DataFrame:
    """
    Goal-creating actions and shot-creating actions.
    Goes two steps back from a goal — who actually created the danger?
    """
    fbref = get_fbref_reader(leagues, seasons)
    df = fbref.read_player_season_stats(stat_type="goal_shot_creation")
    df.to_parquet(DATA_DIR / "gca_stats.parquet")
    return df


def pull_misc_stats(leagues=DEFAULT_LEAGUES, seasons=DEFAULT_SEASONS) -> pd.DataFrame:
    """Aerials won, fouls, cards — secondary but useful for defenders."""
    fbref = get_fbref_reader(leagues, seasons)
    df = fbref.read_player_season_stats(stat_type="misc")
    df.to_parquet(DATA_DIR / "misc_stats.parquet")
    return df


def pull_all_stats(leagues=DEFAULT_LEAGUES, seasons=DEFAULT_SEASONS) -> pd.DataFrame:
    """
    Pull every stat type and merge into one wide DataFrame per player/season.
    This is the full dataset the channel runs analysis on.
    """
    print("Pulling standard stats...")
    std = pull_standard_stats(leagues, seasons)

    print("Pulling shooting stats (PSxG)...")
    shoot = pull_shooting_stats(leagues, seasons)

    print("Pulling passing stats...")
    passing = pull_passing_stats(leagues, seasons)

    print("Pulling possession stats...")
    poss = pull_possession_stats(leagues, seasons)

    print("Pulling defensive stats...")
    defense = pull_defense_stats(leagues, seasons)

    print("Pulling GCA stats...")
    gca = pull_gca_stats(leagues, seasons)

    print("Pulling misc stats...")
    misc = pull_misc_stats(leagues, seasons)

    # merge on player + season + league — the unique key
    key = ["player", "season", "team", "league"]

    df = std
    for other in [shoot, passing, poss, defense, gca, misc]:
        # drop duplicate columns before merging
        overlap = [c for c in other.columns if c in df.columns and c not in key]
        df = df.merge(other.drop(columns=overlap), on=key, how="left", suffixes=("", "_dup"))

    out_path = DATA_DIR / "all_stats_merged.parquet"
    df.to_parquet(out_path)
    print(f"Saved merged dataset → {out_path} ({len(df)} rows)")
    return df


def load_cached(filename: str) -> pd.DataFrame:
    """Load a previously pulled parquet file without hitting FBref again."""
    path = DATA_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"No cached data at {path} — run the pull first.")
    return pd.read_parquet(path)
