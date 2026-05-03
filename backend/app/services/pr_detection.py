from datetime import date as date_type
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func

from app.models import BodyMetric, Exercise, PersonalRecord, Set, WorkoutExercise, Workout


def epley_e1rm(weight: float, reps: int) -> float:
    """Epley formula: weight * (1 + reps/30). For 1 rep, e1rm = weight."""
    if reps <= 0:
        return 0
    if reps == 1:
        return float(weight)
    return round(float(weight) * (1 + reps / 30), 1)


def is_bodyweight_exercise(equipment: str | None) -> bool:
    return (equipment or "").strip().lower() == "bodyweight"


def effective_load(
    weight: float,
    equipment: str | None,
    bodyweight: float | None,
) -> float:
    """Per-rep load used for volume. Bodyweight exercises with known BW
    use (BW + listed weight); otherwise just the listed weight."""
    if is_bodyweight_exercise(equipment) and bodyweight and bodyweight > 0:
        return float(weight) + float(bodyweight)
    return float(weight)


def effective_e1rm(
    weight: float,
    reps: int,
    equipment: str | None,
    bodyweight: float | None,
) -> float:
    """Estimated 1RM. Bodyweight exercises with known BW apply Epley to
    (BW + weight) and subtract BW so the value stays in the same units the
    user entered (added weight, where 0 means bodyweight-only)."""
    if reps <= 0:
        return 0
    if is_bodyweight_exercise(equipment) and bodyweight and bodyweight > 0:
        bw = float(bodyweight)
        total = epley_e1rm(bw + float(weight), reps)
        return round(total - bw, 1)
    return epley_e1rm(float(weight), reps)


async def resolve_workout_bodyweight(
    db: AsyncSession, user_id: int, workout: Workout
) -> float | None:
    """Bodyweight to use for this workout: workout.bodyweight_lbs first,
    else most recent BodyMetric on or before the workout date."""
    if workout.bodyweight_lbs:
        return float(workout.bodyweight_lbs)
    bm = (await db.execute(
        select(BodyMetric)
        .where(
            BodyMetric.user_id == user_id,
            BodyMetric.bodyweight_lbs.is_not(None),
            BodyMetric.date <= workout.date,
        )
        .order_by(desc(BodyMetric.date))
        .limit(1)
    )).scalar_one_or_none()
    if bm and bm.bodyweight_lbs:
        return float(bm.bodyweight_lbs)
    return None


async def detect_prs(db: AsyncSession, workout_id: int, user_id: int) -> list[dict]:
    """After workout completion, check each working set for PRs (scoped to user)."""
    workout = await db.get(Workout, workout_id)
    if workout is None:
        return []
    workout_date = workout.date
    bodyweight = await resolve_workout_bodyweight(db, user_id, workout)

    stmt = (
        select(Set, WorkoutExercise, Exercise)
        .join(WorkoutExercise, Set.workout_exercise_id == WorkoutExercise.id)
        .join(Exercise, WorkoutExercise.exercise_id == Exercise.id)
        .where(WorkoutExercise.workout_id == workout_id)
        .where(Set.set_type != "warmup")
    )
    result = await db.execute(stmt)
    rows = result.all()

    new_prs: list[dict] = []

    for set_row, we_row, ex_row in rows:
        exercise_id = we_row.exercise_id
        rep_count = set_row.reps
        weight = set_row.weight_lbs

        best_stmt = (
            select(func.max(PersonalRecord.weight_lbs))
            .where(
                and_(
                    PersonalRecord.user_id == user_id,
                    PersonalRecord.exercise_id == exercise_id,
                    PersonalRecord.rep_count == rep_count,
                )
            )
        )
        best_result = await db.execute(best_stmt)
        current_best = best_result.scalar()

        if current_best is None or weight > current_best:
            previous_weight = current_best
            e1rm = Decimal(str(effective_e1rm(
                float(weight), rep_count, ex_row.equipment, bodyweight
            )))

            set_row.is_pr = True
            set_row.e1rm_lbs = e1rm

            pr = PersonalRecord(
                user_id=user_id,
                exercise_id=exercise_id,
                set_id=set_row.id,
                rep_count=rep_count,
                weight_lbs=weight,
                e1rm_lbs=e1rm,
                date=workout_date,
                previous_weight_lbs=previous_weight,
            )
            db.add(pr)

            new_prs.append({
                "exercise_id": exercise_id,
                "rep_count": rep_count,
                "weight_lbs": float(weight),
                "previous_weight_lbs": float(previous_weight) if previous_weight else None,
                "e1rm_lbs": float(e1rm),
                "set_id": set_row.id,
            })

    if new_prs:
        await db.flush()

    return new_prs


async def recalculate_user_prs(db: AsyncSession, user_id: int) -> int:
    """Rebuild all PRs from set data for the given user. Returns count of PRs created."""
    from sqlalchemy import delete

    await db.execute(delete(PersonalRecord).where(PersonalRecord.user_id == user_id))
    await db.flush()

    user_workout_ids_stmt = select(Workout.id).where(Workout.user_id == user_id)
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

    bm_rows = (await db.execute(
        select(BodyMetric.date, BodyMetric.bodyweight_lbs)
        .where(
            BodyMetric.user_id == user_id,
            BodyMetric.bodyweight_lbs.is_not(None),
        )
        .order_by(BodyMetric.date)
    )).all()
    bm_list: list[tuple[date_type, float]] = [
        (r.date, float(r.bodyweight_lbs)) for r in bm_rows
    ]

    def bw_for_date(d: date_type) -> float | None:
        result = None
        for bm_date, bw in bm_list:
            if bm_date <= d:
                result = bw
            else:
                break
        return result

    stmt = (
        select(Set, WorkoutExercise, Workout, Exercise)
        .join(WorkoutExercise, Set.workout_exercise_id == WorkoutExercise.id)
        .join(Workout, WorkoutExercise.workout_id == Workout.id)
        .join(Exercise, WorkoutExercise.exercise_id == Exercise.id)
        .where(Workout.user_id == user_id, Set.set_type != "warmup")
        .order_by(Workout.date, Set.id)
    )
    result = await db.execute(stmt)
    rows = result.all()

    best: dict[tuple[int, int], dict] = {}
    for set_row, we_row, workout_row, ex_row in rows:
        exercise_id = we_row.exercise_id
        rep_count = set_row.reps
        weight = float(set_row.weight_lbs)
        key = (exercise_id, rep_count)
        current = best.get(key)
        if current is None or weight > current["weight"]:
            bw = float(workout_row.bodyweight_lbs) if workout_row.bodyweight_lbs else bw_for_date(workout_row.date)
            best[key] = {
                "weight": weight,
                "set_row": set_row,
                "exercise_id": exercise_id,
                "rep_count": rep_count,
                "date": workout_row.date,
                "previous_weight": current["weight"] if current else None,
                "equipment": ex_row.equipment,
                "bodyweight": bw,
            }

    new_count = 0
    for info in best.values():
        e1rm = Decimal(str(effective_e1rm(
            info["weight"], info["rep_count"], info["equipment"], info["bodyweight"]
        )))
        pr = PersonalRecord(
            user_id=user_id,
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

    await db.flush()
    return new_count
