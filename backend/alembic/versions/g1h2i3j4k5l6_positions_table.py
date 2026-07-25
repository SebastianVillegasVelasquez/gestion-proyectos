"""Convert user_position enum into a mutable positions table

Revision ID: g1h2i3j4k5l6
Revises: c5d6e7f8a9b0
Create Date: 2026-07-25

La plataforma es de uso interno/privado (se elimina el registro público). El
flujo pasa a ser: admin/super_admin/developer crean las cuentas nuevas. Un
requisito de ese flujo es poder dar de alta un cargo que la empresa nunca
había tenido SIN esperar un deploy con migración Alembic (el enum nativo de
Postgres ``user_position`` obligaba a ``ALTER TYPE ... ADD VALUE`` por cada
cargo nuevo).

Esta migración:
  1. Crea la tabla ``positions`` (key/label/is_active) y la siembra con los
     valores que ya existían en el enum ``user_position``.
  2. Migra ``users.position`` de enum nativo a ``VARCHAR(64)`` con FK a
     ``positions.key``. IMPORTANTE: ``Enum(UserPosition, name="user_position")``
     se declaró SIN ``values_callable`` (ver init_schema/expand_user_positions),
     así que Postgres almacena el NOMBRE del miembro en mayúsculas (p. ej.
     ``DISENADOR_INSTRUCCIONAL``), no su ``.value`` en minúsculas con tildes
     (``diseñador_instruccional``). El backfill mapea explícitamente
     NOMBRE -> key porque en 3 casos difieren más que por mayúsculas (la "ñ").
  3. Elimina el tipo enum ``user_position`` (ya no se usa en ningún lado).
"""

import sqlalchemy as sa
from alembic import op

revision = "g1h2i3j4k5l6"
down_revision = "c5d6e7f8a9b0"
branch_labels = None
depends_on = None

# (key, label) — copia textual de UserPosition/POSITION_LABELS en
# app/modules/identity/infrastructure/enums.py al momento de esta migración.
SEED_POSITIONS = [
    ("coordinador_virtualizacion", "Coordinador/a de virtualización"),
    ("diseñador_instruccional", "Diseñador/a instruccional"),
    ("experto_tematico", "Experto/a temático"),
    ("desarrollador_elearning", "Desarrollador/a e-learning (SCORM/HTML5)"),
    ("administrador_moodle", "Administrador/a de Moodle (LMS)"),
    ("corrector_estilo", "Corrector/a de estilo"),
    ("tutor_virtual", "Tutor/a virtual"),
    ("control_calidad", "Control de calidad (QA de cursos)"),
    ("experto_multimedia", "Experto/a en multimedia"),
    ("productor_audiovisual", "Productor/a audiovisual"),
    ("editor_video", "Editor/a de video"),
    ("diseñador_grafico", "Diseñador/a gráfico"),
    ("desarrollador", "Desarrollador/a de software"),
    ("desarrollador_frontend", "Desarrollador/a Frontend"),
    ("desarrollador_backend", "Desarrollador/a Backend"),
    ("ingeniero_devops", "Ingeniero/a DevOps"),
    ("diseñador_ux_ui", "Diseñador/a UX/UI"),
    ("administrador_bd", "Administrador/a de base de datos"),
    ("analista_qa", "Analista QA (pruebas de software)"),
    ("soporte_tecnico", "Soporte técnico"),
    ("project_manager", "Project Manager"),
    ("lider_tecnico", "Líder técnico"),
    ("analista_funcional", "Analista funcional"),
    ("sin_cargo", "Prefiero no especificarlo"),
]

# NOMBRE del miembro del enum (tal cual queda almacenado en Postgres) -> key.
ENUM_NAME_TO_KEY = {
    "COORDINADOR_VIRTUALIZACION": "coordinador_virtualizacion",
    "DISENADOR_INSTRUCCIONAL": "diseñador_instruccional",
    "EXPERTO_TEMATICO": "experto_tematico",
    "DESARROLLADOR_ELEARNING": "desarrollador_elearning",
    "ADMINISTRADOR_MOODLE": "administrador_moodle",
    "CORRECTOR_ESTILO": "corrector_estilo",
    "TUTOR_VIRTUAL": "tutor_virtual",
    "CONTROL_CALIDAD": "control_calidad",
    "EXPERTO_MULTIMEDIA": "experto_multimedia",
    "PRODUCTOR_AUDIOVISUAL": "productor_audiovisual",
    "EDITOR_VIDEO": "editor_video",
    "DISENADOR_GRAFICO": "diseñador_grafico",
    "DESARROLLADOR": "desarrollador",
    "DESARROLLADOR_FRONTEND": "desarrollador_frontend",
    "DESARROLLADOR_BACKEND": "desarrollador_backend",
    "INGENIERO_DEVOPS": "ingeniero_devops",
    "DISENADOR_UX_UI": "diseñador_ux_ui",
    "ADMINISTRADOR_BD": "administrador_bd",
    "ANALISTA_QA": "analista_qa",
    "SOPORTE_TECNICO": "soporte_tecnico",
    "PROJECT_MANAGER": "project_manager",
    "LIDER_TECNICO": "lider_tecnico",
    "ANALISTA_FUNCIONAL": "analista_funcional",
    "SIN_CARGO": "sin_cargo",
}


def upgrade() -> None:
    op.create_table(
        "positions",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=150), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_index("ix_positions_key", "positions", ["key"], unique=True)

    positions_table = sa.table(
        "positions",
        sa.column("key", sa.String),
        sa.column("label", sa.String),
    )
    op.bulk_insert(
        positions_table,
        [{"key": key, "label": label} for key, label in SEED_POSITIONS],
    )

    # users.position: enum nativo (almacena el NOMBRE del miembro) -> string
    # con FK a positions.key (el VALUE del enum).
    op.add_column(
        "users", sa.Column("position_new", sa.String(length=64), nullable=True)
    )
    case_sql = " ".join(
        f"WHEN '{name}' THEN '{key}'" for name, key in ENUM_NAME_TO_KEY.items()
    )
    op.execute(f"UPDATE users SET position_new = CASE position::text {case_sql} END")
    op.alter_column("users", "position_new", nullable=False)
    op.drop_column("users", "position")
    op.alter_column("users", "position_new", new_column_name="position")
    op.create_foreign_key(
        "fk_users_position_positions_key",
        "users",
        "positions",
        ["position"],
        ["key"],
    )

    op.execute("DROP TYPE IF EXISTS user_position")


def downgrade() -> None:
    op.execute(
        "CREATE TYPE user_position AS ENUM ("
        + ", ".join(f"'{name}'" for name in ENUM_NAME_TO_KEY)
        + ")"
    )

    op.drop_constraint("fk_users_position_positions_key", "users", type_="foreignkey")
    op.alter_column("users", "position", new_column_name="position_old")
    op.add_column(
        "users",
        sa.Column(
            "position",
            sa.Enum(name="user_position", create_type=False),
            nullable=True,
        ),
    )
    case_sql = " ".join(
        f"WHEN '{key}' THEN '{name}'" for name, key in ENUM_NAME_TO_KEY.items()
    )
    op.execute(
        f"UPDATE users SET position = (CASE position_old {case_sql} END)::user_position"
    )
    op.alter_column("users", "position", nullable=False)
    op.drop_column("users", "position_old")

    op.drop_index("ix_positions_key", table_name="positions")
    op.drop_table("positions")
