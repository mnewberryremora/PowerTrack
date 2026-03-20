from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db import get_db
from app.models.meet import Meet
from app.models.user import User

# ---------- Inline schemas ----------


class MeetCreate(BaseModel):
    name: str
    date: date
    location: str | None = None
    federation: str = "USPA"
    weight_class_kg: float | None = None
    status: str = "planned"
    squat_opener_lbs: float | None = None
    bench_opener_lbs: float | None = None
    deadlift_opener_lbs: float | None = None
    actual_results: dict | None = None
    notes: str | None = None


class MeetUpdate(BaseModel):
    name: str | None = None
    date: date | None = None
    location: str | None = None
    federation: str | None = None
    weight_class_kg: float | None = None
    status: str | None = None
    squat_opener_lbs: float | None = None
    bench_opener_lbs: float | None = None
    deadlift_opener_lbs: float | None = None
    actual_results: dict | None = None
    notes: str | None = None


class MeetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    date: date
    location: str | None = None
    federation: str
    weight_class_kg: float | None = None
    status: str
    squat_opener_lbs: float | None = None
    bench_opener_lbs: float | None = None
    deadlift_opener_lbs: float | None = None
    actual_results: dict | None = None
    notes: str | None = None
    created_at: datetime


# ---------- Router ----------

router = APIRouter()


@router.get("/", response_model=list[MeetOut])
async def list_meets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Meet).where(Meet.user_id == current_user.id).order_by(desc(Meet.date))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/next", response_model=MeetOut | None)
async def get_next_meet(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Meet)
        .where(Meet.user_id == current_user.id, Meet.date >= date.today(), Meet.status != "completed")
        .order_by(Meet.date)
        .limit(1)
    )
    result = await db.execute(stmt)
    meet = result.scalar_one_or_none()
    if not meet:
        raise HTTPException(status_code=404, detail="No upcoming meet found")
    return meet


@router.get("/{meet_id}", response_model=MeetOut)
async def get_meet(
    meet_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Meet).where(Meet.id == meet_id, Meet.user_id == current_user.id)
    )
    meet = result.scalar_one_or_none()
    if not meet:
        raise HTTPException(status_code=404, detail="Meet not found")
    return meet


@router.post("/", response_model=MeetOut, status_code=201)
async def create_meet(
    data: MeetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meet = Meet(user_id=current_user.id, **data.model_dump())
    db.add(meet)
    await db.commit()
    await db.refresh(meet)
    return meet


@router.put("/{meet_id}", response_model=MeetOut)
async def update_meet(
    meet_id: int,
    data: MeetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Meet).where(Meet.id == meet_id, Meet.user_id == current_user.id)
    )
    meet = result.scalar_one_or_none()
    if not meet:
        raise HTTPException(status_code=404, detail="Meet not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(meet, key, value)

    await db.commit()
    await db.refresh(meet)
    return meet


@router.delete("/{meet_id}", status_code=204)
async def delete_meet(
    meet_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Meet).where(Meet.id == meet_id, Meet.user_id == current_user.id)
    )
    meet = result.scalar_one_or_none()
    if not meet:
        raise HTTPException(status_code=404, detail="Meet not found")
    await db.delete(meet)
    await db.commit()
