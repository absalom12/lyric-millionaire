"""
Transfermarkt scraper — transfer fees, ages, market values.

Uses requests + BeautifulSoup. Transfermarkt blocks bots aggressively,
so we set realistic headers and add delays between requests.
"""

import time
import requests
import pandas as pd
from bs4 import BeautifulSoup
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent.parent / "data" / "raw"
DATA_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

# PSG Transfermarkt club ID
PSG_TM_ID = "583"
PSG_TM_SLUG = "paris-saint-germain"


def _get(url: str, delay: float = 2.0) -> BeautifulSoup:
    """Fetch a Transfermarkt page with polite delay."""
    time.sleep(delay)
    resp = requests.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "lxml")


def parse_fee(fee_str: str) -> float:
    """
    Convert Transfermarkt fee string to float in millions.
    '€222.00m' → 222.0
    '€15.50m' → 15.5
    'Free transfer' → 0.0
    'Loan fee: €5m' → 5.0
    '-' → NaN (undisclosed)
    """
    if not fee_str or fee_str.strip() in ("-", "?", ""):
        return float("nan")
    fee_str = fee_str.lower().replace(",", ".")
    if "free" in fee_str:
        return 0.0
    if "loan" in fee_str and "fee" in fee_str:
        fee_str = fee_str.replace("loan fee:", "").strip()
    fee_str = fee_str.replace("€", "").replace("£", "").strip()
    if "m" in fee_str:
        return float(fee_str.replace("m", "").strip())
    if "k" in fee_str:
        return float(fee_str.replace("k", "").strip()) / 1000
    try:
        return float(fee_str)
    except ValueError:
        return float("nan")


def scrape_club_transfers(
    club_slug: str,
    club_id: str,
    seasons: list[str],
    transfer_type: str = "in",  # "in" or "out"
) -> pd.DataFrame:
    """
    Scrape all transfers in/out for a club across multiple seasons.

    Returns DataFrame with: player, age_at_signing, fee_m, season,
    from_club/to_club, market_value_at_signing_m
    """
    records = []

    for season in seasons:
        season_id = season.split("-")[0]  # "2022-2023" → "2022"
        url = (
            f"https://www.transfermarkt.com/{club_slug}/transfers/verein/{club_id}"
            f"/saison_id/{season_id}/pos//detailpos/0/w_s/{'s' if transfer_type == 'in' else 'w'}"
        )

        try:
            soup = _get(url)
        except Exception as e:
            print(f"  Failed season {season}: {e}")
            continue

        # Transfermarkt transfer table structure
        transfer_table = soup.find("div", {"id": "yw1"}) or soup.find("table", class_="items")
        if not transfer_table:
            print(f"  No transfer table found for {season}")
            continue

        rows = transfer_table.find_all("tr", class_=["odd", "even"])
        for row in rows:
            cells = row.find_all("td")
            if len(cells) < 5:
                continue

            try:
                player_tag = row.find("a", class_="spielprofil_tooltip")
                player_name = player_tag.text.strip() if player_tag else "Unknown"

                age_cell = cells[1].text.strip()
                age = int(age_cell) if age_cell.isdigit() else None

                # market value at time of transfer (usually 3rd or 4th cell)
                mv_cell = cells[-2].text.strip() if len(cells) >= 2 else "-"
                market_value_m = parse_fee(mv_cell)

                fee_cell = cells[-1].text.strip()
                fee_m = parse_fee(fee_cell)

                from_to_tag = row.find("td", class_="zentriert no-border-rechts hauptlink")
                club_tag = row.find("img", class_="tiny_wappen")
                club_name = club_tag["title"] if club_tag and "title" in club_tag.attrs else "Unknown"

                records.append({
                    "player": player_name,
                    "age_at_signing": age,
                    "fee_m": fee_m,
                    "market_value_at_signing_m": market_value_m,
                    "season": season,
                    "transfer_type": transfer_type,
                    "other_club": club_name,
                })

            except Exception:
                continue

        print(f"  Scraped {season}: {len(rows)} transfers found")

    df = pd.DataFrame(records)
    return df


def get_psg_transfers(seasons: list[str] = None) -> pd.DataFrame:
    """Pull all PSG incoming transfers from 2017 to present."""
    if seasons is None:
        seasons = [
            "2017-2018", "2018-2019", "2019-2020", "2020-2021",
            "2021-2022", "2022-2023", "2023-2024", "2024-2025",
        ]

    print("Scraping PSG incoming transfers from Transfermarkt...")
    df = scrape_club_transfers(PSG_TM_SLUG, PSG_TM_ID, seasons, transfer_type="in")
    out_path = DATA_DIR / "psg_transfers.parquet"
    df.to_parquet(out_path, index=False)
    print(f"Saved {len(df)} transfer records → {out_path}")
    return df


def load_psg_transfers() -> pd.DataFrame:
    path = DATA_DIR / "psg_transfers.parquet"
    if not path.exists():
        raise FileNotFoundError("Run get_psg_transfers() first.")
    return pd.read_parquet(path)
