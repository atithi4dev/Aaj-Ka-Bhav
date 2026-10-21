FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY agri/requirements.txt agri/requirements.txt
RUN pip install --no-cache-dir -r agri/requirements.txt

# Copy source code and frontend
COPY agri/ agri/
COPY frontend/ frontend/

# Ensure data directory exists
RUN mkdir -p agri/data/processed agri/data/raw

# Seed default data only if no dataset is present
RUN python -c "from pathlib import Path; import json, pandas as pd; \
p = Path('agri/data/processed/mandi_prices.csv'); \
r = Path('agri/data/raw/mandi_datagov.csv'); \
(not p.exists() and not r.exists()) and pd.DataFrame(json.load(open('frontend/data/data.json', encoding='utf-8'))['prices']).to_csv(p, index=False)"

WORKDIR /app/agri

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
