from __future__ import annotations

from app.core.dependencies import ProjectRepositories
from app.modules.project.presentation.schemas import (
    ProjectCreateRequest,
    ProjectDetailResponse,
)
from app.modules.project.domain.services import ProjectService
from app.modules.project.infrastructure.repository import (
    ModuleRepository,
    ProjectMemberRepository,
    ProjectRepository,
    ProjectStatusRepository,
    RiskRepostory,
)


class CreateProjectUseCase:
    """
    Orquesta la creación de un proyecto nuevo.

    Flujo completo:
      1. El router de FastAPI recibe el JSON y lo valida con ProjectCreateRequest.
      2. Llama a CreateProjectUseCase.execute(data).
      3. El UseCase delega al ProjectService.create_project().
      4. El Service:
           a. Persiste el proyecto en la tabla `projects`.
           b. Siembra los 5 estados base en `project_statuses`.
           c. Asigna current_status_id al estado "Por iniciar".
           d. Agrega al coordinador en `project_members` con rol COORDINATOR.
      5. El UseCase convierte el ORM → Pydantic response y lo retorna.
      6. El router serializa el response como JSON 201.
    """

    def __init__(
            self,
            project_repo_dependencies: ProjectRepositories

    ) -> None:
        self._service = ProjectService(
            project_repo_dependencies
        )

    async def execute(self, data: ProjectCreateRequest) -> ProjectDetailResponse:
        """
        Ejecuta el caso de uso y retorna la representación completa del proyecto.

        Lanza:
          ValueError        si end_date < start_date (validado por Pydantic).
          ProjectNotFound   nunca en creación, pero el tipo está importado
                            por consistencia con otros UseCases del módulo.
        """
        project = await self._service.create_project(data)

        # Cargamos las relaciones necesarias para construir el response completo.
        # En producción esto puede reemplazarse por un select con joinedload
        # dentro del repo para evitar N+1.
        statuses = await self._service.list_statuses(project.id)
        members = await self._service.list_members(project.id)

        # Determinar el status actual para incluirlo en el response
        current_status = None
        if project.current_status_id:
            current_status = next(
                (s for s in statuses if s.id == project.current_status_id), None
            )

        # Construimos el response usando from_attributes=True (ya configurado
        # en _Base) — Pydantic lee los atributos del ORM directamente.
        # Para las relaciones anidadas pasamos los objetos ya cargados.
        return ProjectDetailResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            client_name=project.client_name,
            coordinator_id=project.coordinator_id,
            progress_pct=project.progress_pct,
            current_status=current_status,
            statuses=list(statuses),
            members=list(members),
            start_date=project.start_date,
            end_date=project.end_date,
            is_template=project.is_template,
            duplicated_from_id=project.duplicated_from_id,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )