from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.locations import router as locations_router
from app.api.routes.prices import router as prices_router
from app.config import settings

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Price transparency API backed by validated mandi observations.",
)

# Restrict origins in production by setting CORS_ORIGINS in .env.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api/v1", tags=["health"])
app.include_router(locations_router, prefix="/api/v1", tags=["locations"])
app.include_router(prices_router, prefix="/api/v1", tags=["prices"])


@app.get("/", tags=["root"])
def root():
    return {"message": "Agricultural Trade API", "docs": "/docs", "health": "/api/v1/health"}
