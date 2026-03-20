import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password, get_current_user
from app.db import get_db
from app.models.user import User
from app.schemas.auth import RegisterResponse, Token, UserLogin, UserOut, UserRegister
from app.services.email_service import send_new_user_notification

router = APIRouter()


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        display_name=data.display_name,
        status="pending",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    asyncio.create_task(send_new_user_notification(user.email, user.display_name))

    return RegisterResponse(message="Registration successful. Your account is pending admin approval.")


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
