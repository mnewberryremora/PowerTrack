from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PROut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exercise_id: int
    exercise_name: Optional[str] = None
    set_id: int
    rep_count: int
    weight_lbs: float
    e1rm_lbs: Optional[float] = None
    date: date
    previous_weight_lbs: Optional[float] = None
