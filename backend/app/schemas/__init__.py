from app.schemas.ai import AIAskRequest, AIConversationOut, AIOverride, AIResponse
from app.schemas.body_metric import BodyMetricCreate, BodyMetricOut, BodyMetricUpdate
from app.schemas.exercise import ExerciseCreate, ExerciseOut, ExerciseUpdate
from app.schemas.meet import MeetCreate, MeetOut, MeetUpdate
from app.schemas.pr import PROut
from app.schemas.program import ProgramCreate, ProgramGenerate, ProgramOut
from app.schemas.user_prefs import UserPreferencesOut, UserPreferencesUpdate
from app.schemas.workout import (
    SetCreate,
    SetOut,
    WorkoutCreate,
    WorkoutExerciseCreate,
    WorkoutExerciseOut,
    WorkoutOut,
    WorkoutSummary,
    ImportConfirmRequest,
    ImportPreviewResponse,
    ImportResult,
)

__all__ = [
    # Exercise
    "ExerciseCreate",
    "ExerciseUpdate",
    "ExerciseOut",
    # Workout
    "WorkoutCreate",
    "WorkoutOut",
    "WorkoutSummary",
    "WorkoutExerciseCreate",
    "WorkoutExerciseOut",
    "SetCreate",
    "SetOut",
    "ImportConfirmRequest",
    "ImportPreviewResponse",
    "ImportResult",
    # Body Metric
    "BodyMetricCreate",
    "BodyMetricUpdate",
    "BodyMetricOut",
    # PR
    "PROut",
    # Meet
    "MeetCreate",
    "MeetUpdate",
    "MeetOut",
    # Program
    "ProgramCreate",
    "ProgramOut",
    "ProgramGenerate",
    # User Preferences
    "UserPreferencesUpdate",
    "UserPreferencesOut",
    # AI
    "AIAskRequest",
    "AIResponse",
    "AIConversationOut",
    "AIOverride",
]
