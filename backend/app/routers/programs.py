import json
from datetime import date as date_type, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, desc, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db import get_db
from app.models.program import Program
from app.models.workout import Workout, WorkoutExercise, Set as SetModel
from app.models.user import User
from app.services.ai_coach import ask_coach

# ---------- Inline schemas ----------


class ProgramCreate(BaseModel):
    name: str
    meet_id: int | None = None
    start_date: date_type | None = None
    end_date: date_type | None = None
    status: str = "draft"
    ai_generated: bool = False
    description: str | None = None
    program_data: dict


class ProgramUpdate(BaseModel):
    name: str | None = None
    meet_id: int | None = None
    start_date: date_type | None = None
    end_date: date_type | None = None
    status: str | None = None
    description: str | None = None
    program_data: dict | None = None


class ProgramOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    meet_id: int | None = None
    start_date: date_type | None = None
    end_date: date_type | None = None
    status: str
    ai_generated: bool
    description: str | None = None
    program_data: dict
    created_at: datetime


class ProgramGenerateRequest(BaseModel):
    meet_id: int | None = None
    goals: str = "Increase total and DOTS score"
    days_per_week: int = 4
    program_length_weeks: int = 12
    experience_level: str = "intermediate"
    weak_points: str | None = None


# ---------- Router ----------

router = APIRouter()


@router.get("/", response_model=list[ProgramOut])
async def list_programs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Program).where(Program.user_id == current_user.id).order_by(desc(Program.created_at))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{program_id}", response_model=ProgramOut)
async def get_program(
    program_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Program).where(Program.id == program_id, Program.user_id == current_user.id)
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return program


