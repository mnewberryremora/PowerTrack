from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ExerciseCreate(BaseModel):
    name: str
    category: str
    is_competition: bool = False
    is_custom: bool = False
    equipment: Optional[str] = None
    notes: Optional[str] = None


class ExerciseUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    is_competition: Optional[bool] = None
    is_custom: Optional[bool] = None
    equipment: Optional[str] = None
    notes: Optional[str] = None


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    is_competition: bool
    is_custom: bool
    equipment: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
