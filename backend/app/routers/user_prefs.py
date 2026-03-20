from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db import get_db
from app.models.user import User
from app.models.user_prefs import UserPreferences

# ---------- Schemas ----------


class UserPrefsUpdate(BaseModel):
    display_unit: str | None = None
    training_days_per_week: int | None = None
    preferred_rep_schemes: dict | None = None
    preferred_exercises: dict | None = None
    meet_weight_class_kg: Decimal | None = None
    notes: str | None = None


class UserPrefsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_unit: str
    training_days_per_week: int
    preferred_rep_schemes: dict | None = None
    preferred_exercises: dict | None = None
    meet_weight_class_kg: Decimal | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


# ---------- Router ----------

router = APIRouter()


async def _get_or_create_prefs(db: AsyncSession, user_id: int) -> UserPreferences:
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = UserPreferences(user_id=user_id)
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)
    return prefs


@router.get("/", response_model=UserPrefsOut)
async def get_user_prefs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_or_create_prefs(db, current_user.id)


@router.put("/", response_model=UserPrefsOut)
async def upsert_user_prefs(
    data: UserPrefsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prefs = await _get_or_create_prefs(db, current_user.id)

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(prefs, key, value)

    await db.commit()
    await db.refresh(prefs)
    return prefs
