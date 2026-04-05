import json
from datetime import date as date_type, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db import get_db
from app.models.program import Program
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
