from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Meet(Base):
    __tablename__ = "meets"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    location: Mapped[str | None] = mapped_column(String(200))
    federation: Mapped[str] = mapped_column(String(50), default="USPA")
    weight_class_kg: Mapped[Decimal | None] = mapped_column(Numeric(5, 1))
    status: Mapped[str] = mapped_column(String(20), default="planned")
    squat_opener_lbs: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    bench_opener_lbs: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    deadlift_opener_lbs: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    actual_results: Mapped[dict | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
