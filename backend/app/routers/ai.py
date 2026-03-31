from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db import get_db
from app.models.ai_conversation import AIConversation
from app.models.user import User
from app.services.ai_coach import ask_coach
from app.services.ai_xlsx_import import ai_parse_xlsx

# ---------- Request / response schemas ----------


class AskRequest(BaseModel):
    message: str
    context_type: str = "general"


class AnalyzeTrainingRequest(BaseModel):
    date_from: str | None = None
    date_to: str | None = None
    focus: str | None = None


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    context_type: str
    user_message: str
    ai_response: str
    context_snapshot: dict | None = None
    accepted: bool | None = None
    user_override_notes: str | None = None
    created_at: datetime | None = None


class ConversationUpdate(BaseModel):
    accepted: bool | None = None
    user_override_notes: str | None = None


# ---------- Router ----------

router = APIRouter()


@router.post("/ask", response_model=ConversationOut)
async def ask_ai(
    data: AskRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        response_text, context_snapshot = await ask_coach(
            db, data.context_type, data.message, user_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

    conversation = AIConversation(
        user_id=current_user.id,
        context_type=data.context_type,
        user_message=data.message,
        ai_response=response_text,
        context_snapshot=context_snapshot,
    )
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    return conversation


@router.post("/analyze-training", response_model=ConversationOut)
async def analyze_training(
    data: AnalyzeTrainingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = "Analyze my recent training and give me feedback."
    if data.focus:
        message += f" Focus on: {data.focus}"
    if data.date_from:
        message += f" From: {data.date_from}"
    if data.date_to:
        message += f" To: {data.date_to}"

    try:
        response_text, context_snapshot = await ask_coach(
            db, "training_analysis", message, user_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

    conversation = AIConversation(
        user_id=current_user.id,
        context_type="training_analysis",
        user_message=message,
        ai_response=response_text,
        context_snapshot=context_snapshot,
    )
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    return conversation


@router.post("/meet-prep/{meet_id}", response_model=ConversationOut)
async def meet_prep(
    meet_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = "Help me prepare for my upcoming meet. Give me advice on peaking, attempt selection, and any adjustments I should make."

    try:
        response_text, context_snapshot = await ask_coach(
            db, "meet_prep", message, user_id=current_user.id, extra={"meet_id": meet_id}
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

    conversation = AIConversation(
        user_id=current_user.id,
        context_type="meet_prep",
        user_message=message,
        ai_response=response_text,
        context_snapshot=context_snapshot,
    )
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    return conversation


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(AIConversation)
        .where(AIConversation.user_id == current_user.id)
        .order_by(desc(AIConversation.created_at))
        .limit(50)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put("/conversations/{conversation_id}", response_model=ConversationOut)
async def update_conversation(
    conversation_id: int,
    data: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AIConversation).where(
            AIConversation.id == conversation_id,
            AIConversation.user_id == current_user.id,
        )
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(conversation, key, value)

    await db.commit()
    await db.refresh(conversation)
    return conversation


# ---------- AI XLSX Import ----------


@router.post("/import-xlsx")
async def ai_import_xlsx(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
    ):
        raise HTTPException(status_code=400, detail="Only .xlsx files are supported.")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        result = await ai_parse_xlsx(file_bytes, db)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI import error: {str(e)}")

    return result
