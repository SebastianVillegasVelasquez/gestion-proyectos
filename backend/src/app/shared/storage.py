"""Almacenamiento de archivos subidos por los usuarios.

La plataforma guarda dos cosas muy distintas —la foto de perfil y los archivos
de un proyecto— y ninguna de las dos pertenece a la base de datos: en Postgres
solo vive el *metadato* (quién lo subió, cómo se llama, dónde está), y el byte
va a disco bajo una clave opaca.

El contrato (`FileStorage`) existe para que mudarse a S3/GCS más adelante sea
escribir otra implementación y cambiar una dependencia, sin tocar ni un caso de
uso. La implementación de hoy es disco local: en Docker basta montar un volumen
en `STORAGE_DIR`.
"""

from __future__ import annotations

import re
import unicodedata
import uuid
from pathlib import Path
from typing import Protocol

from app.shared.exceptions import NotFoundError, ValidationError

# Extensiones que aceptamos como imagen de perfil / portada.
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
IMAGE_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
}

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._ -]+")


def sanitize_filename(name: str, *, fallback: str = "archivo") -> str:
    """Nombre de archivo legible y seguro para mostrar y para descargar.

    No es la clave de almacenamiento (esa es un UUID): es el nombre que ve la
    persona. Aun así se limpia, porque acaba en una cabecera `Content-Disposition`
    y en un `<a download>`: barras, saltos de línea y comillas ahí son un
    problema, no una curiosidad.
    """
    plain = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    cleaned = _SAFE_NAME.sub("", plain).strip().strip(".")
    return (cleaned or fallback)[:200]


def extension_of(name: str) -> str:
    """Extensión en minúsculas (con el punto), o cadena vacía si no tiene."""
    suffix = Path(name).suffix.lower()
    return suffix if len(suffix) <= 12 else ""


class FileStorage(Protocol):
    """Guarda y recupera bytes bajo una clave opaca."""

    def save(self, prefix: str, filename: str, content: bytes) -> str:
        """Guarda `content` y devuelve la clave con la que recuperarlo."""
        ...

    def read(self, key: str) -> bytes: ...

    def path(self, key: str) -> Path:
        """Ruta física, para servir el archivo sin cargarlo en memoria."""
        ...

    def delete(self, key: str) -> None: ...


class LocalFileStorage(FileStorage):
    """Disco local bajo un directorio raíz.

    Las claves son `<prefijo>/<uuid><extensión>`: opacas (no se puede adivinar
    la foto de otra persona), planas (sin nombres de usuario en la ruta) y
    estables. Toda clave que llega de fuera se resuelve y se comprueba que caiga
    DENTRO de la raíz: es la única defensa que hace falta contra `../../etc`.
    """

    def __init__(self, root: str | Path) -> None:
        self._root = Path(root).resolve()

    def _resolve(self, key: str) -> Path:
        target = (self._root / key).resolve()
        if target != self._root and self._root not in target.parents:
            raise ValidationError("Ruta de archivo inválida")
        return target

    def save(self, prefix: str, filename: str, content: bytes) -> str:
        key = f"{prefix.strip('/')}/{uuid.uuid4().hex}{extension_of(filename)}"
        target = self._resolve(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        return key

    def read(self, key: str) -> bytes:
        target = self._resolve(key)
        if not target.is_file():
            raise NotFoundError("El archivo ya no está disponible")
        return target.read_bytes()

    def path(self, key: str) -> Path:
        target = self._resolve(key)
        if not target.is_file():
            raise NotFoundError("El archivo ya no está disponible")
        return target

    def delete(self, key: str) -> None:
        # Borrar algo que ya no está no es un error: la operación es idempotente
        # (un reintento del cliente no debe fallar).
        self._resolve(key).unlink(missing_ok=True)
