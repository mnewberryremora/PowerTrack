"""AI coach integration using xAI/Grok API."""

from datetime import date, timedelta
from typing import Any

import httpx
from sqlalchemy import select, desc, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import (
    BodyMetric, Exercise, Meet, PersonalRecord,
    Set, UserPreferences, Workout, WorkoutExercise,
)
from app.services.dots import calculate_dots, lbs_to_kg
from app.services.pr_detection import effective_load


async def build_context(
    db: AsyncSession,
    context_type: str,
    user_id: int,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build structured context for the AI coach prompt."""
    context: dict[str, Any] = {}

    # --- User preferences ---
    prefs_result = await db.execute(select(UserPreferences).where(UserPreferences.user_id == user_id))
    prefs = prefs_result.scalar_one_or_none()
    if prefs:
        context["preferences"] = {
            "display_unit": prefs.display_unit,
            "training_days_per_week": prefs.training_days_per_week,
            "preferred_rep_schemes": prefs.preferred_rep_schemes,
            "weight_class_kg": float(prefs.meet_weight_class_kg) if prefs.meet_weight_class_kg else None,
            "notes": prefs.notes,
        }

    # --- Latest body metrics ---
    bm_result = await db.execute(
        select(BodyMetric).where(BodyMetric.user_id == user_id).order_by(desc(BodyMetric.date)).limit(1)
    )
    latest_bm = bm_result.scalar_one_or_none()
    if latest_bm:
        context["body_metrics"] = {
            "bodyweight_lbs": float(latest_bm.bodyweight_lbs) if latest_bm.bodyweight_lbs else None,
            "body_fat_pct": float(latest_bm.body_fat_pct) if latest_bm.body_fat_pct else None,
            "date": str(latest_bm.date),
        }

    # --- Current PRs for competition lifts ---
    comp_exercises = await db.execute(
        select(Exercise).where(Exercise.is_competition.is_(True))
    )
    comp_list = comp_exercises.scalars().all()
    prs_summary = {}
    for ex in comp_list:
        pr_result = await db.execute(
            select(PersonalRecord)
            .where(and_(PersonalRecord.user_id == user_id, PersonalRecord.exercise_id == ex.id, PersonalRecord.rep_count == 1))
            .order_by(desc(PersonalRecord.weight_lbs))
            .limit(1)
        )
        pr = pr_result.scalar_one_or_none()
        if pr:
            prs_summary[ex.name] = {
                "weight_lbs": float(pr.weight_lbs),
                "e1rm_lbs": float(pr.e1rm_lbs) if pr.e1rm_lbs else float(pr.weight_lbs),
                "date": str(pr.date),
            }
    context["competition_prs"] = prs_summary

    # --- DOTS score ---
    if latest_bm and latest_bm.bodyweight_lbs and prs_summary:
        total_lbs = sum(v["weight_lbs"] for v in prs_summary.values())
        bw_kg = lbs_to_kg(float(latest_bm.bodyweight_lbs))
        total_kg = lbs_to_kg(total_lbs)
        context["dots_score"] = calculate_dots(total_kg, bw_kg)
    else:
        context["dots_score"] = None

    # --- Recent workouts (last 4 weeks) ---
    four_weeks_ago = date.today() - timedelta(weeks=4)
    workouts_result = await db.execute(
        select(Workout)
        .where(Workout.user_id == user_id, Workout.date >= four_weeks_ago)
        .order_by(desc(Workout.date))
        .limit(20)
    )
    recent_workouts = workouts_result.scalars().all()

    bm_rows = (await db.execute(
        select(BodyMetric.date, BodyMetric.bodyweight_lbs)
        .where(BodyMetric.user_id == user_id, BodyMetric.bodyweight_lbs.is_not(None))
        .order_by(BodyMetric.date)
    )).all()
    bm_list = [(r.date, float(r.bodyweight_lbs)) for r in bm_rows]

    def bw_for_date(d):
        result = None
        for bm_date, bw in bm_list:
            if bm_date <= d:
                result = bw
            else:
                break
        return result

    workout_summaries = []
    for w in recent_workouts:
        # Get exercises and sets
        we_result = await db.execute(
            select(WorkoutExercise)
            .where(WorkoutExercise.workout_id == w.id)
        )
        workout_exercises = we_result.scalars().all()
        bw = float(w.bodyweight_lbs) if w.bodyweight_lbs else bw_for_date(w.date)
        ex_names = []
        total_volume = 0
        comments = []
        for we in workout_exercises:
            ex_result = await db.execute(select(Exercise).where(Exercise.id == we.exercise_id))
            ex = ex_result.scalar_one_or_none()
            if ex:
                ex_names.append(ex.name)
            if we.notes:
                comments.append(we.notes)

            sets_result = await db.execute(
                select(Set).where(Set.workout_exercise_id == we.id)
            )
            equipment = ex.equipment if ex else None
            for s in sets_result.scalars().all():
                total_volume += effective_load(float(s.weight_lbs), equipment, bw) * s.reps
                if s.notes:
                    comments.append(s.notes)

        workout_summaries.append({
            "date": str(w.date),
            "name": w.name,
            "exercises": ex_names,
            "total_volume_lbs": round(total_volume),
            "sleep_quality": w.sleep_quality,
            "fatigue_level": w.fatigue_level,
            "notes": w.notes,
            "comments": comments,
        })
    context["recent_workouts"] = workout_summaries

    # --- Subjective data (sleep, fatigue, comments from last 2 weeks) ---
    two_weeks_ago = date.today() - timedelta(weeks=2)
    subjective = []
    for ws in workout_summaries:
        if ws["date"] >= str(two_weeks_ago):
            entry = {}
            if ws["sleep_quality"]:
                entry["sleep_quality"] = ws["sleep_quality"]
            if ws["fatigue_level"]:
                entry["fatigue_level"] = ws["fatigue_level"]
            if ws["comments"]:
                entry["comments"] = ws["comments"]
            if ws["notes"]:
                entry["session_notes"] = ws["notes"]
            if entry:
                entry["date"] = ws["date"]
                subjective.append(entry)
    context["subjective_data"] = subjective

    # --- Meet info (conditional) ---
    if context_type in ("meet_prep", "program_generation"):
        meet_result = await db.execute(
            select(Meet)
            .where(and_(Meet.user_id == user_id, Meet.status == "planned", Meet.date >= date.today()))
            .order_by(Meet.date)
            .limit(1)
        )
        next_meet = meet_result.scalar_one_or_none()
        if next_meet:
            weeks_out = (next_meet.date - date.today()).days // 7
            context["next_meet"] = {
                "name": next_meet.name,
                "date": str(next_meet.date),
                "weeks_out": weeks_out,
                "weight_class_kg": float(next_meet.weight_class_kg) if next_meet.weight_class_kg else None,
                "federation": next_meet.federation,
            }

    if extra:
        context.update(extra)

    return context


def format_system_prompt(context: dict[str, Any], context_type: str) -> str:
    """Build the system prompt for Grok from the structured context."""
    bm = context.get("body_metrics", {})
    prefs = context.get("preferences", {})
    prs = context.get("competition_prs", {})

    bw_str = f"{bm.get('bodyweight_lbs', '?')} lbs" if bm else "unknown"
    wc_str = f"{prefs.get('weight_class_kg', '?')} kg" if prefs.get("weight_class_kg") else "not set"

    prs_lines = []
    for lift, data in prs.items():
        prs_lines.append(f"  {lift}: {data['weight_lbs']} lbs (e1RM: {data['e1rm_lbs']} lbs, set on {data['date']})")
    prs_text = "\n".join(prs_lines) if prs_lines else "  No PRs recorded yet."

    total_lbs = sum(v["weight_lbs"] for v in prs.values()) if prs else 0
    dots = context.get("dots_score", "N/A")

    # Training summary
    workouts = context.get("recent_workouts", [])
    training_lines = []
    for w in workouts[:10]:
        exs = ", ".join(w["exercises"][:4])
        vol = w["total_volume_lbs"]
        sleep = f" | Sleep: {w['sleep_quality']}/5" if w.get("sleep_quality") else ""
        fatigue = f" | Fatigue: {w['fatigue_level']}/5" if w.get("fatigue_level") else ""
        training_lines.append(f"  {w['date']}: {w.get('name', 'Workout')} [{exs}] Vol: {vol} lbs{sleep}{fatigue}")
    training_text = "\n".join(training_lines) if training_lines else "  No recent workouts."

    # Subjective notes
    subjective = context.get("subjective_data", [])
    subj_lines = []
    for s in subjective:
        parts = [s["date"]]
        if s.get("sleep_quality"):
            parts.append(f"sleep={s['sleep_quality']}/5")
        if s.get("fatigue_level"):
            parts.append(f"fatigue={s['fatigue_level']}/5")
        if s.get("comments"):
            parts.append(f"comments: {'; '.join(s['comments'])}")
        if s.get("session_notes"):
            parts.append(f"notes: {s['session_notes']}")
        subj_lines.append("  " + " | ".join(parts))
    subj_text = "\n".join(subj_lines) if subj_lines else "  No subjective data."

    prompt = f"""You are an experienced USPA powerlifting coach. The athlete competes in full power (squat, bench, deadlift).

Current stats:
- Bodyweight: {bw_str}
- Weight class: {wc_str}
- DOTS score: {dots}
- Total: {total_lbs} lbs

Competition PRs:
{prs_text}

Recent training (last 4 weeks):
{training_text}

Athlete subjective notes (last 2 weeks):
{subj_text}"""

    # Meet info
    meet = context.get("next_meet")
    if meet:
        prompt += f"""

Upcoming meet: {meet['name']} on {meet['date']} ({meet['weeks_out']} weeks out)
Weight class: {meet.get('weight_class_kg', 'not set')} kg
Federation: {meet.get('federation', 'USPA')}"""

    # User preferences
    if prefs:
        prompt += f"""

User preferences:
- Training days/week: {prefs.get('training_days_per_week', 4)}
- Preferred rep schemes: {prefs.get('preferred_rep_schemes', 'not specified')}
- Unit preference: {prefs.get('display_unit', 'lbs')}"""
        if prefs.get("notes"):
            prompt += f"\n- User notes: {prefs['notes']}"

    prompt += """

Rules:
- Use DOTS scoring (not Wilks or IPF GL)
- USPA rules and weight classes
- Epley formula for e1RM: weight * (1 + reps/30)
- Be practical and specific. Give sets/reps/percentages when suggesting programming.
- If the athlete mentions pain, sleep issues, injury, or high fatigue, adjust recommendations conservatively.
- If the athlete has overridden previous recommendations, respect their preferences.
- Base advice on the actual training data provided, not generic templates.
- Keep responses focused and actionable."""

    if context_type == "meet_prep":
        prompt += """
- Focus on peaking strategy, attempt selection, and weight management for the upcoming meet.
- Consider the athlete's current PRs and suggest realistic openers (typically 90-93% of max)."""
    elif context_type == "program_generation":
        prompt += """
- Generate a periodized training program with specific exercises, sets, reps, and intensities.
- Output the program as structured JSON matching this format:
  {"weeks": [{"week_number": 1, "block": "name", "days": [{"day_number": 1, "name": "...", "exercises": [{"exercise_name": "...", "sets": N, "reps": N, "intensity_pct": N, "rpe_target": N}]}]}]}"""

    return prompt


async def call_grok(system_prompt: str, user_message: str) -> tuple[str, int]:
    """Call the xAI/Grok API. Returns (response_text, total_tokens_used)."""
    if not settings.xai_api_key:
        raise ValueError("XAI_API_KEY not configured")

    async with httpx.AsyncClient(timeout=60.0) as client:
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
                "temperature": 0.7,
                "max_tokens": 3000,
            },
        )
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        tokens = data.get("usage", {}).get("total_tokens", 0)
        return content, tokens


