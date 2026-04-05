from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict

from app.schemas.exercise import ExerciseOut


# ---------- Sets ----------

class SetCreate(BaseModel):
    set_number: int
    weight_lbs: float
    reps: int
    rpe: Optional[float] = None
    set_type: str = "working"
    notes: Optional[str] = None


class SetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    set_number: int
    weight_lbs: float
    reps: int
    rpe: Optional[float] = None
    set_type: str
    is_pr: bool
    e1rm_lbs: Optional[float] = None
    notes: Optional[str] = None


# ---------- Workout Exercises ----------

class WorkoutExerciseCreate(BaseModel):
    exercise_id: int
    order_index: int = 0
    notes: Optional[str] = None
    sets: list[SetCreate] = []


class WorkoutExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exercise_id: int
    exercise: ExerciseOut
    order_index: int
    notes: Optional[str] = None
    sets: list[SetOut] = []


# ---------- Workouts ----------

class WorkoutCreate(BaseModel):
    date: date
    name: Optional[str] = None
    notes: Optional[str] = None
    duration_minutes: Optional[int] = None
    bodyweight_lbs: Optional[float] = None
    sleep_quality: Optional[int] = None
    fatigue_level: Optional[int] = None
    completed: bool = False
    program_id: Optional[int] = None
    program_day_index: Optional[int] = None
    exercises: list[WorkoutExerciseCreate] = []


class WorkoutOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    name: Optional[str] = None
    notes: Optional[str] = None
    duration_minutes: Optional[int] = None
    bodyweight_lbs: Optional[float] = None
    sleep_quality: Optional[int] = None
    fatigue_level: Optional[int] = None
    completed: bool
    program_id: Optional[int] = None
    program_day_index: Optional[int] = None
    created_at: datetime
    exercises: list[WorkoutExerciseOut] = []


class WorkoutSummary(BaseModel):
    """Lightweight schema for list views with computed fields."""

    id: int
    date: date
    name: Optional[str] = None
    status: str = "planned"
    exercise_count: int = 0
    total_volume_lbs: float = 0
    duration_minutes: Optional[int] = None


# ---------- XLSX Import ----------

class ImportSetPreview(BaseModel):
    set_number: int
    weight_lbs: float
    reps: int
    rpe: Optional[float] = None
    set_type: str = "working"
    notes: Optional[str] = None


class ImportExercisePreview(BaseModel):
    name: str
    matched_exercise_id: Optional[int] = None
    order_index: int = 0
    sets: list[ImportSetPreview] = []


class ImportWorkoutPreview(BaseModel):
    date: str
    name: Optional[str] = None
    bodyweight: Optional[float] = None
    sleep_quality: Optional[int] = None
    fatigue_level: Optional[int] = None
    exercises: list[ImportExercisePreview] = []


class ImportStats(BaseModel):
    total_workouts: int = 0
    total_sets: int = 0
    date_range: str = ""


class ImportPreviewResponse(BaseModel):
    workouts: list[ImportWorkoutPreview] = []
    unmatched_exercises: list[str] = []
    exercise_suggestions: dict[str, Optional[int]] = {}
    warnings: list[str] = []
    stats: ImportStats = ImportStats()


class ImportConfirmRequest(BaseModel):
    workouts: list[ImportWorkoutPreview]
    exercise_map: dict[str, int]  # spreadsheet exercise name -> DB exercise ID


class ImportResult(BaseModel):
    created_workout_ids: list[int] = []
    created: int = 0
    errors: list[str] = []
