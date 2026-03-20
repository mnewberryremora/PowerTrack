"""Export all training data from the local database to JSON.

Run inside the backend Docker container:
    docker-compose exec backend python scripts/export_data.py > export.json

Then import into Railway via:
    POST /api/admin/import-migration  (with the JSON as the request body)
"""

import asyncio
import json
import os
import sys
from datetime import date, datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://training:training_secret@postgres:5432/training_app",
)


def _serialize(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Cannot serialize {type(obj)}")


async def export():
    engine = create_async_engine(DATABASE_URL)

    async with engine.connect() as conn:
        # Check which columns exist (schema may be old or new)
        async def table_columns(table: str) -> set[str]:
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = :t"
            ), {"t": table})
            return {row[0] for row in result.fetchall()}

        async def fetch_table(table: str) -> list[dict]:
            result = await conn.execute(text(f"SELECT * FROM {table}"))
            cols = list(result.keys())
            return [dict(zip(cols, row)) for row in result.fetchall()]

        data: dict = {"version": 1}

        # Exercises
        data["exercises"] = await fetch_table("exercises")

        # Workouts (with nested exercises + sets)
        workouts_raw = await fetch_table("workouts")
        we_raw = await fetch_table("workout_exercises")
        sets_raw = await fetch_table("sets")

        # Build lookup maps
        we_by_workout: dict[int, list] = {}
        for we in we_raw:
            we_by_workout.setdefault(we["workout_id"], []).append(we)

        sets_by_we: dict[int, list] = {}
        for s in sets_raw:
            sets_by_we.setdefault(s["workout_exercise_id"], []).append(s)

        workouts_out = []
        for w in workouts_raw:
            exercises_out = []
            for we in we_by_workout.get(w["id"], []):
                we_copy = dict(we)
                we_copy["sets"] = sets_by_we.get(we["id"], [])
                exercises_out.append(we_copy)
            w_copy = dict(w)
            w_copy["exercises"] = exercises_out
            workouts_out.append(w_copy)
        data["workouts"] = workouts_out

        # Body metrics
        bm_cols = await table_columns("body_metrics")
        data["body_metrics"] = await fetch_table("body_metrics")

        # Meets
        data["meets"] = await fetch_table("meets")

        # Programs
        data["programs"] = await fetch_table("programs")

        # User preferences
        prefs_cols = await table_columns("user_preferences")
        data["user_preferences"] = await fetch_table("user_preferences")

        # Stats
        data["stats"] = {
            "exercises": len(data["exercises"]),
            "workouts": len(data["workouts"]),
            "body_metrics": len(data["body_metrics"]),
            "meets": len(data["meets"]),
            "programs": len(data["programs"]),
        }

    await engine.dispose()
    print(json.dumps(data, default=_serialize, indent=2))
    print(f"\n# Export complete: {data['stats']}", file=sys.stderr)


asyncio.run(export())
