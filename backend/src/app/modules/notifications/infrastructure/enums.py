import enum


class NotificationType(str, enum.Enum):
    # Notificacion para todos los usuarios acerca de tareas
    TAREA_ASIGNADA = "tarea_asignada"
    TAREA_ENTREGADA = "tarea_entregada"
    TAREA_RECHAZADA = "tarea_rechazada"
    TAREA_ATRASADA = "tarea_atrasada"
    TAREA_COMPLETADA = "tarea_completada"
    TAREA_DEVUELTA = "tarea_devuelta"

    # Notificacion para todos los usuarios acerca de proyectos
    PROYECTO_MIEMBRO_AGREGADO = "proyecto_miembro_agregado"
    PROYECTO_CERRADO = "proyecto_cerrado"
    PROYECTO_INICIADO = "proyecto_iniciado"
    PROYECTO_PAUSADO = "proyecto_pausado"
    PROYECTO_FINALIZADO = "proyecto_finalizado"

    # Notificacion para todos los usuarios acerca del workspace
    COMENTARIO_PUBLICADO = "comentario_publicado"
    COMENTARIO_RESPUESTA = "comentario_respuesta"
    MENCION = "mencion"
