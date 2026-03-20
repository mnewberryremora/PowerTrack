import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import exercises, workouts, body_metrics, prs, meets, programs, analytics, ai, user_prefs, auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Powerlifting Training Tracker", version="0.1.0", lifespan=lifespan)

# Allow localhost for dev + any production domain set via ALLOWED_ORIGINS env var
_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
allowed_origins = [o.strip() for o in _origins_env.split(",") if o.strip()] or [
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(exercises.router, prefix="/api/exercises", tags=["exercises"])
app.include_router(workouts.router, prefix="/api/workouts", tags=["workouts"])
app.include_router(body_metrics.router, prefix="/api/body-metrics", tags=["body-metrics"])
app.include_router(prs.router, prefix="/api/prs", tags=["prs"])
app.include_router(meets.router, prefix="/api/meets", tags=["meets"])
app.include_router(programs.router, prefix="/api/programs", tags=["programs"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(user_prefs.router, prefix="/api/preferences", tags=["preferences"])


@app.get("/health")
async def health():
    return {"status": "ok"}
