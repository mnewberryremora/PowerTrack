from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class ProgramCreate(BaseModel):
    name: str
    meet_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str = "draft"
    ai_generated: bool = False
    description: Optional[str] = None
    program_data: dict[str, Any]


class ProgramOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    meet_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str
    ai_generated: bool
    description: Optional[str] = None
    program_data: dict[str, Any]
    created_at: datetime


class ProgramGenerate(BaseModel):
    """Request schema for AI-based program generation."""

    meet_id: Optional[int] = None
    goals: Optional[str] = None
    days_per_week: int = 4
    program_length_weeks: int = 12
    experience_level: Optional[str] = None
    weak_points: list[str] = []
    notes: Optional[str] = None
