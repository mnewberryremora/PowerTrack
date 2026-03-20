from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class BodyMetricCreate(BaseModel):
    date: date
    bodyweight_lbs: Optional[float] = None
    body_fat_pct: Optional[float] = None
    notes: Optional[str] = None


class BodyMetricUpdate(BaseModel):
    date: Optional[date] = None
    bodyweight_lbs: Optional[float] = None
    body_fat_pct: Optional[float] = None
    notes: Optional[str] = None


class BodyMetricOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    bodyweight_lbs: Optional[float] = None
    body_fat_pct: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime
