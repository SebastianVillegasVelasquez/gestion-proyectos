# ── Identity models ───────────────────────────────────────────────────────────
from app.modules.identity.infrastructure.models import User

# ── Project models ────────────────────────────────────────────────────────────
from app.modules.project.infrastructure.models import Project, ProjectMember

from app.modules.tasks.infrastructure.models import (
    Task,
    TaskDependency,
    TaskHistory,
)

# ── Teams models ──────────────────────────────────────────────────────────────
from app.modules.teams.infrastructure.models import Team, TeamMember

# ── WorkTree models ───────────────────────────────────────────────────────────
from app.modules.project.structure.infrastructure.models import (
    TipoNodo,
    WorkItem,
    WorkItemDependency,
)

# ── Notifications models ──────────────────────────────────────────────────────
from app.modules.notifications.infrastructure.models import Notification

__all__ = [
    # Identity
    "User",
    # Project
    "Project",
    "ProjectMember",
    # Task
    "Task",
    "TaskHistory",
    "TaskDependency",
    # Teams
    "Team",
    "TeamMember",
    # WorkTree
    "TipoNodo",
    "WorkItem",
    "WorkItemDependency",
    # Notifications
    "Notification",
]
