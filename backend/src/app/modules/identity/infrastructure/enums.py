from enum import Enum


class SystemRole(str, Enum):
    """Roles globales del sistema.

    Dictan la autorización a nivel de plataforma (Rutas e infraestructura de FastAPI).
    """

    DEVELOPER = "developer"  # Rol técnico (programador): tope de jerarquía + bandeja de feedback.
    SUPER_ADMIN = (
        "super_admin"  # Control total del sistema, borrado físico, gestión de admins.
    )
    ADMIN = "admin"  # Gestión de usuarios, creación de proyectos y reportería general.
    USER = "user"  # Usuario estándar que puede entrar al sistema y participar en proyectos.
    CLIENT = "client"  # Acceso restringido: solo ve el resumen de su(s) proyecto(s).


class UserPosition(str, Enum):
    """Cargos operativos o perfiles profesionales del usuario.

    Se almacena en el modelo User y sirve exclusivamente para filtrado y asignación de recursos.

    Vocabulario controlado por desarrollo (no gestionable en runtime). Para añadir un
    cargo: agregar el miembro aquí y crear una migración Alembic con
    ``ALTER TYPE user_position ADD VALUE`` (el tipo nativo de Postgres almacena por NOMBRE).
    """

    # ── Existentes ──
    DESARROLLADOR = "desarrollador"
    EXPERTO_MULTIMEDIA = "experto_multimedia"
    PROJECT_MANAGER = "project_manager"
    SIN_CARGO = "sin_cargo"
    DISENADOR_INSTRUCCIONAL = (
        "diseñador_instruccional"  # Estructura pedagógicamente unidades/módulos.
    )
    EXPERTO_TEMATICO = (
        "experto_tematico"  # Docente/especialista que provee el contenido base.
    )
    CORRECTOR_ESTILO = (
        "corrector_estilo"  # Revisa ortografía, redacción y coherencia pedagógica.
    )
    DISENADOR_GRAFICO = "diseñador_grafico"  # Infografías, recursos visuales y banners.
    ADMINISTRADOR_MOODLE = (
        "administrador_moodle"  # Configuración técnica y montaje en el LMS.
    )

    # ── Virtualización / e-learning (foco principal de la empresa) ──
    COORDINADOR_VIRTUALIZACION = "coordinador_virtualizacion"  # Coordina el equipo y el pipeline de virtualización.
    DESARROLLADOR_ELEARNING = (
        "desarrollador_elearning"  # Empaqueta cursos SCORM/HTML5 (Storyline, etc.).
    )
    PRODUCTOR_AUDIOVISUAL = (
        "productor_audiovisual"  # Planifica y produce piezas de video/audio.
    )
    EDITOR_VIDEO = "editor_video"  # Edición y postproducción audiovisual.
    TUTOR_VIRTUAL = "tutor_virtual"  # Acompaña y facilita a los estudiantes en línea.
    CONTROL_CALIDAD = (
        "control_calidad"  # QA pedagógico y técnico de los cursos publicados.
    )

    # ── TI (línea en expansión) ──
    DESARROLLADOR_FRONTEND = "desarrollador_frontend"
    DESARROLLADOR_BACKEND = "desarrollador_backend"
    INGENIERO_DEVOPS = "ingeniero_devops"
    DISENADOR_UX_UI = "diseñador_ux_ui"
    ADMINISTRADOR_BD = "administrador_bd"
    ANALISTA_QA = "analista_qa"  # Pruebas de software.
    SOPORTE_TECNICO = "soporte_tecnico"

    # ── Gestión / coordinación ──
    LIDER_TECNICO = "lider_tecnico"
    ANALISTA_FUNCIONAL = "analista_funcional"


# Etiquetas legibles (es-CO) en el ORDEN de presentación del selector de registro.
# El diccionario preserva el orden de inserción → así se ofrecen al usuario.
POSITION_LABELS: dict[UserPosition, str] = {
    # Virtualización / e-learning
    UserPosition.COORDINADOR_VIRTUALIZACION: "Coordinador/a de virtualización",
    UserPosition.DISENADOR_INSTRUCCIONAL: "Diseñador/a instruccional",
    UserPosition.EXPERTO_TEMATICO: "Experto/a temático",
    UserPosition.DESARROLLADOR_ELEARNING: "Desarrollador/a e-learning (SCORM/HTML5)",
    UserPosition.ADMINISTRADOR_MOODLE: "Administrador/a de Moodle (LMS)",
    UserPosition.CORRECTOR_ESTILO: "Corrector/a de estilo",
    UserPosition.TUTOR_VIRTUAL: "Tutor/a virtual",
    UserPosition.CONTROL_CALIDAD: "Control de calidad (QA de cursos)",
    # Multimedia / audiovisual
    UserPosition.EXPERTO_MULTIMEDIA: "Experto/a en multimedia",
    UserPosition.PRODUCTOR_AUDIOVISUAL: "Productor/a audiovisual",
    UserPosition.EDITOR_VIDEO: "Editor/a de video",
    UserPosition.DISENADOR_GRAFICO: "Diseñador/a gráfico",
    # TI / desarrollo
    UserPosition.DESARROLLADOR: "Desarrollador/a de software",
    UserPosition.DESARROLLADOR_FRONTEND: "Desarrollador/a Frontend",
    UserPosition.DESARROLLADOR_BACKEND: "Desarrollador/a Backend",
    UserPosition.INGENIERO_DEVOPS: "Ingeniero/a DevOps",
    UserPosition.DISENADOR_UX_UI: "Diseñador/a UX/UI",
    UserPosition.ADMINISTRADOR_BD: "Administrador/a de base de datos",
    UserPosition.ANALISTA_QA: "Analista QA (pruebas de software)",
    UserPosition.SOPORTE_TECNICO: "Soporte técnico",
    # Gestión / coordinación
    UserPosition.PROJECT_MANAGER: "Project Manager",
    UserPosition.LIDER_TECNICO: "Líder técnico",
    UserPosition.ANALISTA_FUNCIONAL: "Analista funcional",
    # Fallback
    UserPosition.SIN_CARGO: "Prefiero no especificarlo",
}
