from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db import get_db
from app.models.user import User
from app.services.analytics import (
    get_bodyweight_data,
    get_dots_history,
    get_e1rm_progression,
    get_intensity_data,
    get_summary,
    get_volume_data,
)

router = APIRouter()


@router.get("/volume")
async def volume_analytics(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    exercise_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = await get_volume_data(db, current_user.id, exercise_id, date_from, date_to)
    return {"data": data}


@router.get("/intensity")
async def intensity_analytics(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    exercise_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = await get_intensity_data(db, current_user.id, exercise_id, date_from, date_to)
    return {"data": data}


@router.get("/e1rm")
async def e1rm_analytics(
    exercise_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = await get_e1rm_progression(db, current_user.id, exercise_id)
    return {"data": data}


@router.get("/dots")
async def dots_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = await get_dots_history(db, current_user.id)
    return {"data": data}


@router.get("/bodyweight")
async def bodyweight_analytics(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = await get_bodyweight_data(db, current_user.id, date_from, date_to)
    return {"data": data}


@router.get("/summary")
async def analytics_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_summary(db, current_user.id)
