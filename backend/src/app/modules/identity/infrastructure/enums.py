from enum import Enum


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    COORDINATOR = "coordinator"
    COLLABORATOR = "collaborator"
    MEMBER = "member"
    CLIENT = "client"
