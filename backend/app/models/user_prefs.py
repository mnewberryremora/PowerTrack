from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    display_unit: Mapped[str] = mapped_column(String(3), default="lbs")
    training_days_per_week: Mapped[int] = mapped_column(SmallInteger, default=4)
    preferred_rep_schemes: Mapped[dict | None] = mapped_column(JSONB)
    preferred_exercises: Mapped[dict | None] = mapped_column(JSONB)
    meet_weight_class_kg: Mapped[Decimal | None] = mapped_column(Numeric(5, 1))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
