"""Analytics queries for training data visualization."""

from datetime import date, timedelta
from typing import Any

from sqlalchemy import select, func, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    BodyMetric, Exercise, Meet, PersonalRecord,
    Set, Workout, WorkoutExercise,
)
from app.services.dots import calculate_dots, lbs_to_kg
from app.services.pr_detection import epley_e1rm


async def get_volume_data(
    db: AsyncSession,
    user_id: int,
    exercise_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict[str, Any]]:
    if not start_date:
        start_date = date.today() - timedelta(weeks=12)
    if not end_date:
        end_date = date.today()

    conditions = [
        Workout.user_id == user_id,
        Workout.date >= start_date,
        Workout.date <= end_date,
        Set.set_type != "warmup",
    ]
    if exercise_id:
        conditions.append(WorkoutExercise.exercise_id == exercise_id)

    stmt = (
        select(
            Workout.date,
            func.sum(Set.weight_lbs * Set.reps).label("volume"),
            func.count(Set.id).label("total_sets"),
        )
        .join(WorkoutExercise, Workout.id == WorkoutExercise.workout_id)
        .join(Set, WorkoutExercise.id == Set.workout_exercise_id)
        .where(and_(*conditions))
        .group_by(Workout.date)
        .order_by(Workout.date)
    )
    result = await db.execute(stmt)
    return [
        {"date": str(row.date), "volume": float(row.volume or 0), "sets": row.total_sets}
        for row in result.all()
    ]


async def get_intensity_data(
    db: AsyncSession,
    user_id: int,
    exercise_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict[str, Any]]:
    if not start_date:
        start_date = date.today() - timedelta(weeks=12)
    if not end_date:
        end_date = date.today()

    conditions = [
        Workout.user_id == user_id,
        Workout.date >= start_date,
        Workout.date <= end_date,
        Set.set_type == "working",
    ]
    if exercise_id:
        conditions.append(WorkoutExercise.exercise_id == exercise_id)

    stmt = (
        select(
            Workout.date,
            func.avg(Set.rpe).label("avg_rpe"),
            func.avg(Set.weight_lbs).label("avg_weight"),
            func.max(Set.weight_lbs).label("max_weight"),
        )
        .join(WorkoutExercise, Workout.id == WorkoutExercise.workout_id)
        .join(Set, WorkoutExercise.id == Set.workout_exercise_id)
        .where(and_(*conditions))
        .group_by(Workout.date)
        .order_by(Workout.date)
    )
    result = await db.execute(stmt)
    return [
        {
            "date": str(row.date),
            "avg_rpe": round(float(row.avg_rpe), 1) if row.avg_rpe else None,
            "avg_weight": round(float(row.avg_weight), 1) if row.avg_weight else 0,
            "max_weight": float(row.max_weight or 0),
        }
        for row in result.all()
    ]


async def get_e1rm_progression(
    db: AsyncSession,
    user_id: int,
    exercise_id: int,
) -> list[dict[str, Any]]:
    stmt = (
        select(
            Workout.date,
            func.max(Set.e1rm_lbs).label("best_e1rm"),
            func.max(Set.weight_lbs).label("best_weight"),
        )
        .join(WorkoutExercise, Workout.id == WorkoutExercise.workout_id)
        .join(Set, WorkoutExercise.id == Set.workout_exercise_id)
        .where(
            and_(
                Workout.user_id == user_id,
                WorkoutExercise.exercise_id == exercise_id,
                Set.set_type != "warmup",
            )
        )
        .group_by(Workout.date)
        .order_by(Workout.date)
    )
    result = await db.execute(stmt)
    data = []
    for row in result.all():
        e1rm = float(row.best_e1rm) if row.best_e1rm else None
        best_weight = float(row.best_weight or 0)
        if e1rm is None and best_weight > 0:
            e1rm = best_weight
        data.append({"date": str(row.date), "e1rm": e1rm, "best_weight": best_weight})
    return data


