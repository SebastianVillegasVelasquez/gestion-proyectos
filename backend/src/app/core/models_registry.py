# ── Identity models ───────────────────────────────────────────────────────────
from app.modules.identity.infrastructure.models import Position, User

# ── Project models ────────────────────────────────────────────────────────────
from app.modules.project.infrastructure.models import Project, ProjectMember

from app.modules.tasks.infrastructure.models import (
    Task,
    TaskDependency,
    TaskHistory,
    TaskTimeEntry,
)

# ── Teams models ──────────────────────────────────────────────────────────────
from app.modules.teams.infrastructure.models import Team, TeamMember
from app.modules.teams.infrastructure.workspace_models import (
    Deliverable,
    DeliverableComment,
    DeliverableVersion,
)

# ── WorkTree models ───────────────────────────────────────────────────────────
from app.modules.project.structure.infrastructure.models import (
    TipoNodo,
    WorkItem,
    WorkItemDependency,
)

# ── Notifications models ──────────────────────────────────────────────────────
from app.modules.notifications.infrastructure.models import Notification

# ── Feedback models ───────────────────────────────────────────────────────────
from app.modules.feedback.infrastructure.models import Feedback

__all__ = [
    # Identity
    "User",
    "Position",
    # Project
    "Project",
    "ProjectMember",
    # Task
    "Task",
    "TaskHistory",
    "TaskDependency",
    "TaskTimeEntry",
    # Teams
    "Team",
    "TeamMember",
    "Deliverable",
    "DeliverableVersion",
    "DeliverableComment",
    # WorkTree
    "TipoNodo",
    "WorkItem",
    "WorkItemDependency",
    # Notifications
    "Notification",
    # Feedback
    "Feedback",
]
