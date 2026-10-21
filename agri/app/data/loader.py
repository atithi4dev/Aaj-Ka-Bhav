from functools import lru_cache
from pathlib import Path
import pandas as pd
from app.config import settings

ALIASES = {
    "state": ["state", "state_name"],
    "district": ["district", "district_name"],
    "market": ["market", "market_name", "mandi"],
    "commodity": ["commodity", "commodity_name", "crop"],
    "arrival_date": ["arrival_date", "date", "price_date"],
    "min_price": ["min_price", "minimum_price"],
    "max_price": ["max_price", "maximum_price"],
    "modal_price": ["modal_price", "price"],
}


def _find_column(columns, aliases):
    lookup = {str(c).strip().lower().replace(" ", "_"): c for c in columns}
    for alias in aliases:
        key = alias.strip().lower().replace(" ", "_")
        if key in lookup:
            return lookup[key]
    return None


@lru_cache(maxsize=1)
def get_dataframe() -> pd.DataFrame:
    path = settings.processed_data_path
    if not path.exists():
        path = settings.raw_data_path
    if not path.exists():
        raise FileNotFoundError(
            f"No dataset found. Put CSV at {settings.raw_data_path} or run scripts/clean_data.py."
        )

    df = pd.read_csv(path, low_memory=False)
    rename = {}
    for canonical, aliases in ALIASES.items():
        found = _find_column(df.columns, aliases)
        if found is not None:
            rename[found] = canonical
    df = df.rename(columns=rename)

    required = ["state", "district", "market", "commodity", "arrival_date"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")

    for c in ["min_price", "max_price", "modal_price"]:
        if c not in df.columns:
            df[c] = pd.NA
        df[c] = pd.to_numeric(df[c].astype(str).str.replace(",", "", regex=False), errors="coerce")
        df.loc[df[c] < 0, c] = pd.NA

    # Supports common Indian date format DD/MM/YYYY and ISO dates.
    raw_dates = df["arrival_date"].astype(str).str.strip()
    parsed = pd.to_datetime(raw_dates, format="%d/%m/%Y", errors="coerce")
    missing_dates = parsed.isna()
    parsed.loc[missing_dates] = pd.to_datetime(raw_dates.loc[missing_dates], errors="coerce", dayfirst=True)
    df["arrival_date"] = parsed
    df = df.dropna(subset=required).copy()

    for c in ["state", "district", "market", "commodity"]:
        df[c] = df[c].astype(str).str.strip()
        df = df[df[c] != ""]
        df[c + "_key"] = df[c].str.casefold()

    # Deduplicate exact observations; keep source's reported values.
    dedupe_cols = ["state_key", "district_key", "market_key", "commodity_key", "arrival_date", "min_price", "max_price", "modal_price"]
    df = df.drop_duplicates(subset=dedupe_cols).sort_values("arrival_date")
    return df.reset_index(drop=True)