async def get_dots_history(db: AsyncSession, user_id: int) -> list[dict[str, Any]]:
    comp_result = await db.execute(
        select(Exercise.id).where(Exercise.is_competition.is_(True))
    )
    comp_ids = [row[0] for row in comp_result.all()]

    if len(comp_ids) < 3:
        return []

    data: list[dict[str, Any]] = []
    seen_dates: set[str] = set()

    bm_result = await db.execute(
        select(BodyMetric)
        .where(BodyMetric.user_id == user_id)
        .order_by(BodyMetric.date)
    )
    metrics = bm_result.scalars().all()

    for bm in metrics:
        if not bm.bodyweight_lbs:
            continue
        total_lbs = 0.0
        lifts_found = 0
        for ex_id in comp_ids:
            pr_stmt = (
                select(func.max(PersonalRecord.weight_lbs))
                .where(
                    and_(
                        PersonalRecord.user_id == user_id,
                        PersonalRecord.exercise_id == ex_id,
                        PersonalRecord.rep_count == 1,
                        PersonalRecord.date <= bm.date,
                    )
                )
            )
            pr_result = await db.execute(pr_stmt)
            best = pr_result.scalar()
            if best:
                total_lbs += float(best)
                lifts_found += 1

        if lifts_found == len(comp_ids) and total_lbs > 0:
            bw_kg = lbs_to_kg(float(bm.bodyweight_lbs))
            dots = calculate_dots(lbs_to_kg(total_lbs), bw_kg)
            date_str = str(bm.date)
            seen_dates.add(date_str)
            data.append({"date": date_str, "dots": dots, "bodyweight_lbs": float(bm.bodyweight_lbs), "total_lbs": total_lbs})

    # Build a sorted list of (date_str, bodyweight_lbs) from body metrics for lookups
    bm_bw_by_date = [(str(bm.date), float(bm.bodyweight_lbs)) for bm in metrics if bm.bodyweight_lbs]

    def nearest_bm_bw(workout_date_str: str) -> float | None:
        """Return the most recent body metric bodyweight on or before the given date."""
        result = None
        for d, bw in bm_bw_by_date:
            if d <= workout_date_str:
                result = bw
            else:
                break
        return result

    comp_id_set = set(comp_ids)
    workout_result = await db.execute(
        select(Workout)
        .where(and_(Workout.user_id == user_id, Workout.completed.is_(True)))
        .order_by(Workout.date)
    )
    for w in workout_result.scalars().all():
        date_str = str(w.date)
        if date_str in seen_dates:
            continue
        we_result = await db.execute(
            select(WorkoutExercise.exercise_id).where(WorkoutExercise.workout_id == w.id)
        )
        workout_ex_ids = {row[0] for row in we_result.all()}
        if not comp_id_set.issubset(workout_ex_ids):
            continue
        bw = nearest_bm_bw(date_str)
        if not bw:
            continue
        total_lbs = 0.0
        for ex_id in comp_ids:
            best_result = await db.execute(
                select(func.max(Set.weight_lbs))
                .join(WorkoutExercise, Set.workout_exercise_id == WorkoutExercise.id)
                .where(and_(
                    WorkoutExercise.workout_id == w.id,
                    WorkoutExercise.exercise_id == ex_id,
                    Set.set_type != "warmup",
                ))
            )
            best = best_result.scalar()
            if best:
                total_lbs += float(best)
        if total_lbs > 0:
            dots = calculate_dots(lbs_to_kg(total_lbs), lbs_to_kg(bw))
            seen_dates.add(date_str)
            data.append({"date": date_str, "dots": dots, "bodyweight_lbs": bw, "total_lbs": total_lbs})

    data.sort(key=lambda x: x["date"])

    # Current DOTS: use the most recent 1-rep working set per lift and the
    # bodyweight from the workout where that single was performed.
    current_total = 0.0
    current_bw_candidates: list[float] = []
    for ex_id in comp_ids:
        row = (await db.execute(
            select(Set.weight_lbs, Workout.bodyweight_lbs)
            .join(WorkoutExercise, Set.workout_exercise_id == WorkoutExercise.id)
            .join(Workout, WorkoutExercise.workout_id == Workout.id)
            .where(and_(
                Workout.user_id == user_id,
                WorkoutExercise.exercise_id == ex_id,
                Set.reps == 1,
                Set.set_type != "warmup",
            ))
            .order_by(desc(Workout.date), desc(Set.weight_lbs))
            .limit(1)
        )).first()
        if row:
            current_total += float(row[0])
            if row[1]:
                current_bw_candidates.append(float(row[1]))
        else:
            # Fall back to best e1RM if no single-rep sets exist
            best = (await db.execute(
                select(func.max(PersonalRecord.e1rm_lbs))
                .where(and_(PersonalRecord.user_id == user_id, PersonalRecord.exercise_id == ex_id))
            )).scalar()
            if best:
                current_total += float(best)

    # Prefer workout bodyweight from the most recent single; fall back to body metrics
    current_bw = current_bw_candidates[0] if current_bw_candidates else (
        float(metrics[-1].bodyweight_lbs) if metrics and metrics[-1].bodyweight_lbs else None
    )

    if current_total > 0 and current_bw:
        dots = calculate_dots(lbs_to_kg(current_total), lbs_to_kg(current_bw))
        today_str = str(date.today())
        if data and data[-1].get("is_current"):
            data[-1] = {"date": today_str, "dots": dots, "bodyweight_lbs": current_bw, "total_lbs": current_total, "is_current": True}
        else:
            data.append({"date": today_str, "dots": dots, "bodyweight_lbs": current_bw, "total_lbs": current_total, "is_current": True})

    return data


