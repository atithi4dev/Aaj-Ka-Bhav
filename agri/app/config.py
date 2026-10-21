from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ is the project root when running `uvicorn app.main:app` from backend/
BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    app_name: str = "Agricultural Trade API"
    data_gov_api_key: str = ""
    data_gov_resource_id: str = "9ef84268-d588-465a-a308-a864a43d0070"
    data_gov_base_url: str = "https://api.data.gov.in/resource"
    raw_data_path: Path = BASE_DIR / "data" / "raw" / "mandi_datagov.csv"
    processed_data_path: Path = BASE_DIR / "data" / "processed" / "mandi_prices.csv"
    source_name: str = "AGMARKNET / data.gov.in"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    api_timeout_seconds: float = 20.0

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
