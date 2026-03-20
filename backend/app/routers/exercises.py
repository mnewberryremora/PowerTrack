from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.exercise import Exercise
from app.schemas.exercise import ExerciseCreate, ExerciseOut, ExerciseUpdate

router = APIRouter()


@router.get("/", response_model=list[ExerciseOut])
async def list_exercises(
    category: str | None = Query(None, description="Filter by category"),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Exercise).order_by(Exercise.name)
    if category:
        stmt = stmt.where(Exercise.category == category)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{exercise_id}", response_model=ExerciseOut)
async def get_exercise(exercise_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Exercise).where(Exercise.id == exercise_id))
    exercise = result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return exercise


@router.post("/", response_model=ExerciseOut, status_code=201)
async def create_exercise(data: ExerciseCreate, db: AsyncSession = Depends(get_db)):
    exercise = Exercise(**data.model_dump())
    db.add(exercise)
    await db.commit()
    await db.refresh(exercise)
    return exercise


@router.put("/{exercise_id}", response_model=ExerciseOut)
async def update_exercise(
    exercise_id: int, data: ExerciseUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Exercise).where(Exercise.id == exercise_id))
    exercise = result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(exercise, key, value)

    await db.commit()
    await db.refresh(exercise)
    return exercise


@router.delete("/{exercise_id}", status_code=204)
async def delete_exercise(exercise_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Exercise).where(Exercise.id == exercise_id))
    exercise = result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    if not exercise.is_custom:
        raise HTTPException(status_code=400, detail="Only custom exercises can be deleted")

    await db.delete(exercise)
    await db.commit()