async def get_bodyweight_data(
    db: AsyncSession,
    user_id: int,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict[str, Any]]:
    conditions = [BodyMetric.user_id == user_id]
    if start_date:
        conditions.append(BodyMetric.date >= start_date)
    if end_date:
        conditions.append(BodyMetric.date <= end_date)

    result = await db.execute(
        select(BodyMetric).where(and_(*conditions)).order_by(BodyMetric.date)
    )
    return [
        {
            "date": str(bm.date),
            "bodyweight_lbs": float(bm.bodyweight_lbs) if bm.bodyweight_lbs else None,
            "body_fat_pct": float(bm.body_fat_pct) if bm.body_fat_pct else None,
        }
        for bm in result.scalars().all()
    ]


async def get_summary(db: AsyncSession, user_id: int) -> dict[str, Any]:
    total_workouts = (await db.execute(
        select(func.count(Workout.id)).where(Workout.user_id == user_id)
    )).scalar() or 0

    from datetime import timedelta
    week_start = date.today() - timedelta(days=date.today().weekday())
    workouts_this_week = (await db.execute(
        select(func.count(Workout.id)).where(Workout.user_id == user_id, Workout.date >= week_start)
    )).scalar() or 0

    latest_bm = (await db.execute(
        select(BodyMetric).where(BodyMetric.user_id == user_id).order_by(desc(BodyMetric.date)).limit(1)
    )).scalar_one_or_none()

    comp_exercises = (await db.execute(
        select(Exercise).where(Exercise.is_competition.is_(True))
    )).scalars().all()

    prs = {}
    total_lbs = 0.0
    for ex in comp_exercises:
        pr = (await db.execute(
            select(PersonalRecord)
            .where(PersonalRecord.user_id == user_id, PersonalRecord.exercise_id == ex.id, PersonalRecord.rep_count == 1)
            .order_by(desc(PersonalRecord.weight_lbs))
            .limit(1)
        )).scalar_one_or_none()
        if pr:
            prs[ex.name] = {"weight_lbs": float(pr.weight_lbs), "date": str(pr.date)}
            total_lbs += float(pr.weight_lbs)

    dots = None
    if latest_bm and latest_bm.bodyweight_lbs and total_lbs > 0:
        dots = calculate_dots(lbs_to_kg(total_lbs), lbs_to_kg(float(latest_bm.bodyweight_lbs)))

    thirty_days_ago = date.today() - timedelta(days=30)
    recent_pr_count = (await db.execute(
        select(func.count(PersonalRecord.id))
        .where(PersonalRecord.user_id == user_id, PersonalRecord.date >= thirty_days_ago)
    )).scalar() or 0

    next_meet = (await db.execute(
        select(Meet)
        .where(Meet.user_id == user_id, Meet.status == "planned", Meet.date >= date.today())
        .order_by(Meet.date)
        .limit(1)
    )).scalar_one_or_none()

    return {
        "total_workouts": total_workouts,
        "workouts_this_week": workouts_this_week,
        "bodyweight_lbs": float(latest_bm.bodyweight_lbs) if latest_bm and latest_bm.bodyweight_lbs else None,
        "body_fat_pct": float(latest_bm.body_fat_pct) if latest_bm and latest_bm.body_fat_pct else None,
        "competition_prs": prs,
        "total_lbs": total_lbs,
        "dots_score": dots,
        "recent_pr_count": recent_pr_count,
        "next_meet": {
            "name": next_meet.name,
            "date": str(next_meet.date),
            "days_out": (next_meet.date - date.today()).days,
        } if next_meet else None,
    }
