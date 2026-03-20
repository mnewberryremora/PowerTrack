from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class AIAskRequest(BaseModel):
    context_type: str
    message: str


class AIResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    response: str
    context_type: str


class AIConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    context_type: str
    user_message: str
    ai_response: str
    context_snapshot: Optional[dict[str, Any]] = None
    accepted: Optional[bool] = None
    user_override_notes: Optional[str] = None
    created_at: datetime


class AIOverride(BaseModel):
    accepted: bool
    override_notes: Optional[str] = None
