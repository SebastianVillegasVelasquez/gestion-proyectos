from enum import Enum


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    COORDINADOR = "coordinador"
    COLABORADOR = "colaborador"
    INTEGRANTE = "integrante"
    CLIENTE = "cliente"


class UserPosition(str, Enum):
    DESARROLLADOR = "desarrollador"
    EXPERTO_MULTIMEDIA = "experto_multimedia"
    PROJECT_MANAGER = "project_manager"
    SIN_CARGO = "sin_cargo"
