import io
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user
from app.db import get_db
from app.models.user import User
from app.models.workout import Workout, WorkoutExercise, Set
from app.models.pr import PersonalRecord
from app.schemas.workout import (
    WorkoutCreate,
    WorkoutOut,
    WorkoutSummary,
    ImportConfirmRequest,
    ImportPreviewResponse,
    ImportResult,
)
from app.services.xlsx_import import parse_xlsx, create_workouts_from_import, generate_template

router = APIRouter()


@router.get("/", response_model=list[WorkoutSummary])
async def list_workouts(
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Workout)
        .where(Workout.user_id == current_user.id)
        .options(selectinload(Workout.exercises).selectinload(WorkoutExercise.sets))
        .order_by(desc(Workout.date))
    )
    if start_date:
        stmt = stmt.where(Workout.date >= start_date)
    if end_date:
        stmt = stmt.where(Workout.date <= end_date)
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    workouts_list = result.scalars().all()

    summaries = []
    for w in workouts_list:
        exercise_count = len(w.exercises)
        total_volume = sum(
            float(s.weight_lbs) * s.reps
            for we in w.exercises
            for s in we.sets
        )
        if w.completed:
            status = "completed"
        elif exercise_count > 0:
            status = "in_progress"
        else:
            status = "planned"
        summaries.append(WorkoutSummary(
            id=w.id,
            date=w.date,
            name=w.name,
            status=status,
            exercise_count=exercise_count,
            total_volume_lbs=round(total_volume, 1),
            duration_minutes=w.duration_minutes,
        ))
    return summaries


@router.get("/{workout_id}", response_model=WorkoutOut)
async def get_workout(
    workout_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Workout)
        .where(Workout.id == workout_id, Workout.user_id == current_user.id)
        .options(
            selectinload(Workout.exercises).selectinload(WorkoutExercise.sets),
            selectinload(Workout.exercises).selectinload(WorkoutExercise.exercise),
        )
    )
    result = await db.execute(stmt)
    workout = result.scalar_one_or_none()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    return workout


@router.post("/", response_model=WorkoutOut, status_code=201)
async def create_workout(
    data: WorkoutCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workout = Workout(
        user_id=current_user.id,
        date=data.date,
        name=data.name,
        notes=data.notes,
        duration_minutes=data.duration_minutes,
        bodyweight_lbs=data.bodyweight_lbs,
        sleep_quality=data.sleep_quality,
        fatigue_level=data.fatigue_level,
        completed=data.completed,
        program_id=data.program_id,
        program_day_index=data.program_day_index,
    )
    db.add(workout)
    await db.flush()

    for we_data in data.exercises:
        we = WorkoutExercise(
            workout_id=workout.id,
            exercise_id=we_data.exercise_id,
            order_index=we_data.order_index,
            notes=we_data.notes,
        )
        db.add(we)
        await db.flush()

        for set_data in we_data.sets:
            s = Set(
                workout_exercise_id=we.id,
                set_number=set_data.set_number,
                weight_lbs=set_data.weight_lbs,
                reps=set_data.reps,
                rpe=set_data.rpe,
                set_type=set_data.set_type,
                notes=set_data.notes,
            )
            db.add(s)

    await db.commit()
    return await get_workout(workout.id, db, current_user)


@router.put("/{workout_id}", response_model=WorkoutOut)
async def update_workout(
    workout_id: int,
    data: WorkoutCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Workout).where(Workout.id == workout_id, Workout.user_id == current_user.id)
    result = await db.execute(stmt)
    workout = result.scalar_one_or_none()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    workout.date = data.date
    workout.name = data.name
    workout.notes = data.notes
    workout.duration_minutes = data.duration_minutes
    workout.bodyweight_lbs = data.bodyweight_lbs
    workout.sleep_quality = data.sleep_quality
    workout.fatigue_level = data.fatigue_level
    workout.completed = data.completed

    set_ids_stmt = (
        select(Set.id)
        .join(WorkoutExercise, Set.workout_exercise_id == WorkoutExercise.id)
        .where(WorkoutExercise.workout_id == workout_id)
    )
    pr_result = await db.execute(
        select(PersonalRecord).where(PersonalRecord.set_id.in_(set_ids_stmt))
    )
    for pr in pr_result.scalars().all():
        await db.delete(pr)
    await db.flush()

    existing = await db.execute(
        select(WorkoutExercise).where(WorkoutExercise.workout_id == workout_id)
    )
    for we in existing.scalars().all():
        await db.delete(we)
    await db.flush()

    for we_data in data.exercises:
        we = WorkoutExercise(
            workout_id=workout.id,
            exercise_id=we_data.exercise_id,
            order_index=we_data.order_index,
            notes=we_data.notes,
        )
        db.add(we)
        await db.flush()

        for set_data in we_data.sets:
            s = Set(
                workout_exercise_id=we.id,
                set_number=set_data.set_number,
                weight_lbs=set_data.weight_lbs,
                reps=set_data.reps,
                rpe=set_data.rpe,
                set_type=set_data.set_type,
                notes=set_data.notes,
            )
            db.add(s)

    await db.commit()
    return await get_workout(workout.id, db, current_user)


@router.delete("/{workout_id}", status_code=204)
async def delete_workout(
    workout_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Workout).where(Workout.id == workout_id, Workout.user_id == current_user.id)
    )
    workout = result.scalar_one_or_none()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    set_ids_stmt = (
        select(Set.id)
        .join(WorkoutExercise, Set.workout_exercise_id == WorkoutExercise.id)
        .where(WorkoutExercise.workout_id == workout_id)
    )
    pr_result = await db.execute(
        select(PersonalRecord).where(PersonalRecord.set_id.in_(set_ids_stmt))
    )
    for pr in pr_result.scalars().all():
        await db.delete(pr)
    await db.flush()

    await db.delete(workout)
    await db.commit()


