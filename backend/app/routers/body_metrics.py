from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db import get_db
from app.models.body_metric import BodyMetric
from app.models.user import User
from app.schemas.body_metric import BodyMetricCreate, BodyMetricOut, BodyMetricUpdate

router = APIRouter()


@router.get("/", response_model=list[BodyMetricOut])
async def list_body_metrics(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(BodyMetric)
        .where(BodyMetric.user_id == current_user.id)
        .order_by(desc(BodyMetric.date))
    )
    if date_from:
        stmt = stmt.where(BodyMetric.date >= date_from)
    if date_to:
        stmt = stmt.where(BodyMetric.date <= date_to)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/latest", response_model=BodyMetricOut)
async def get_latest_body_metric(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(BodyMetric)
        .where(BodyMetric.user_id == current_user.id)
        .order_by(desc(BodyMetric.date))
        .limit(1)
    )
    result = await db.execute(stmt)
    metric = result.scalar_one_or_none()
    if not metric:
        raise HTTPException(status_code=404, detail="No body metrics recorded yet")
    return metric


@router.post("/", response_model=BodyMetricOut, status_code=201)
async def create_body_metric(
    data: BodyMetricCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    metric = BodyMetric(user_id=current_user.id, **data.model_dump())
    db.add(metric)
    await db.commit()
    await db.refresh(metric)
    return metric


@router.put("/{metric_id}", response_model=BodyMetricOut)
async def update_body_metric(
    metric_id: int,
    data: BodyMetricUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BodyMetric).where(BodyMetric.id == metric_id, BodyMetric.user_id == current_user.id)
    )
    metric = result.scalar_one_or_none()
    if not metric:
        raise HTTPException(status_code=404, detail="Body metric not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(metric, key, value)

    await db.commit()
    await db.refresh(metric)
    return metric


@router.delete("/{metric_id}", status_code=204)
async def delete_body_metric(
    metric_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BodyMetric).where(BodyMetric.id == metric_id, BodyMetric.user_id == current_user.id)
    )
    metric = result.scalar_one_or_none()
    if not metric:
        raise HTTPException(status_code=404, detail="Body metric not found")
    await db.delete(metric)
    await db.commit()
