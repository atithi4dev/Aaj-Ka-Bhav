from datetime import date
from pydantic import BaseModel


class PriceObservation(BaseModel):
    state: str
    district: str
    market: str
    commodity: str
    arrival_date: date
    min_price: float | None = None
    max_price: float | None = None
    modal_price: float | None = None
    unit: str = "INR/quintal"
    status: str = "reported"
    source: str = "AGMARKNET / data.gov.in"