@router.post("/{workout_id}/copy", response_model=WorkoutOut, status_code=201)
async def copy_workout(
    workout_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Duplicate a workout with all its exercises and sets, reset to today and not completed."""
    from datetime import date as date_type
    stmt = (
        select(Workout)
        .where(Workout.id == workout_id, Workout.user_id == current_user.id)
        .options(selectinload(Workout.exercises).selectinload(WorkoutExercise.sets))
    )
    result = await db.execute(stmt)
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404, detail="Workout not found")

    new_workout = Workout(
        user_id=current_user.id,
        date=date_type.today(),
        name=f"Copy of {original.name}" if original.name else "Copy of Workout",
        notes=original.notes,
        duration_minutes=original.duration_minutes,
        bodyweight_lbs=original.bodyweight_lbs,
        sleep_quality=original.sleep_quality,
        fatigue_level=original.fatigue_level,
        completed=False,
    )
    db.add(new_workout)
    await db.flush()

    for we in sorted(original.exercises, key=lambda x: x.order_index):
        new_we = WorkoutExercise(
            workout_id=new_workout.id,
            exercise_id=we.exercise_id,
            order_index=we.order_index,
            notes=we.notes,
        )
        db.add(new_we)
        await db.flush()

        for s in sorted(we.sets, key=lambda x: x.set_number):
            db.add(Set(
                workout_exercise_id=new_we.id,
                set_number=s.set_number,
                weight_lbs=s.weight_lbs,
                reps=s.reps,
                rpe=s.rpe,
                set_type=s.set_type,
                notes=s.notes,
            ))

    await db.commit()
    return await get_workout(new_workout.id, db, current_user)


@router.post("/{workout_id}/complete", response_model=WorkoutOut)
async def complete_workout(
    workout_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Workout)
        .where(Workout.id == workout_id, Workout.user_id == current_user.id)
        .options(
            selectinload(Workout.exercises).selectinload(WorkoutExercise.sets),
            selectinload(Workout.exercises).selectinload(WorkoutExercise.exercise),
        )
    )
    result = await db.execute(stmt)
    workout = result.scalar_one_or_none()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    workout.completed = True
    await db.commit()

    from app.services.pr_detection import detect_prs
    await detect_prs(db, workout_id, current_user.id)
    await db.commit()

    return await get_workout(workout_id, db, current_user)


# ---------- XLSX Import Endpoints ----------


@router.post("/import/preview", response_model=ImportPreviewResponse)
async def preview_import(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
    ):
        raise HTTPException(status_code=400, detail="Only .xlsx files are supported.")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        result = await parse_xlsx(file_bytes, db)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse XLSX file: {exc}")

    return result


@router.post("/import/confirm", response_model=ImportResult)
async def confirm_import(
    data: ImportConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not data.workouts:
        raise HTTPException(status_code=400, detail="No workouts to import.")

    import_data = [w.model_dump() for w in data.workouts]
    result = await create_workouts_from_import(db, import_data, data.exercise_map, current_user.id)

    from app.services.pr_detection import detect_prs
    for wid in result.get("created_workout_ids", []):
        try:
            await detect_prs(db, wid, current_user.id)
        except Exception:
            result.setdefault("errors", []).append(f"PR detection failed for workout {wid}")

    await db.commit()
    return result


@router.get("/import/template")
async def download_template(_: User = Depends(get_current_user)):
    content = generate_template()
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=training_log_template.xlsx"},
    )
