# ── Identity models ───────────────────────────────────────────────────────────
from app.modules.identity.infrastructure.models import (
    User,
    UserRole,
)

# ── Project models ────────────────────────────────────────────────────────────
from app.modules.project.infrastructure.models import (
    Module,
    Project,
    ProjectMember,
    ProjectMemberRole,
    ProjectStatus,
    ProjectStatusType,
    Risk,
    RiskLevel,
)

# ── Tasks models ──────────────────────────────────────────────────────────────
from app.modules.tasks.infrastructure.models import (
    DependencyType,
    Task,
    TaskPriority,
    TaskStatus,
    TaskType,
)

# ── Notifications models ──────────────────────────────────────────────────────
from app.modules.notifications.infrastructure.models import (
    AlertFrequency,
    AlertRule,
    DeliveryLog,
    Notification,
    NotificationChannel,
    NotificationType,
)

# ── Scheduling models ─────────────────────────────────────────────────────────
from app.modules.scheduling.infrastructure.models import (
    GanttEntry,
    Reprogramming,
    Schedule,
)

# ── IA reporting ─────────────────────────────────────────────────────────
from app.modules.ia_reporting.infrastructure.models import Report

# ── Client portal ─────────────────────────────────────────────────────────
from app.modules.client_portal.infrastructure.models import ClientAccess

__all__ = [
    # Identity
    "User",
    "UserRole",
    # Project
    "Module",
    "Project",
    "ProjectMember",
    "ProjectMemberRole",
    "ProjectStatus",
    "ProjectStatusType",
    "Risk",
    "RiskLevel",
    # Tasks
    "DependencyType",
    "Task",
    "TaskPriority",
    "TaskStatus",
    "TaskType",
    # Notifications
    "AlertFrequency",
    "AlertRule",
    "DeliveryLog",
    "Notification",
    "NotificationChannel",
    "NotificationType",
    # Scheduling
    "GanttEntry",
    "Reprogramming",
    "Schedule",
    # Client portal
    "ClientAccess",
    # IA reporting
    "Report",
]
