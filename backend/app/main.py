import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import exercises, workouts, body_metrics, prs, meets, programs, analytics, ai, user_prefs, auth
from app.routers import endurance, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed admin user if not exists
    admin_username = os.environ.get("ADMIN_USERNAME", "theironspud")
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    admin_email = os.environ.get("ADMIN_EMAIL", f"{admin_username}@powertrac.local")

    if admin_password:
        from app.db import async_session
        from app.models.user import User
        from app.core.security import hash_password
        from sqlalchemy import select
        async with async_session() as session:
            result = await session.execute(select(User).where(User.email == admin_email))
            existing = result.scalar_one_or_none()
            if not existing:
                admin_user = User(
                    email=admin_email,
                    hashed_password=hash_password(admin_password),
                    display_name=admin_username,
                    status="approved",
                    is_admin=True,
                )
                session.add(admin_user)
                await session.commit()

    from app.seed import seed_exercises
    await seed_exercises()
    yield


app = FastAPI(title="Powerlifting Training Tracker", version="0.1.0", lifespan=lifespan, redirect_slashes=False)

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
app.include_router(endurance.router, prefix="/api/endurance", tags=["endurance"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])


@app.get("/health")
async def health():
    return {"status": "ok"}
