from fastapi import APIRouter, HTTPException, Query
from app.services.price_service import get_latest_prices, get_price_history
from app.services.comparison_service import compare_mandis

router = APIRouter()


@router.get("/prices/latest")
def latest_prices(
    state: str = Query(..., min_length=1),
    district: str = Query(..., min_length=1),
    commodity: str = Query(..., min_length=1),
    market: str | None = None,
):
    result = get_latest_prices(state, district, commodity, market)
    return {"commodity": commodity, "state": state, "district": district, "markets": result}


@router.get("/prices/history")
def price_history(
    state: str = Query(..., min_length=1),
    district: str = Query(..., min_length=1),
    market: str = Query(..., min_length=1),
    commodity: str = Query(..., min_length=1),
    days: int = Query(14, ge=1, le=365),
):
    result = get_price_history(state, district, market, commodity, days)
    if not result:
        raise HTTPException(status_code=404, detail="No reported observations found for these filters.")
    return {"state": state, "district": district, "market": market, "commodity": commodity, "observations": result}


@router.get("/mandis/compare")
def mandi_comparison(
    state: str = Query(..., min_length=1),
    district: str = Query(..., min_length=1),
    commodity: str = Query(..., min_length=1),
):
    result = compare_mandis(state, district, commodity)
    return {"state": state, "district": district, "commodity": commodity, "markets": result}
