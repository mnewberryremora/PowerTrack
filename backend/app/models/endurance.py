from datetime import date, datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class EnduranceActivity(Base):
    __tablename__ = "endurance_activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_date: Mapped[date] = mapped_column(nullable=False, index=True)
    activity_type: Mapped[str] = mapped_column(String(20), nullable=False)  # "run" or "erg"
    sub_type: Mapped[str] = mapped_column(String(50), nullable=False)  # treadmill, road, obstacle_course, machine, water, or custom string
    name: Mapped[str | None] = mapped_column(String(200))
    distance_m: Mapped[float | None] = mapped_column(Float)
    duration_s: Mapped[int | None] = mapped_column(Integer)
    avg_heart_rate: Mapped[int | None] = mapped_column(Integer)
    avg_split_500m_s: Mapped[int | None] = mapped_column(Integer)  # ERG split per 500m in seconds
    stroke_rate: Mapped[float | None] = mapped_column(Float)  # ERG strokes per minute
    calories: Mapped[int | None] = mapped_column(Integer)
    is_competition: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    competition_name: Mapped[str | None] = mapped_column(String(200))
    competition_type: Mapped[str | None] = mapped_column(String(100))  # custom competition type
    place: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
