from app.config import settings
from app.data.loader import get_dataframe
from app.services.analytics import price_change


def _filter(state: str, district: str, commodity: str, market: str | None = None):
    df = get_dataframe()
    subset = df[
        (df["state_key"] == state.strip().casefold())
        & (df["district_key"] == district.strip().casefold())
        & (df["commodity_key"] == commodity.strip().casefold())
    ]
    if market:
        subset = subset[subset["market_key"] == market.strip().casefold()]
    return subset


def get_latest_prices(state: str, district: str, commodity: str, market: str | None = None):
    subset = _filter(state, district, commodity, market)
    if subset.empty:
        return []

    # Latest observation is selected independently per market; no missing date is filled.
    rows = []
    for _, group in subset.groupby("market_key", sort=False):
        group = group.sort_values("arrival_date")
        latest = group.iloc[-1]
        earlier = group[group["arrival_date"] < latest["arrival_date"]]
        previous = earlier.iloc[-1] if not earlier.empty else None
        change = price_change(
            float(latest["modal_price"]) if latest["modal_price"] is not None else None,
            float(previous["modal_price"]) if previous is not None and previous["modal_price"] is not None else None,
        )
        rows.append({
            "market": latest["market"],
            "arrival_date": latest["arrival_date"].date().isoformat(),
            "modal_price": _number(latest["modal_price"]),
            "min_price": _number(latest["min_price"]),
            "max_price": _number(latest["max_price"]),
            "unit": "INR/quintal",
            "status": "reported" if latest["modal_price"] is not None else "price_unavailable",
            "previous_observation": (
                {"arrival_date": previous["arrival_date"].date().isoformat(),
                 "modal_price": _number(previous["modal_price"])}
                if previous is not None else None
            ),
            "change": change,
            "source": settings.source_name,
        })
    return sorted(rows, key=lambda x: x["market"].casefold())


def get_price_history(state: str, district: str, market: str, commodity: str, days: int = 14):
    subset = _filter(state, district, commodity, market)
    if subset.empty:
        return []
    latest_date = subset["arrival_date"].max()
    cutoff = latest_date - __import__("pandas").Timedelta(days=days - 1)
    subset = subset[subset["arrival_date"] >= cutoff].sort_values("arrival_date")
    return [
        {
            "arrival_date": row["arrival_date"].date().isoformat(),
            "modal_price": _number(row["modal_price"]),
            "min_price": _number(row["min_price"]),
            "max_price": _number(row["max_price"]),
            "unit": "INR/quintal",
            "status": "reported" if row["modal_price"] is not None else "price_unavailable",
        }
        for _, row in subset.iterrows()
    ]


def _number(value):
    try:
        if value is None:
            return None
        import pandas as pd
        if pd.isna(value):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None
