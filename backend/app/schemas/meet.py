from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class MeetCreate(BaseModel):
    name: str
    date: date
    location: Optional[str] = None
    federation: str = "USPA"
    weight_class_kg: Optional[float] = None
    status: str = "planned"
    squat_opener_lbs: Optional[float] = None
    bench_opener_lbs: Optional[float] = None
    deadlift_opener_lbs: Optional[float] = None
    actual_results: Optional[dict[str, Any]] = None
    notes: Optional[str] = None


class MeetUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[date] = None
    location: Optional[str] = None
    federation: Optional[str] = None
    weight_class_kg: Optional[float] = None
    status: Optional[str] = None
    squat_opener_lbs: Optional[float] = None
    bench_opener_lbs: Optional[float] = None
    deadlift_opener_lbs: Optional[float] = None
    actual_results: Optional[dict[str, Any]] = None
    notes: Optional[str] = None


class MeetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    date: date
    location: Optional[str] = None
    federation: str
    weight_class_kg: Optional[float] = None
    status: str
    squat_opener_lbs: Optional[float] = None
    bench_opener_lbs: Optional[float] = None
    deadlift_opener_lbs: Optional[float] = None
    actual_results: Optional[dict[str, Any]] = None
    notes: Optional[str] = None
    created_at: datetime
