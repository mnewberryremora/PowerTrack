from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db import get_db
from app.models.pr import PersonalRecord
from app.models.exercise import Exercise
from app.models.user import User
from app.schemas.pr import PROut
from app.services.pr_detection import recalculate_user_prs

router = APIRouter()


@router.get("/", response_model=list[PROut])
async def list_alltime_best_prs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    best = (
        select(
            PersonalRecord.exercise_id,
            PersonalRecord.rep_count,
            func.max(PersonalRecord.weight_lbs).label("max_weight"),
        )
        .where(PersonalRecord.user_id == current_user.id)
        .group_by(PersonalRecord.exercise_id, PersonalRecord.rep_count)
        .subquery()
    )

    stmt = (
        select(PersonalRecord, Exercise.name.label("exercise_name"))
        .join(Exercise, PersonalRecord.exercise_id == Exercise.id)
        .join(
            best,
            (PersonalRecord.exercise_id == best.c.exercise_id)
            & (PersonalRecord.rep_count == best.c.rep_count)
            & (PersonalRecord.weight_lbs == best.c.max_weight),
        )
        .where(PersonalRecord.user_id == current_user.id)
        .order_by(Exercise.name, PersonalRecord.rep_count)
    )
    result = await db.execute(stmt)
    rows = result.all()
    seen: set[tuple[int, int]] = set()
    out: list[PROut] = []
    for pr, exercise_name in rows:
        key = (pr.exercise_id, pr.rep_count)
        if key in seen:
            continue
        seen.add(key)
        out.append(PROut(**{**pr.__dict__, "exercise_name": exercise_name}))
    return out


@router.get("/exercise/{exercise_id}", response_model=list[PROut])
async def get_exercise_prs(
    exercise_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(PersonalRecord, Exercise.name.label("exercise_name"))
        .join(Exercise, PersonalRecord.exercise_id == Exercise.id)
        .where(
            PersonalRecord.exercise_id == exercise_id,
            PersonalRecord.user_id == current_user.id,
        )
        .order_by(PersonalRecord.rep_count, desc(PersonalRecord.date))
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [PROut(**{**pr.__dict__, "exercise_name": exercise_name}) for pr, exercise_name in rows]


@router.get("/recent", response_model=list[PROut])
async def get_recent_prs(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cutoff = date.today() - timedelta(days=days)
    stmt = (
        select(PersonalRecord, Exercise.name.label("exercise_name"))
        .join(Exercise, PersonalRecord.exercise_id == Exercise.id)
        .where(
            PersonalRecord.date >= cutoff,
            PersonalRecord.user_id == current_user.id,
        )
        .order_by(desc(PersonalRecord.date))
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [PROut(**{**pr.__dict__, "exercise_name": exercise_name}) for pr, exercise_name in rows]


@router.delete("/{pr_id}")
async def delete_pr(
    pr_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PersonalRecord).where(PersonalRecord.id == pr_id, PersonalRecord.user_id == current_user.id)
    )
    pr = result.scalar_one_or_none()
    if not pr:
        raise HTTPException(status_code=404, detail="PR not found")
    await db.delete(pr)
    await db.commit()
    return {"ok": True}


@router.post("/recalculate")
async def recalculate_all_prs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rebuild all PRs from actual set data for the current user."""
    new_count = await recalculate_user_prs(db, current_user.id)
    await db.commit()
    return {"ok": True, "prs_created": new_count}
