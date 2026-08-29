from uuid import UUID

from fastapi import APIRouter, Depends
from starlette import status

from app.core.dependencies import get_current_user, reminder_repo_dependency
from app.modules.identity.presentation.schemas import UserResponse
from app.modules.reminders.application.use_cases import ReminderService
from app.modules.reminders.infrastructure.enums import ReminderStatus
from app.modules.reminders.presentation.schemas import (
    CreateReminderRequest,
    ReminderResponse,
    UpdateReminderRequest,
)

router = APIRouter(prefix="/reminders", tags=["Reminders"])


@router.get("/", response_model=list[ReminderResponse])
async def list_my_reminders(
    reminder_status: ReminderStatus | None = None,
    repo=Depends(reminder_repo_dependency),
    current_user: UserResponse = Depends(get_current_user),
):
    return await ReminderService(repo).list_mine(current_user.id, reminder_status)


@router.post("/", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    data: CreateReminderRequest,
    repo=Depends(reminder_repo_dependency),
    current_user: UserResponse = Depends(get_current_user),
):
    return await ReminderService(repo).create(current_user.id, data)


@router.patch("/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(
    reminder_id: UUID,
    data: UpdateReminderRequest,
    repo=Depends(reminder_repo_dependency),
    current_user: UserResponse = Depends(get_current_user),
):
    return await ReminderService(repo).update(reminder_id, current_user.id, data)


@router.post("/{reminder_id}/cancel", response_model=ReminderResponse)
async def cancel_reminder(
    reminder_id: UUID,
    repo=Depends(reminder_repo_dependency),
    current_user: UserResponse = Depends(get_current_user),
):
    return await ReminderService(repo).cancel(reminder_id, current_user.id)


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    reminder_id: UUID,
    repo=Depends(reminder_repo_dependency),
    current_user: UserResponse = Depends(get_current_user),
):
    await ReminderService(repo).delete(reminder_id, current_user.id)
