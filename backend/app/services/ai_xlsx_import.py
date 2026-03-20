"""AI-powered XLSX import: sends raw spreadsheet data to Grok for interpretation."""

import io
import json
from typing import Any

from openpyxl import load_workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.exercise import Exercise


def _detect_header_row(rows: list[tuple]) -> int | None:
    """Find the header row index by looking for common column names."""
    keywords = {"exercise", "date", "weight", "rep", "reps", "set", "rpe", "actual", "%"}
    for idx, row in enumerate(rows[:10]):
        cells_lower = {str(c).strip().lower() for c in row if c is not None}
        if len(cells_lower & keywords) >= 2:
            return idx
    return None


def _detect_data_columns(header: tuple) -> list[int]:
    """Return indices of columns that contain training data (not right-side metadata).

    Filters out metadata columns like 'Current Max', 'Future Max', '% Increase'.
    """
    meta_keywords = {"current max", "future max", "% increase", "increase", "max"}
    indices: list[int] = []
    for i, cell in enumerate(header):
        label = str(cell).strip().lower() if cell else ""
        if any(kw in label for kw in meta_keywords):
            continue
        indices.append(i)
    return indices


def _sheet_has_actual_data(rows: list[tuple], header_idx: int | None) -> bool:
    """Check whether a sheet has completed training data (dates or 'Y' actuals)."""
    headers = [str(c).strip().lower() if c else "" for c in rows[header_idx]] if header_idx is not None else []
    date_col = next((i for i, h in enumerate(headers) if h == "date"), None)
    actual_col = next((i for i, h in enumerate(headers) if h == "actual"), None)

    if date_col is None and actual_col is None:
        return False  # No date column and no actual column — likely a template

    # Check if at least some rows have dates or 'Y' in actual
    data_rows = rows[header_idx + 1:] if header_idx is not None else rows[1:]
    has_dates = False
    has_actuals = False
    for row in data_rows[:50]:
        if date_col is not None and date_col < len(row):
            val = str(row[date_col]).strip() if row[date_col] else ""
            if val and val.lower() != "none":
                has_dates = True
        if actual_col is not None and actual_col < len(row):
            val = str(row[actual_col]).strip().upper() if row[actual_col] else ""
            if val == "Y":
                has_actuals = True
        if has_dates or has_actuals:
            return True
    return False


def extract_raw_cells(file_bytes: bytes, max_rows: int = 500) -> str:
    """Extract raw cell data from an XLSX file and format as readable text.

    Filters to only sheets with actual training data and trims metadata columns.
    Returns a text representation of the spreadsheet that the AI can interpret.
    """
    wb = load_workbook(filename=io.BytesIO(file_bytes), read_only=True, data_only=True)
    sheets_text: list[str] = []

    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue

        # Trim trailing empty rows
        while rows and all(c is None or str(c).strip() == "" for c in rows[-1]):
            rows.pop()

        if not rows:
            continue

        # Detect header and check if this sheet has real data
        header_idx = _detect_header_row(rows)
        if header_idx is not None and not _sheet_has_actual_data(rows, header_idx):
            # Skip template-only sheets with no actual workout data
            continue

        # Determine which columns are training data (not metadata)
        if header_idx is not None:
            data_cols = _detect_data_columns(rows[header_idx])
        else:
            data_cols = list(range(len(rows[0])))

        rows = rows[:max_rows]

        lines: list[str] = [f"=== Sheet: {ws.title} ==="]
        for row_idx, row in enumerate(rows, start=1):
            # Only include data columns
            cells = [str(row[i]) if i < len(row) and row[i] is not None else "" for i in data_cols]
            # Skip fully empty rows
            if all(c == "" for c in cells):
                continue
            lines.append(f"Row {row_idx}: {' | '.join(cells)}")

        sheets_text.append("\n".join(lines))

    wb.close()
    return "\n\n".join(sheets_text)


async def get_exercise_names(db: AsyncSession) -> list[str]:
    """Get all exercise names from the database for matching guidance."""
    result = await db.execute(select(Exercise.name))
    return [row[0] for row in result.all()]


