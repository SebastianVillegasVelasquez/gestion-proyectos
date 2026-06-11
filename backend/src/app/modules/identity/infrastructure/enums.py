from enum import Enum


class SystemRole(str, Enum):
    """Roles globales del sistema.

    Dictan la autorización a nivel de plataforma (Rutas e infraestructura de FastAPI).
    """

    SUPER_ADMIN = (
        "super_admin"  # Control total del sistema, borrado físico, gestión de admins.
    )
    ADMIN = "admin"  # Gestión de usuarios, creación de proyectos y reportería general.
    USER = "user"  # Usuario estándar que puede entrar al sistema y participar en proyectos.


class UserPosition(str, Enum):
    """Cargos operativos o perfiles profesionales del usuario.

    Se almacena en el modelo User y sirve exclusivamente para filtrado y asignación de recursos.
    """

    # Existentes
    DESARROLLADOR = "desarrollador"
    EXPERTO_MULTIMEDIA = "experto_multimedia"
    PROJECT_MANAGER = "project_manager"
    SIN_CARGO = "sin_cargo"

    # Nuevas posiciones comunes en Virtualización de Cursos
    DISENADOR_INSTRUCCIONAL = "diseñador_instruccional"  # El que pedagógicamente estructura las unidades/módulos.
    EXPERTO_TEMATICO = (
        "experto_tematico"  # El docente o especialista que provee el contenido base.
    )
    CORRECTOR_ESTILO = "corrector_estilo"  # Quien revisa la ortografía, redacción y coherencia pedagógica.
    DISENADOR_GRAFICO = (
        "diseñador_grafico"  # Creación de infografías, recursos visuales y banners.
    )
    ADMINISTRADOR_MOODLE = "administrador_moodle"  # Quien se encarga de la configuración técnica y montaje en el LMS.