def _check_and_reset_monthly(user: "User") -> None:
    """Reset token counter if we've entered a new month."""
    from datetime import datetime
    now = datetime.utcnow()
    if user.ai_tokens_reset_at is None or user.ai_tokens_reset_at.month != now.month or user.ai_tokens_reset_at.year != now.year:
        user.ai_tokens_used = 0
        user.ai_tokens_reset_at = now


async def check_ai_budget(db: AsyncSession, user_id: int) -> tuple[int, int]:
    """Check remaining AI budget. Returns (tokens_used, token_limit). Raises ValueError if over limit."""
    from app.models.user import User
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()
    _check_and_reset_monthly(user)
    limit = user.ai_token_limit if user.ai_token_limit is not None else settings.ai_monthly_token_limit
    if limit > 0 and user.ai_tokens_used >= limit:
        raise ValueError(f"Monthly AI token limit reached ({user.ai_tokens_used:,} / {limit:,}). Resets on the 1st of next month.")
    await db.commit()
    return user.ai_tokens_used, limit


async def record_ai_usage(db: AsyncSession, user_id: int, tokens: int) -> None:
    """Record token usage for a user."""
    from app.models.user import User
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()
    _check_and_reset_monthly(user)
    user.ai_tokens_used += tokens
    await db.commit()


async def ask_coach(
    db: AsyncSession,
    context_type: str,
    user_message: str,
    user_id: int = 0,
    extra: dict[str, Any] | None = None,
) -> tuple[str, dict[str, Any]]:
    """Full pipeline: check budget -> build context -> format prompt -> call Grok -> record usage."""
    await check_ai_budget(db, user_id)
    context = await build_context(db, context_type, user_id, extra)
    system_prompt = format_system_prompt(context, context_type)
    response, tokens = await call_grok(system_prompt, user_message)
    await record_ai_usage(db, user_id, tokens)
    return response, context
