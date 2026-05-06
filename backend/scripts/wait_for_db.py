"""Wait for the database to be reachable before alembic / uvicorn.

Railway's private DNS (*.railway.internal) can take several seconds to come
online after a container starts. Running alembic immediately can race that
window and crash with `socket.gaierror: Name or service not known`. This
script retries with backoff and prints the masked URL so misconfigured hosts
are obvious in deploy logs.
"""

import asyncio
import os
import sys
import time

import asyncpg


def _mask(url: str) -> str:
    if "@" not in url:
        return url
    prefix, suffix = url.split("@", 1)
    if ":" in prefix and "//" in prefix:
        scheme_user, password = prefix.rsplit(":", 1)
        return f"{scheme_user}:***@{suffix}"
    return url


async def main() -> int:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        print("DATABASE_URL is not set", file=sys.stderr)
        return 1

    if url.startswith("postgresql+asyncpg://"):
        url = "postgresql://" + url[len("postgresql+asyncpg://"):]

    masked = _mask(url)
    deadline = time.time() + 90
    attempt = 0
    last_error: str | None = None

    while time.time() < deadline:
        attempt += 1
        try:
            conn = await asyncpg.connect(url, timeout=5)
            await conn.close()
            print(f"[wait_for_db] connected to {masked} after {attempt} attempt(s)")
            return 0
        except Exception as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            print(f"[wait_for_db] attempt {attempt} for {masked}: {last_error}", file=sys.stderr)
            await asyncio.sleep(2)

    print(f"[wait_for_db] giving up after {attempt} attempts. last error: {last_error}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
