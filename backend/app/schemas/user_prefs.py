from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class UserPreferencesUpdate(BaseModel):
    display_unit: Optional[str] = None
    training_days_per_week: Optional[int] = None
    preferred_rep_schemes: Optional[dict[str, Any]] = None
    preferred_exercises: Optional[dict[str, Any]] = None
    meet_weight_class_kg: Optional[float] = None
    notes: Optional[str] = None


class UserPreferencesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_unit: str
    training_days_per_week: int
    preferred_rep_schemes: Optional[dict[str, Any]] = None
    preferred_exercises: Optional[dict[str, Any]] = None
    meet_weight_class_kg: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
