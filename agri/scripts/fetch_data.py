"""Fetch a snapshot from data.gov.in. The API key is read only from .env."""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from app.config import settings


def main():
    if not settings.data_gov_api_key:
        sys.exit("DATA_GOV_API_KEY is missing. Add it to backend/.env.")
    url = f"{settings.data_gov_base_url}/{settings.data_gov_resource_id}"
    params = {
        "api-key": settings.data_gov_api_key,
        "format": "json",
        "limit": 1000,
        "offset": 0,
    }
    output = settings.raw_data_path
    output.parent.mkdir(parents=True, exist_ok=True)
    records = []
    while True:
        response = requests.get(url, params=params, timeout=settings.api_timeout_seconds)
        response.raise_for_status()
        payload = response.json()
        if "records" not in payload:
            raise RuntimeError(f"API response did not contain records. Keys: {list(payload.keys())}")
        batch = payload["records"]
        records.extend(batch)
        total = int(payload.get("total", len(records)))
        print(f"Fetched {len(records)} / {total} records")
        if not batch or len(records) >= total:
            break
        params["offset"] += len(batch)
    if not records:
        raise RuntimeError("API returned zero records; refusing to overwrite any existing snapshot.")

    # Preserve the API response for traceability; clean_data.py converts this JSON to CSV.
    json_path = output.with_suffix(".json")
    json_path.write_text(json.dumps({
        "fetched_at_utc": datetime.now(timezone.utc).isoformat(),
        "resource_id": settings.data_gov_resource_id,
        "records": records,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(records)} records to {json_path}")
    print("Note: API paging/limits vary; verify total and date coverage before treating this as a complete archive.")


if __name__ == "__main__":
    main()
