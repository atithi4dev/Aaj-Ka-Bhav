from fastapi import APIRouter
from app.data.loader import get_dataframe
from app.config import settings

router = APIRouter()


@router.get("/health")
def health():
    try:
        df = get_dataframe()
        return {
            "status": "ok",
            "dataset_loaded": True,
            "records": int(len(df)),
            "latest_observation_date": df["arrival_date"].max().date().isoformat() if not df.empty else None,
            "source": settings.source_name,
        }
    except Exception as exc:
        # Avoid returning internal paths or secrets in production responses.
        return {"status": "degraded", "dataset_loaded": False, "detail": str(exc)}
