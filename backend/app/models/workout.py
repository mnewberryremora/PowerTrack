from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Workout(Base):
    __tablename__ = "workouts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    name: Mapped[str | None] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    bodyweight_lbs: Mapped[Decimal | None] = mapped_column(Numeric(5, 1))
    sleep_quality: Mapped[int | None] = mapped_column(SmallInteger)
    fatigue_level: Mapped[int | None] = mapped_column(SmallInteger)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    program_id: Mapped[int | None] = mapped_column(ForeignKey("programs.id", ondelete="SET NULL"), nullable=True)
    program_day_index: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    exercises: Mapped[list["WorkoutExercise"]] = relationship(
        back_populates="workout", cascade="all, delete-orphan", order_by="WorkoutExercise.order_index"
    )


class WorkoutExercise(Base):
    __tablename__ = "workout_exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    workout_id: Mapped[int] = mapped_column(ForeignKey("workouts.id", ondelete="CASCADE"), nullable=False)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"), nullable=False)
    order_index: Mapped[int] = mapped_column(SmallInteger, default=0)
    notes: Mapped[str | None] = mapped_column(Text)

    workout: Mapped["Workout"] = relationship(back_populates="exercises")
    exercise: Mapped["Exercise"] = relationship("Exercise", lazy="joined")
    sets: Mapped[list["Set"]] = relationship(
        back_populates="workout_exercise", cascade="all, delete-orphan", order_by="Set.set_number"
    )


class Set(Base):
    __tablename__ = "sets"

    id: Mapped[int] = mapped_column(primary_key=True)
    workout_exercise_id: Mapped[int] = mapped_column(
        ForeignKey("workout_exercises.id", ondelete="CASCADE"), nullable=False
    )
    set_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    weight_lbs: Mapped[Decimal] = mapped_column(Numeric(6, 1), nullable=False)
    reps: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    rpe: Mapped[Decimal | None] = mapped_column(Numeric(3, 1))
    set_type: Mapped[str] = mapped_column(String(20), default="working")
    is_pr: Mapped[bool] = mapped_column(Boolean, default=False)
    e1rm_lbs: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    notes: Mapped[str | None] = mapped_column(Text)

    workout_exercise: Mapped["WorkoutExercise"] = relationship(back_populates="sets")
