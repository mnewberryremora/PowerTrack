# AI Team Synergy Knowledge Base

> You are part of a hybrid Claude Code + Grok team.
> This file is the shared brain for THIS PROJECT.
> Global learnings live in ~/.claude/ai-team-knowledge.md

## Protocol
1. Read this file + ~/.claude/ai-team-knowledge.md at the start of any task.
2. After significant work, append project-specific context HERE and general learnings to the GLOBAL file.
3. Reference prior learnings in your reasoning.
4. Never delete entries — only append or annotate with corrections.

## MCP Fallback Rules
If Grok returns billing/quota errors (insufficient funds, HTTP 402, rate_limit_exceeded):
1. Stop calling Grok tools for this session.
2. Continue with pure Claude reasoning.
3. Mention the outage once, then move on.

## When to Consult Grok
- Architecture decisions (second opinion)
- Code review (independent review via grok_code_review)
- Debugging dead-ends (fresh perspective via grok_debug)
- Domain-specific questions
- Trade-off analysis (grok_think_deep)

Do NOT use Grok for: trivial edits, when latency matters, when billing is exhausted.

## Project-Specific Lessons

[2026-03-17] Initial build:
- Pydantic v2 on Python 3.12 has issues with `date | None` in BaseModel fields when `date` is imported from datetime — use `Optional[date]` from typing instead, or alias the import to avoid field name shadowing.
- Vite 8 + recharts: need to explicitly install `react-is` peer dependency.
- FastAPI redirects `/path` to `/path/` by default — axios follows redirects, so no fix needed.

## Project Context

### PowerTrack — Powerlifting Training Tracker
- **User**: USPA full-power powerlifter (squat/bench/deadlift + custom lifts)
- **Goal**: Maximize DOTS score, optimize lift performance, achieve ideal body composition
- **Tech Stack**: React 18 + Vite + TypeScript + TailwindCSS (frontend) / FastAPI + SQLAlchemy + PostgreSQL (backend) / xAI Grok API (AI coaching)
- **AI Integration**: Grok serves as the AI powerlifting coach inside the app (not as Claude Code MCP tool). Context builder assembles training history, PRs, body metrics, subjective data (sleep/fatigue/comments), and meet info into a structured prompt. User can accept or override AI recommendations.
- **Key formulas**: Epley e1RM (`weight * (1 + reps/30)`), DOTS score (male coefficients), lbs stored internally with kg conversion for DOTS
- **DB**: 10 tables — exercises, workouts, workout_exercises, sets, personal_records, body_metrics, meets, programs, ai_conversations, user_preferences
