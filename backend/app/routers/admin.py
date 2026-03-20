from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_admin
from app.db import get_db
from app.models.user import User

router = APIRouter()


class UserAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    display_name: str | None
    status: str
    is_admin: bool
    is_active: bool
    created_at: datetime


class StatusUpdate(BaseModel):
    status: str  # "approved" | "denied"


@router.get("/users", response_model=list[UserAdminOut])
async def list_users(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_admin)):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.patch("/users/{user_id}/status", response_model=UserAdminOut)
async def update_user_status(
    user_id: int,
    data: StatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    if data.status not in ("approved", "denied", "pending"):
        raise HTTPException(status_code=400, detail="Invalid status")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own status")
    user.status = data.status
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/users/{user_id}/admin", response_model=UserAdminOut)
async def toggle_admin(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own admin status")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = not user.is_admin
    await db.commit()
    await db.refresh(user)
    return user
