from datetime import date as DateType, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db import get_db
from app.models.endurance import EnduranceActivity
from app.models.user import User

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class EnduranceCreate(BaseModel):
    activity_date: DateType
    activity_type: str  # "run" or "erg"
    sub_type: str
    name: Optional[str] = None
    distance_m: Optional[float] = None
    duration_s: Optional[int] = None
    avg_heart_rate: Optional[int] = None
    avg_split_500m_s: Optional[int] = None
    stroke_rate: Optional[float] = None
    calories: Optional[int] = None
    is_competition: bool = False
    competition_name: Optional[str] = None
    competition_type: Optional[str] = None
    place: Optional[int] = None
    notes: Optional[str] = None


class EnduranceUpdate(BaseModel):
    activity_date: Optional[DateType] = None
    activity_type: Optional[str] = None
    sub_type: Optional[str] = None
    name: Optional[str] = None
    distance_m: Optional[float] = None
    duration_s: Optional[int] = None
    avg_heart_rate: Optional[int] = None
    avg_split_500m_s: Optional[int] = None
    stroke_rate: Optional[float] = None
    calories: Optional[int] = None
    is_competition: Optional[bool] = None
    competition_name: Optional[str] = None
    competition_type: Optional[str] = None
    place: Optional[int] = None
    notes: Optional[str] = None


class EnduranceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    activity_date: DateType
    activity_type: str
    sub_type: str
    name: Optional[str]
    distance_m: Optional[float]
    duration_s: Optional[int]
    avg_heart_rate: Optional[int]
    avg_split_500m_s: Optional[int]
    stroke_rate: Optional[float]
    calories: Optional[int]
    is_competition: bool
    competition_name: Optional[str]
    competition_type: Optional[str]
    place: Optional[int]
    notes: Optional[str]
    created_at: datetime

    # Computed fields
    pace_per_km: Optional[float] = None
    split_500m_display: Optional[str] = None

    @classmethod
    def from_orm_with_computed(cls, obj: EnduranceActivity) -> "EnduranceOut":
        data = cls.model_validate(obj)

        # pace_per_km: seconds per km
        if obj.duration_s is not None and obj.distance_m is not None and obj.distance_m > 0:
            data.pace_per_km = obj.duration_s / obj.distance_m * 1000
        else:
            data.pace_per_km = None

        # split_500m_display: "M:SS"
        if obj.avg_split_500m_s is not None:
            minutes = obj.avg_split_500m_s // 60
            seconds = obj.avg_split_500m_s % 60
            data.split_500m_display = f"{minutes}:{seconds:02d}"
        else:
            data.split_500m_display = None

        return data


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/competition-types", response_model=list[str])
async def get_competition_types(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return distinct competition_type values used by this user (for autocomplete)."""
    result = await db.execute(
        select(EnduranceActivity.competition_type)
        .where(
            EnduranceActivity.user_id == current_user.id,
            EnduranceActivity.competition_type.isnot(None),
        )
        .distinct()
    )
    types = [row[0] for row in result.all() if row[0]]
    return sorted(types)


@router.get("/", response_model=list[EnduranceOut])
async def list_activities(
    activity_type: Optional[str] = Query(None),
    is_competition: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(EnduranceActivity)
        .where(EnduranceActivity.user_id == current_user.id)
        .order_by(EnduranceActivity.activity_date.desc())
    )
    if activity_type is not None:
        stmt = stmt.where(EnduranceActivity.activity_type == activity_type)
    if is_competition is not None:
        stmt = stmt.where(EnduranceActivity.is_competition == is_competition)

    result = await db.execute(stmt)
    activities = result.scalars().all()
    return [EnduranceOut.from_orm_with_computed(a) for a in activities]


@router.get("/{activity_id}", response_model=EnduranceOut)
async def get_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(EnduranceActivity).where(
            EnduranceActivity.id == activity_id,
            EnduranceActivity.user_id == current_user.id,
        )
    )
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    return EnduranceOut.from_orm_with_computed(activity)


@router.post("/", response_model=EnduranceOut, status_code=201)
async def create_activity(
    data: EnduranceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    activity = EnduranceActivity(user_id=current_user.id, **data.model_dump())
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return EnduranceOut.from_orm_with_computed(activity)


@router.put("/{activity_id}", response_model=EnduranceOut)
async def update_activity(
    activity_id: int,
    data: EnduranceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(EnduranceActivity).where(
            EnduranceActivity.id == activity_id,
            EnduranceActivity.user_id == current_user.id,
        )
    )
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(activity, field, value)

    await db.commit()
    await db.refresh(activity)
    return EnduranceOut.from_orm_with_computed(activity)


@router.delete("/{activity_id}", status_code=204)
async def delete_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(EnduranceActivity).where(
            EnduranceActivity.id == activity_id,
            EnduranceActivity.user_id == current_user.id,
        )
    )
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")

    await db.delete(activity)
    await db.commit()
