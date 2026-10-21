from app.data.loader import get_dataframe
from app.services.price_service import get_latest_prices


def compare_mandis(state: str, district: str, commodity: str):
    rows = get_latest_prices(state, district, commodity)
    # Comparisons use reported modal prices only. No transport costs are inferred.
    valid = [r for r in rows if r["modal_price"] is not None]
    valid.sort(key=lambda r: r["modal_price"], reverse=True)
    for index, row in enumerate(valid, start=1):
        row["price_rank"] = index
    return rows
