from decimal import Decimal
from datetime import date as date_today

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.models import PersonalRecord, Set, WorkoutExercise, Workout


def epley_e1rm(weight: float, reps: int) -> float:
    """Epley formula: weight * (1 + reps/30). For 1 rep, e1rm = weight."""
    if reps <= 0:
        return 0
    if reps == 1:
        return float(weight)
    return round(float(weight) * (1 + reps / 30), 1)


async def detect_prs(db: AsyncSession, workout_id: int, user_id: int) -> list[dict]:
    """After workout completion, check each working set for PRs (scoped to user)."""
    stmt = (
        select(Set, WorkoutExercise)
        .join(WorkoutExercise, Set.workout_exercise_id == WorkoutExercise.id)
        .where(WorkoutExercise.workout_id == workout_id)
        .where(Set.set_type != "warmup")
    )
    result = await db.execute(stmt)
    rows = result.all()

    workout = await db.get(Workout, workout_id)
    if workout is None:
        return []
    workout_date = workout.date

    new_prs: list[dict] = []

    for set_row, we_row in rows:
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
            e1rm = Decimal(str(epley_e1rm(float(weight), rep_count)))

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
