from fastapi import APIRouter, Query
from app.data.loader import get_dataframe

router = APIRouter()


@router.get("/commodities")
def commodities(state: str | None = Query(None)):
    df = get_dataframe()
    if state:
        df = df[df["state_key"] == state.strip().casefold()]
    values = sorted(df["commodity"].dropna().unique().tolist(), key=str.casefold)
    return {"state": state, "commodities": values, "count": len(values)}


@router.get("/states")
def states():
    df = get_dataframe()
    values = sorted(df["state"].dropna().unique().tolist(), key=str.casefold)
    return {"states": values, "count": len(values)}


@router.get("/districts")
def districts(state: str = Query(..., min_length=1)):
    df = get_dataframe()
    subset = df[df["state_key"] == state.strip().casefold()]
    values = sorted(subset["district"].dropna().unique().tolist(), key=str.casefold)
    return {"state": state, "districts": values, "count": len(values)}


@router.get("/markets")
def markets(
    state: str = Query(..., min_length=1),
    district: str = Query(..., min_length=1),
    commodity: str | None = None,
):
    df = get_dataframe()
    subset = df[
        (df["state_key"] == state.strip().casefold())
        & (df["district_key"] == district.strip().casefold())
    ]
    if commodity:
        subset = subset[subset["commodity_key"] == commodity.strip().casefold()]
    values = sorted(subset["market"].dropna().unique().tolist(), key=str.casefold)
    return {"state": state, "district": district, "markets": values, "count": len(values)}
