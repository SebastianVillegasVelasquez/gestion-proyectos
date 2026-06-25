"""Seed del espacio de trabajo de un equipo (datos reales para el front).

Crea (idempotente) un equipo con líder, supervisor e integrante, y entregables
con su línea de tiempo de entregas (enlace, repositorio, SCORM) e hilo de
retroalimentación (comentarios, solicitud de cambios y aprobación).

El integrante es `usuario.demo@obj.com` (la cuenta de prueba), para que al entrar
vea el espacio con permisos de integrante.

Standalone: NO se ejecuta solo. En producción simplemente no se corre.
Uso: poetry run python scripts/seed_workspace.py
"""

import asyncio

from sqlalchemy import select

import app.core.models_registry  # noqa: F401  (registra los mappers ORM)
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.modules.identity.infrastructure.enums import SystemRole, UserPosition
from app.modules.identity.infrastructure.models import User
from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.infrastructure.models import Team, TeamMember
from app.modules.teams.infrastructure.workspace_enums import (
    CommentType,
    DeliverableStatus,
    ResourceType,
)
from app.modules.teams.infrastructure.workspace_models import (
    Deliverable,
    DeliverableComment,
    DeliverableVersion,
)

TEAM_NAME = "Célula de Diseño Instruccional (Demo)"
INTEGRANTE_EMAIL = "usuario.demo@obj.com"


async def _ensure_user(session, email, name, last_name, position) -> User:
    user = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if user:
        return user
    user = User(
        email=email,
        password=hash_password("Demo1234*"),
        name=name,
        last_name=last_name,
        role=SystemRole.USER,
        position=position,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def main() -> None:
    async with AsyncSessionLocal() as session:
        if (
            await session.execute(select(Team.id).where(Team.name == TEAM_NAME))
        ).first():
            print(f"- Ya existe '{TEAM_NAME}', se omite.")
            return

        lider = await _ensure_user(
            session,
            "ana.lider@obj.com",
            "Ana",
            "Morales",
            UserPosition.DISENADOR_INSTRUCCIONAL,
        )
        supervisor = await _ensure_user(
            session,
            "diego.super@obj.com",
            "Diego",
            "Torres",
            UserPosition.CONTROL_CALIDAD,
        )
        integrante = await _ensure_user(
            session,
            INTEGRANTE_EMAIL,
            "Usuario",
            "Demo",
            UserPosition.DESARROLLADOR_FRONTEND,
        )

        team = Team(
            name=TEAM_NAME,
            description="Diseño pedagógico y creación de contenidos del OVA.",
        )
        session.add(team)
        await session.flush()
        session.add_all(
            [
                TeamMember(team_id=team.id, user_id=lider.id, team_role=TeamRole.LIDER),
                TeamMember(
                    team_id=team.id,
                    user_id=supervisor.id,
                    team_role=TeamRole.SUPERVISOR,
                ),
                TeamMember(
                    team_id=team.id,
                    user_id=integrante.id,
                    team_role=TeamRole.INTEGRANTE,
                ),
            ]
        )
        await session.flush()

        def new_deliverable(title, status):
            d = Deliverable(
                team_id=team.id,
                task_title=title,
                assignee_id=integrante.id,
                status=status,
            )
            session.add(d)
            return d

        def version(deliverable, n, rtype, url, note, by):
            session.add(
                DeliverableVersion(
                    deliverable=deliverable,
                    version_number=n,
                    resource_type=rtype,
                    url=url,
                    note=note,
                    uploaded_by=by.id,
                )
            )

        def comment(deliverable, author, content, ctype, mentions=()):
            session.add(
                DeliverableComment(
                    deliverable=deliverable,
                    author_id=author.id,
                    content=content,
                    comment_type=ctype,
                    mentions=[str(m.id) for m in mentions],
                )
            )

        # 1) Prototipo — ciclo completo aprobado (enlace + iteración).
        proto = new_deliverable(
            "Prototipo de Interfaz — Módulo 1", DeliverableStatus.APROBADO
        )
        version(
            proto,
            1,
            ResourceType.ENLACE,
            "https://figma.com/proto/abc/Modulo1-v1",
            "Primera versión del prototipo, flujo completo.",
            integrante,
        )
        version(
            proto,
            2,
            ResourceType.ENLACE,
            "https://figma.com/proto/abc/Modulo1-v2",
            "V2: tipografías corregidas al sistema de diseño.",
            integrante,
        )
        comment(
            proto,
            integrante,
            "Adjunto el prototipo para revisión.",
            CommentType.COMENTARIO,
        )
        comment(
            proto,
            lider,
            "Ajusta las tipografías al sistema de diseño.",
            CommentType.SOLICITUD_CAMBIO,
            mentions=[integrante],
        )
        comment(
            proto,
            integrante,
            "Correcciones aplicadas en la V2.",
            CommentType.COMENTARIO,
        )
        comment(
            proto,
            lider,
            "Excelente, aprobado.",
            CommentType.APROBACION,
            mentions=[integrante],
        )

        # 2) Componentes — repositorio con cambios solicitados por el supervisor.
        quiz = new_deliverable(
            "Componentes Frontend — Quiz", DeliverableStatus.CAMBIOS_SOLICITADOS
        )
        version(
            quiz,
            1,
            ResourceType.REPOSITORIO,
            "https://github.com/org/ova-quiz/pull/12",
            "PR con los componentes del quiz (4 tipos de pregunta).",
            integrante,
        )
        comment(
            quiz,
            integrante,
            "PR listo para review.",
            CommentType.COMENTARIO,
            mentions=[supervisor],
        )
        comment(
            quiz,
            supervisor,
            "Faltan aria-labels en los inputs. Ajusta antes del merge.",
            CommentType.SOLICITUD_CAMBIO,
            mentions=[integrante],
        )

        # 3) Paquete SCORM — en revisión.
        scorm = new_deliverable(
            "Paquete SCORM — Módulo 1", DeliverableStatus.EN_REVISION
        )
        version(
            scorm,
            1,
            ResourceType.SCORM,
            "https://lms.obj.com/scorm/ova-modulo1-v1.zip",
            "Paquete SCORM 1.2 listo para cargar al LMS.",
            integrante,
        )
        comment(
            scorm,
            integrante,
            "Paquete validado en el LMS de pruebas.",
            CommentType.COMENTARIO,
            mentions=[lider],
        )

        await session.commit()
        print(f"[OK] Equipo '{TEAM_NAME}' con 3 entregables sembrado.")
        print(f"     team_id = {team.id}")


if __name__ == "__main__":
    asyncio.run(main())
