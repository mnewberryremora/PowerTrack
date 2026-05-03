"""Backfill PR data for every user.

Recomputes is_pr / e1rm_lbs on Sets and rebuilds PersonalRecord rows using the
current bodyweight-aware formulas. Safe to re-run.

Run locally:
    python backend/scripts/recalculate_all_prs.py
Inside Docker:
    docker-compose exec backend python scripts/recalculate_all_prs.py
"""

import asyncio
import sys
from pathlib import Path

# Make `app` importable when running as a standalone script
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import select  # noqa: E402

from app.db import async_session  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.pr_detection import recalculate_user_prs  # noqa: E402


async def main() -> None:
    async with async_session() as session:
        users = (await session.execute(select(User.id, User.email))).all()
        if not users:
            print("No users found.")
            return

        total = 0
        for user_id, email in users:
            count = await recalculate_user_prs(session, user_id)
            total += count
            print(f"  user {user_id} ({email}): rebuilt {count} PRs")
        await session.commit()
        print(f"Done. {total} PRs across {len(users)} user(s).")


if __name__ == "__main__":
    asyncio.run(main())
