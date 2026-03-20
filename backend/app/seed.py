"""Seed default exercises."""

import asyncio

from sqlalchemy import select

from app.db import async_session, engine, Base
from app.models import Exercise

DEFAULT_EXERCISES = [
    # Competition lifts
    {"name": "Competition Squat", "category": "competition_squat", "is_competition": True, "equipment": "barbell"},
    {"name": "Competition Bench Press", "category": "competition_bench", "is_competition": True, "equipment": "barbell"},
    {"name": "Competition Deadlift", "category": "competition_deadlift", "is_competition": True, "equipment": "barbell"},
    # Squat variants
    {"name": "Pause Squat", "category": "squat_variant", "equipment": "barbell"},
    {"name": "Front Squat", "category": "squat_variant", "equipment": "barbell"},
    {"name": "SSB Squat", "category": "squat_variant", "equipment": "barbell"},
    {"name": "Leg Press", "category": "squat_variant", "equipment": "machine"},
    # Bench variants
    {"name": "Close Grip Bench", "category": "bench_variant", "equipment": "barbell"},
    {"name": "Pause Bench", "category": "bench_variant", "equipment": "barbell"},
    {"name": "Incline Bench", "category": "bench_variant", "equipment": "barbell"},
    {"name": "Dumbbell Bench", "category": "bench_variant", "equipment": "dumbbell"},
    # Deadlift variants
    {"name": "Deficit Deadlift", "category": "deadlift_variant", "equipment": "barbell"},
    {"name": "Block Pull", "category": "deadlift_variant", "equipment": "barbell"},
    {"name": "Romanian Deadlift", "category": "deadlift_variant", "equipment": "barbell"},
    {"name": "Sumo Deadlift", "category": "deadlift_variant", "equipment": "barbell"},
    # Accessories
    {"name": "Weighted Chin-Up", "category": "upper_pull", "equipment": "bodyweight"},
    {"name": "Barbell Row", "category": "upper_pull", "equipment": "barbell"},
    {"name": "Lat Pulldown", "category": "upper_pull", "equipment": "cable"},
    {"name": "Overhead Press", "category": "upper_push", "equipment": "barbell"},
    {"name": "Dumbbell Shoulder Press", "category": "upper_push", "equipment": "dumbbell"},
    {"name": "Tricep Extension", "category": "accessory", "equipment": "cable"},
    {"name": "Bicep Curl", "category": "accessory", "equipment": "dumbbell"},
    {"name": "Leg Curl", "category": "lower", "equipment": "machine"},
    {"name": "Leg Extension", "category": "lower", "equipment": "machine"},
    {"name": "Bulgarian Split Squat", "category": "lower", "equipment": "dumbbell"},
    {"name": "Hip Thrust", "category": "lower", "equipment": "barbell"},
]


async def seed_exercises() -> None:
    """Insert default exercises if they don't already exist (checked by name)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # Get all existing exercise names in one query
        result = await session.execute(select(Exercise.name))
        existing_names = {row[0] for row in result.all()}

        added = 0
        for ex_data in DEFAULT_EXERCISES:
            if ex_data["name"] not in existing_names:
                exercise = Exercise(
                    name=ex_data["name"],
                    category=ex_data["category"],
                    is_competition=ex_data.get("is_competition", False),
                    equipment=ex_data.get("equipment"),
                )
                session.add(exercise)
                added += 1

        if added:
            await session.commit()
            print(f"Seeded {added} exercises.")
        else:
            print("All default exercises already exist.")


if __name__ == "__main__":
    asyncio.run(seed_exercises())