@router.post("/", response_model=ProgramOut, status_code=201)
async def create_program(
    data: ProgramCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    program = Program(user_id=current_user.id, **data.model_dump())
    db.add(program)
    await db.commit()
    await db.refresh(program)
    return program


@router.put("/{program_id}", response_model=ProgramOut)
async def update_program(
    program_id: int,
    data: ProgramUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Program).where(Program.id == program_id, Program.user_id == current_user.id)
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(program, key, value)

    await db.commit()
    await db.refresh(program)
    return program


@router.delete("/{program_id}", status_code=204)
async def delete_program(
    program_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Program).where(Program.id == program_id, Program.user_id == current_user.id)
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    await db.delete(program)
    await db.commit()


@router.post("/generate", response_model=ProgramOut, status_code=201)
async def generate_program(
    data: ProgramGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = (
        f"Generate a {data.program_length_weeks}-week powerlifting program for a "
        f"{data.experience_level} lifter training {data.days_per_week} days/week.\n"
        f"Goals: {data.goals}\n"
    )
    if data.weak_points:
        message += f"Weak points to address: {data.weak_points}\n"
    message += (
        "\nReturn ONLY valid JSON with this structure (no markdown, no explanation before/after):\n"
        '{"weeks": [{"week_number": 1, "block": "hypertrophy", "days": [{"day_number": 1, '
        '"name": "Heavy Squat", "exercises": [{"exercise_name": "Competition Squat", '
        '"sets": 5, "reps": 5, "intensity_pct": 72.5, "rpe_target": 7.0}]}]}]}'
    )

    try:
        response_text, context_snapshot = await ask_coach(
            db, "program_generation", message, user_id=current_user.id,
            extra={"meet_id": data.meet_id} if data.meet_id else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

    try:
        json_str = response_text
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0]
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0]
        program_data = json.loads(json_str.strip())
    except (json.JSONDecodeError, IndexError):
        program_data = {"raw_response": response_text, "weeks": []}

    start = date_type.today()
    end = start + timedelta(weeks=data.program_length_weeks)

    program = Program(
        user_id=current_user.id,
        name=f"AI Generated - {data.goals[:50]}",
        meet_id=data.meet_id,
        start_date=start,
        end_date=end,
        status="draft",
        ai_generated=True,
        description=f"Generated by Grok AI. Goals: {data.goals}. {data.experience_level} level.",
        program_data=program_data,
    )
    db.add(program)
    await db.commit()
    await db.refresh(program)
    return program


# ---------- Workout templates within a program ----------


class WorkoutTemplateExercise(BaseModel):
    exercise_id: int
    exercise_name: str
    sets: int = 3
    reps: int | str = 5
    rpe: float | None = None
    set_type: str = "working"
    intensity: str | None = None


class WorkoutTemplate(BaseModel):
    name: str
    exercises: list[WorkoutTemplateExercise] = []


async def _get_user_program(db: AsyncSession, program_id: int, user_id: int) -> Program:
    result = await db.execute(
        select(Program).where(Program.id == program_id, Program.user_id == user_id)
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return program


def _get_workouts(program: Program) -> list[dict]:
    """Get the workouts list from program_data, initializing if needed."""
    if not isinstance(program.program_data, dict):
        program.program_data = {"workouts": []}
    if "workouts" not in program.program_data:
        program.program_data["workouts"] = []
    return program.program_data["workouts"]


@router.post("/{program_id}/workouts", response_model=ProgramOut)
async def add_workout_template(
    program_id: int,
    data: WorkoutTemplate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    program = await _get_user_program(db, program_id, current_user.id)
    workouts_list = _get_workouts(program)
    workouts_list.append(data.model_dump())
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(program, "program_data")
    await db.commit()
    await db.refresh(program)
    return program


@router.delete("/{program_id}/workouts/{index}", response_model=ProgramOut)
async def remove_workout_template(
    program_id: int,
    index: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    program = await _get_user_program(db, program_id, current_user.id)
    workouts_list = _get_workouts(program)
    if index < 0 or index >= len(workouts_list):
        raise HTTPException(status_code=400, detail="Invalid workout index")
    workouts_list.pop(index)
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(program, "program_data")
    await db.commit()
    await db.refresh(program)
    return program


@router.put("/{program_id}/workouts/{index}", response_model=ProgramOut)
async def update_workout_template(
    program_id: int,
    index: int,
    data: WorkoutTemplate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    program = await _get_user_program(db, program_id, current_user.id)
    workouts_list = _get_workouts(program)
    if index < 0 or index >= len(workouts_list):
        raise HTTPException(status_code=400, detail="Invalid workout index")
    workouts_list[index] = data.model_dump()
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(program, "program_data")
    await db.commit()
    await db.refresh(program)
    return program


@router.post("/{program_id}/workouts/copy-from/{workout_id}", response_model=ProgramOut)
async def copy_workout_to_program(
    program_id: int,
    workout_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Copy exercises from an existing workout into the program as a new template."""
    program = await _get_user_program(db, program_id, current_user.id)

    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Workout)
        .where(Workout.id == workout_id, Workout.user_id == current_user.id)
        .options(selectinload(Workout.exercises).selectinload(WorkoutExercise.exercise))
        .options(selectinload(Workout.exercises).selectinload(WorkoutExercise.sets))
    )
    workout = result.scalar_one_or_none()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    template_exercises = []
    for we in sorted(workout.exercises, key=lambda x: x.order_index):
        working_sets = [s for s in we.sets if s.set_type == "working"]
        if working_sets:
            rep_counts = [s.reps for s in working_sets]
            reps: int | str = rep_counts[0] if len(set(rep_counts)) == 1 else str(min(rep_counts)) + "-" + str(max(rep_counts))
        else:
            reps = 5
        template_exercises.append({
            "exercise_id": we.exercise_id,
            "exercise_name": we.exercise.name if we.exercise else f"Exercise #{we.exercise_id}",
            "sets": len(working_sets) or len(we.sets),
            "reps": reps,
            "set_type": "working",
        })

    workouts_list = _get_workouts(program)
    workouts_list.append({
        "name": workout.name or f"Day {len(workouts_list) + 1}",
        "exercises": template_exercises,
    })
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(program, "program_data")
    await db.commit()
    await db.refresh(program)
    return program


@router.get("/{program_id}/next")
async def get_next_workout(
    program_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the next workout template in the program rotation."""
    program = await _get_user_program(db, program_id, current_user.id)
    workouts_list = _get_workouts(program)
    if not workouts_list:
        raise HTTPException(status_code=404, detail="Program has no workout templates")

    # Count completed workouts for this program to determine next in rotation
    count_result = await db.execute(
        select(func.count())
        .select_from(Workout)
        .where(and_(
            Workout.user_id == current_user.id,
            Workout.program_id == program_id,
            Workout.completed.is_(True),
        ))
    )
    completed_count = count_result.scalar() or 0
    next_index = completed_count % len(workouts_list)

    return {
        "program_id": program_id,
        "program_name": program.name,
        "day_index": next_index,
        "day_number": completed_count + 1,
        "total_templates": len(workouts_list),
        "template": workouts_list[next_index],
    }
