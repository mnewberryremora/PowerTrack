from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, SmallInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class PersonalRecord(Base):
    __tablename__ = "personal_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"), nullable=False)
    set_id: Mapped[int] = mapped_column(ForeignKey("sets.id"), nullable=False)
    rep_count: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    weight_lbs: Mapped[Decimal] = mapped_column(Numeric(6, 1), nullable=False)
    e1rm_lbs: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    date: Mapped[date] = mapped_column(Date, nullable=False)
    previous_weight_lbs: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    exercise: Mapped["Exercise"] = relationship(lazy="joined")
