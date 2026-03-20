from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db import get_db
from app.models.pr import PersonalRecord
from app.models.exercise import Exercise
from app.models.user import User
from app.models.workout import Set, WorkoutExercise, Workout
from app.schemas.pr import PROut
from app.services.pr_detection import epley_e1rm

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
    await db.execute(delete(PersonalRecord).where(PersonalRecord.user_id == current_user.id))
    await db.flush()

    all_sets_result = await db.execute(select(Set).where(Set.is_pr.is_(True)))
    # Only reset is_pr on sets belonging to current user's workouts
    user_workout_ids_stmt = select(Workout.id).where(Workout.user_id == current_user.id)
    user_sets_result = await db.execute(
        select(Set)
        .join(WorkoutExercise, Set.workout_exercise_id == WorkoutExercise.id)
        .where(
            Set.is_pr.is_(True),
            WorkoutExercise.workout_id.in_(user_workout_ids_stmt),
        )
    )
    for s in user_sets_result.scalars().all():
        s.is_pr = False
        s.e1rm_lbs = None
    await db.flush()

    stmt = (
        select(Set, WorkoutExercise, Workout)
        .join(WorkoutExercise, Set.workout_exercise_id == WorkoutExercise.id)
        .join(Workout, WorkoutExercise.workout_id == Workout.id)
        .where(Workout.user_id == current_user.id, Set.set_type != "warmup")
        .order_by(Workout.date, Set.id)
    )
    result = await db.execute(stmt)
    rows = result.all()

    best: dict[tuple[int, int], dict] = {}
    for set_row, we_row, workout_row in rows:
        exercise_id = we_row.exercise_id
        rep_count = set_row.reps
        weight = float(set_row.weight_lbs)
        key = (exercise_id, rep_count)
        current = best.get(key)
        if current is None or weight > current["weight"]:
            best[key] = {
                "weight": weight,
                "set_row": set_row,
                "exercise_id": exercise_id,
                "rep_count": rep_count,
                "date": workout_row.date,
                "previous_weight": current["weight"] if current else None,
            }

    new_count = 0
    for key, info in best.items():
        e1rm = Decimal(str(epley_e1rm(info["weight"], info["rep_count"])))
        pr = PersonalRecord(
            user_id=current_user.id,
            exercise_id=info["exercise_id"],
            set_id=info["set_row"].id,
            rep_count=info["rep_count"],
            weight_lbs=Decimal(str(info["weight"])),
            e1rm_lbs=e1rm,
            date=info["date"],
            previous_weight_lbs=Decimal(str(info["previous_weight"])) if info["previous_weight"] else None,
        )
        db.add(pr)
        info["set_row"].is_pr = True
        info["set_row"].e1rm_lbs = e1rm
        new_count += 1

    await db.commit()
    return {"ok": True, "prs_created": new_count}
