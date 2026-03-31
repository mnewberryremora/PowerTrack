import secrets
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import asyncio
from app.core.security import get_current_admin
from app.services.email_service import send_approval_notification
from app.db import get_db
from app.models.exercise import Exercise
from app.models.invite import Invite
from app.models.workout import Workout, WorkoutExercise, Set
from app.models.body_metric import BodyMetric
from app.models.meet import Meet
from app.models.program import Program
from app.models.user_prefs import UserPreferences
from app.models.user import User

router = APIRouter()


class UserAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    display_name: str | None
    status: str
    is_admin: bool
    is_active: bool
    created_at: datetime


class StatusUpdate(BaseModel):
    status: str  # "approved" | "denied"


@router.get("/users", response_model=list[UserAdminOut])
async def list_users(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_admin)):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.patch("/users/{user_id}/status", response_model=UserAdminOut)
async def update_user_status(
    user_id: int,
    data: StatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    if data.status not in ("approved", "denied", "pending"):
        raise HTTPException(status_code=400, detail="Invalid status")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own status")
    prev_status = user.status
    user.status = data.status
    await db.commit()
    await db.refresh(user)
    if prev_status != data.status and data.status in ("approved", "denied"):
        asyncio.create_task(send_approval_notification(user.email, data.status == "approved"))
    return user


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()


@router.patch("/users/{user_id}/admin", response_model=UserAdminOut)
async def toggle_admin(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own admin status")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = not user.is_admin
    await db.commit()
    await db.refresh(user)
    return user


# ── Invite Links ──

class InviteCreate(BaseModel):
    label: str | None = None
    max_uses: int | None = None
    expires_in_days: int | None = None


class InviteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    token: str
    label: str | None
    max_uses: int | None
    use_count: int
    expires_at: datetime | None
    is_active: bool
    created_at: datetime


@router.post("/invites", response_model=InviteOut, status_code=201)
async def create_invite(
    data: InviteCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    from datetime import timedelta
    expires_at = None
    if data.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=data.expires_in_days)
    invite = Invite(
        token=secrets.token_urlsafe(32),
        label=data.label,
        created_by=current_admin.id,
        max_uses=data.max_uses,
        expires_at=expires_at,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)
    return invite


@router.get("/invites", response_model=list[InviteOut])
async def list_invites(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    result = await db.execute(select(Invite).order_by(Invite.created_at.desc()))
    return result.scalars().all()


@router.delete("/invites/{invite_id}", status_code=204)
async def revoke_invite(
    invite_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    result = await db.execute(select(Invite).where(Invite.id == invite_id))
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    invite.is_active = False
    await db.commit()


# ── Data Migration Import ──

class MigrationImport(BaseModel):
    version: int = 1
    exercises: list[dict[str, Any]] = []
    workouts: list[dict[str, Any]] = []
    body_metrics: list[dict[str, Any]] = []
    meets: list[dict[str, Any]] = []
    programs: list[dict[str, Any]] = []
    user_preferences: list[dict[str, Any]] = []


def _parse_date(val: Any) -> date | None:
    if val is None:
        return None
    if isinstance(val, date):
        return val
    try:
        return date.fromisoformat(str(val)[:10])
    except (ValueError, TypeError):
        return None


def _parse_datetime(val: Any) -> datetime | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    try:
        return datetime.fromisoformat(str(val))
    except (ValueError, TypeError):
        return None


@router.post("/import-migration")
async def import_migration(
    data: MigrationImport,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Import a full data export from the local desktop app into this user's account."""
    uid = current_admin.id
    stats: dict[str, int] = {}

    # ── Exercises (upsert by name) ──
    exercise_id_map: dict[int, int] = {}  # old_id -> new_id
    ex_result = await db.execute(select(Exercise))
    existing_exercises = {ex.name.lower(): ex for ex in ex_result.scalars().all()}

    for ex in data.exercises:
        old_id = ex.get("id")
        name = ex.get("name", "").strip()
        if not name:
            continue
        matched = existing_exercises.get(name.lower())
        if not matched:
            matched = Exercise(
                name=name,
                category=ex.get("category", "other"),
                is_competition=bool(ex.get("is_competition", False)),
                is_custom=bool(ex.get("is_custom", True)),
                equipment=ex.get("equipment"),
                notes=ex.get("notes"),
            )
            db.add(matched)
            await db.flush()
            existing_exercises[name.lower()] = matched
        if old_id is not None:
            exercise_id_map[old_id] = matched.id

    stats["exercises"] = len(exercise_id_map)

    # ── Workouts ──
    workout_count = 0
    for w in data.workouts:
        workout_date = _parse_date(w.get("date"))
        if not workout_date:
            continue

        workout = Workout(
            user_id=uid,
            date=workout_date,
            name=w.get("name"),
            notes=w.get("notes"),
            duration_minutes=w.get("duration_minutes"),
            bodyweight_lbs=w.get("bodyweight_lbs"),
            sleep_quality=w.get("sleep_quality"),
            fatigue_level=w.get("fatigue_level"),
            completed=bool(w.get("completed", True)),
        )
        db.add(workout)
        await db.flush()
        workout_count += 1

        for we_data in w.get("exercises", []):
            old_ex_id = we_data.get("exercise_id")
            new_ex_id = exercise_id_map.get(old_ex_id) if old_ex_id else None
            if not new_ex_id:
                continue

            we = WorkoutExercise(
                workout_id=workout.id,
                exercise_id=new_ex_id,
                order_index=we_data.get("order_index", 0),
                notes=we_data.get("notes"),
            )
            db.add(we)
            await db.flush()

            for s_data in we_data.get("sets", []):
                s = Set(
                    workout_exercise_id=we.id,
                    set_number=s_data.get("set_number", 1),
                    weight_lbs=float(s_data.get("weight_lbs", 0) or 0),
                    reps=int(s_data.get("reps", 0) or 0),
                    rpe=s_data.get("rpe"),
                    set_type=s_data.get("set_type", "working"),
                    notes=s_data.get("notes"),
                )
                db.add(s)

    stats["workouts"] = workout_count

    # ── Body Metrics ──
    bm_count = 0
    for bm in data.body_metrics:
        bm_date = _parse_date(bm.get("date"))
        if not bm_date:
            continue
        db.add(BodyMetric(
            user_id=uid,
            date=bm_date,
            bodyweight_lbs=bm.get("bodyweight_lbs"),
            body_fat_pct=bm.get("body_fat_pct"),
            notes=bm.get("notes"),
        ))
        bm_count += 1
    stats["body_metrics"] = bm_count

    # ── Meets ──
    meet_count = 0
    for m in data.meets:
        meet_date = _parse_date(m.get("date"))
        if not meet_date:
            continue
        db.add(Meet(
            user_id=uid,
            name=m.get("name", "Imported Meet"),
            date=meet_date,
            location=m.get("location"),
            federation=m.get("federation", "USPA"),
            weight_class_kg=m.get("weight_class_kg"),
            status=m.get("status", "completed"),
            squat_opener_lbs=m.get("squat_opener_lbs"),
            bench_opener_lbs=m.get("bench_opener_lbs"),
            deadlift_opener_lbs=m.get("deadlift_opener_lbs"),
            actual_results=m.get("actual_results"),
            notes=m.get("notes"),
        ))
        meet_count += 1
    stats["meets"] = meet_count

    # ── Programs ──
    prog_count = 0
    for p in data.programs:
        db.add(Program(
            user_id=uid,
            name=p.get("name", "Imported Program"),
            description=p.get("description"),
            start_date=_parse_date(p.get("start_date")),
            end_date=_parse_date(p.get("end_date")),
            status=p.get("status", "active"),
            ai_generated=bool(p.get("ai_generated", False)),
            program_data=p.get("program_data"),
        ))
        prog_count += 1
    stats["programs"] = prog_count

    # ── User Preferences (take first, upsert) ──
    if data.user_preferences:
        prefs_data = data.user_preferences[0]
        prefs_result = await db.execute(
            select(UserPreferences).where(UserPreferences.user_id == uid)
        )
        prefs = prefs_result.scalar_one_or_none()
        if not prefs:
            db.add(UserPreferences(
                user_id=uid,
                display_unit=prefs_data.get("display_unit", "lbs"),
                training_days_per_week=prefs_data.get("training_days_per_week"),
                preferred_rep_schemes=prefs_data.get("preferred_rep_schemes"),
                preferred_exercises=prefs_data.get("preferred_exercises"),
                meet_weight_class_kg=prefs_data.get("meet_weight_class_kg"),
                notes=prefs_data.get("notes"),
            ))

    await db.commit()
    return {"imported": stats, "user_id": uid}
