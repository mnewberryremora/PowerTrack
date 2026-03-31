import asyncio
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password, get_current_user
from app.db import get_db
from app.models.invite import Invite
from app.models.user import User
from app.schemas.auth import RegisterResponse, Token, UserLogin, UserOut, UserRegister
from app.services.email_service import send_new_user_notification

router = APIRouter()


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # Check invite token
    invite = None
    if data.invite_token:
        result = await db.execute(select(Invite).where(Invite.token == data.invite_token))
        invite = result.scalar_one_or_none()
        if not invite or not invite.is_active:
            raise HTTPException(status_code=400, detail="Invalid or expired invite link")
        if invite.expires_at and invite.expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="This invite link has expired")
        if invite.max_uses and invite.use_count >= invite.max_uses:
            raise HTTPException(status_code=400, detail="This invite link has reached its usage limit")

    auto_approve = invite is not None
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        display_name=data.display_name,
        status="approved" if auto_approve else "pending",
    )
    db.add(user)

    if invite:
        invite.use_count += 1

    await db.commit()
    await db.refresh(user)

    if not auto_approve:
        asyncio.create_task(send_new_user_notification(user.email, user.display_name))

    msg = "Registration successful! You can now log in." if auto_approve else "Registration successful. Your account is pending admin approval."
    return RegisterResponse(message=msg)


@router.post("/login", response_model=Token)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    if not user.is_admin:
        if user.status == "pending":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account pending admin approval")
        if user.status == "denied":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account access has been denied")

    return Token(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
