"""Normalize a downloaded CSV or fetched API JSON into a clean CSV."""
import json
from pathlib import Path
import pandas as pd
from app.config import settings


def normalize_column(name):
    return str(name).strip().lower().replace(" ", "_").replace("-", "_")


def main():
    raw_json = settings.raw_data_path.with_suffix(".json")
    raw_csv = settings.raw_data_path
    if raw_json.exists():
        payload = json.loads(raw_json.read_text(encoding="utf-8"))
        df = pd.DataFrame(payload["records"])
    elif raw_csv.exists():
        df = pd.read_csv(raw_csv, low_memory=False)
    else:
        raise FileNotFoundError(f"Place CSV at {raw_csv}, or run scripts/fetch_data.py first.")

    df.columns = [normalize_column(c) for c in df.columns]
    aliases = {
        "state": ["state", "state_name"],
        "district": ["district", "district_name"],
        "market": ["market", "market_name", "mandi"],
        "commodity": ["commodity", "commodity_name", "crop"],
        "arrival_date": ["arrival_date", "date", "price_date"],
        "min_price": ["min_price", "min_x0020_price", "minimum_price"],
        "max_price": ["max_price", "max_x0020_price", "maximum_price"],
        "modal_price": ["modal_price", "modal_x0020_price", "price"],
    }
    rename = {}
    for target, choices in aliases.items():
        for candidate in choices:
            if candidate in df.columns:
                rename[candidate] = target
                break
    df = df.rename(columns=rename)

    required = ["state", "district", "market", "commodity", "arrival_date"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns {missing}. Found columns: {list(df.columns)}")

    for c in ["min_price", "max_price", "modal_price"]:
        if c not in df.columns:
            df[c] = pd.NA
        df[c] = pd.to_numeric(df[c].astype(str).str.replace(",", "", regex=False), errors="coerce")
        df.loc[df[c] < 0, c] = pd.NA

    dates = df["arrival_date"].astype(str).str.strip()
    parsed = pd.to_datetime(dates, format="%d/%m/%Y", errors="coerce")
    m = parsed.isna()
    parsed.loc[m] = pd.to_datetime(dates.loc[m], errors="coerce", dayfirst=True)
    df["arrival_date"] = parsed

    for c in ["state", "district", "market", "commodity"]:
        df[c] = df[c].astype(str).str.strip()
        df.loc[df[c].isin(["", "nan", "None"]), c] = pd.NA

    df = df.dropna(subset=required).copy()
    # Keep variety/grade when supplied. These matter when comparing like with like.
    if "variety" not in df.columns:
        df["variety"] = None
    if "grade" not in df.columns:
        df["grade"] = None

    df = df.drop_duplicates()
    df = df.sort_values(["state", "district", "commodity", "market", "arrival_date"])
    settings.processed_data_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(settings.processed_data_path, index=False, date_format="%Y-%m-%d")
    print(f"Input rows: {len(pd.DataFrame(payload['records'])) if raw_json.exists() else 'CSV'}")
    print(f"Saved cleaned data: {settings.processed_data_path}")
    print(f"Rows: {len(df):,}")
    print(f"Latest observation: {df['arrival_date'].max().date()}")
    print(f"Unique commodities: {df['commodity'].nunique()}")
    print(f"Unique markets: {df['market'].nunique()}")


if __name__ == "__main__":
    main()