def build_import_system_prompt(exercise_names: list[str]) -> str:
    """Build the system prompt that instructs Grok to interpret spreadsheet data."""
    exercises_list = "\n".join(f"  - {name}" for name in exercise_names) if exercise_names else "  (no exercises in database yet)"

    return f"""You are a data extraction assistant for a powerlifting training tracker app.

Your job: Read raw spreadsheet data and convert it into structured workout JSON.

The spreadsheet may have ANY format — columns might be labeled differently, data might be arranged in various ways (one row per set, one row per exercise, grouped by day, etc.). Use your best judgment to interpret the data.

CRITICAL FORMAT NOTES:
- "Rep Scheme" like "2 x 1" means 2 sets of 1 rep. "1 x 3" means 1 set of 3 reps. "3 x 5" means 3 sets of 5 reps. Always expand into individual sets.
- "Actual" column with "Y" means the set was completed — only include rows marked "Y" (or with data indicating completion).
- Rows without dates that are separated by blank rows represent different training days.
- Shorthand exercise names should be matched to the database: "Bench" = bench press, "Squat" = squat, "Chins" = chin-ups, "OHP" = overhead press, etc.
- Ignore template/program rows that weren't actually performed.

KNOWN EXERCISES IN THE DATABASE:
{exercises_list}

When you recognize an exercise name, use the EXACT name from the database list above. If an exercise isn't in the list, use the name as written in the spreadsheet.

OUTPUT FORMAT — you MUST return ONLY valid JSON with this exact structure (no markdown, no explanation, just JSON):
{{
  "workouts": [
    {{
      "date": "YYYY-MM-DD",
      "bodyweight": null,
      "sleep_quality": null,
      "fatigue_level": null,
      "exercises": [
        {{
          "name": "Exercise Name",
          "sets": [
            {{
              "set_number": 1,
              "weight_lbs": 315,
              "reps": 5,
              "rpe": 8.0,
              "set_type": "working",
              "notes": null
            }}
          ]
        }}
      ]
    }}
  ],
  "warnings": ["any issues or assumptions you made"]
}}

RULES:
- Group sets into workouts by date.
- If weight appears to be in kg, convert to lbs (multiply by 2.20462). Add a warning noting the conversion.
- set_type should be one of: "warmup", "working", "backoff", "amrap", "paused". Default to "working" if unclear.
- RPE should be 5.0-10.0 scale. If not provided, omit it (null).
- If you can identify bodyweight, sleep quality (1-5), or fatigue level (1-5), include them.
- If dates are missing, try to infer them. If impossible, use "unknown" and add a warning.
- Preserve the order of exercises as they appear in the spreadsheet.
- If some data is ambiguous, make your best interpretation and add a warning explaining what you assumed.
- Be CONCISE — omit null fields where possible to keep the JSON compact.
- Return ONLY the JSON object. No markdown code fences, no explanation text."""


async def _call_grok_import(system_prompt: str, user_message: str) -> str:
    """Call Grok with higher token limit for import tasks."""
    import httpx

    if not settings.xai_api_key:
        raise ValueError("XAI_API_KEY not configured")

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{settings.xai_base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.xai_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.xai_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                "temperature": 0.3,
                "max_tokens": 16000,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


async def ai_parse_xlsx(file_bytes: bytes, db: AsyncSession) -> dict[str, Any]:
    """Use Grok to interpret a freeform spreadsheet and return structured workout data.

    Returns the same format as parse_xlsx() so the existing confirm flow can be reused.
    """
    # Extract raw cell data
    raw_text = extract_raw_cells(file_bytes)
    if not raw_text.strip():
        return {
            "workouts": [],
            "unmatched_exercises": [],
            "exercise_suggestions": {},
            "warnings": ["Spreadsheet appears to be empty."],
            "stats": {"total_workouts": 0, "total_sets": 0, "date_range": ""},
        }

    # Get known exercises for matching
    exercise_names = await get_exercise_names(db)

    # Build prompts
    system_prompt = build_import_system_prompt(exercise_names)
    user_message = f"Parse this spreadsheet data into structured workouts:\n\n{raw_text}"

    # Call Grok with higher token limit
    response_text = await _call_grok_import(system_prompt, user_message)

    # Parse the JSON response — strip markdown fences if Grok wraps them
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        # Remove ```json ... ``` wrapping
        lines = cleaned.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        return {
            "workouts": [],
            "unmatched_exercises": [],
            "exercise_suggestions": {},
            "warnings": [
                "AI could not parse the spreadsheet into structured data.",
                f"Raw AI response: {response_text[:500]}",
            ],
            "stats": {"total_workouts": 0, "total_sets": 0, "date_range": ""},
        }

    workouts = parsed.get("workouts", [])
    ai_warnings = parsed.get("warnings", [])

    # Load exercises for fuzzy matching
    result = await db.execute(select(Exercise))
    db_exercises: list[Exercise] = list(result.scalars().all())
    exercise_name_map = {ex.name.lower(): ex for ex in db_exercises}

    # Post-process: match exercise names to DB and add order_index
    unmatched: set[str] = set()
    total_sets = 0
    dates: list[str] = []

    for workout in workouts:
        if workout.get("date") and workout["date"] != "unknown":
            dates.append(workout["date"])

        for ex_idx, ex in enumerate(workout.get("exercises", [])):
            ex["order_index"] = ex_idx
            name = ex.get("name", "")
            name_lower = name.strip().lower()

            # Try exact match
            matched_ex = exercise_name_map.get(name_lower)

            # Try contains match
            if not matched_ex:
                for db_ex in db_exercises:
                    db_lower = db_ex.name.lower()
                    if db_lower in name_lower or name_lower in db_lower:
                        matched_ex = db_ex
                        break

            ex["matched_exercise_id"] = matched_ex.id if matched_ex else None
            if not matched_ex:
                unmatched.add(name)

            # Ensure sets have set_number
            for si, s in enumerate(ex.get("sets", []), start=1):
                if not s.get("set_number"):
                    s["set_number"] = si
                total_sets += 1

    # Build stats
    dates.sort()
    date_range = ""
    if dates:
        date_range = f"{dates[0]} to {dates[-1]}" if len(dates) > 1 else dates[0]

    exercise_suggestions: dict[str, int | None] = {name: None for name in sorted(unmatched)}

    return {
        "workouts": workouts,
        "unmatched_exercises": sorted(unmatched),
        "exercise_suggestions": exercise_suggestions,
        "warnings": ai_warnings,
        "stats": {
            "total_workouts": len(workouts),
            "total_sets": total_sets,
            "date_range": date_range,
        },
    }
