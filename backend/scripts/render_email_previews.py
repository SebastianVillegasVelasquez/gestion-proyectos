"""Renderiza cada plantilla de correo a un HTML estático para revisarla en el
navegador, sin levantar nada.

    cd backend && poetry run python scripts/render_email_previews.py

Salida: ``src/app/shared/email/previews/*.html`` (versionados). El logo va
embebido como ``data:`` URI SOLO para poder abrir el archivo suelto; en el
envío real se usa ``{APP_PUBLIC_URL}/logo.webp`` porque los clientes de correo
bloquean las imágenes ``data:``.
"""

from __future__ import annotations

import datetime
import re
from pathlib import Path

from app.shared.email.templates import (
    deliverable_submitted_email,
    overdue_task_email,
    reminder_email,
    welcome_email,
)

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "src" / "app" / "shared" / "email" / "previews"
LOGO_SVG = ROOT.parent / "frontend" / "public" / "logo-as-svg.svg"


def _logo_data_uri() -> str:
    svg = LOGO_SVG.read_text(encoding="utf-8")
    match = re.search(r'xlink:href="(data:image/[^"]+)"', svg)
    return match.group(1) if match else ""


def _note(subject: str) -> str:
    return (
        "<!--\n"
        "  Vista previa autogenerada por scripts/render_email_previews.py\n"
        "  Plantilla real: src/app/shared/email/templates.py\n"
        "  El logo va embebido como data URI SOLO para abrir este archivo suelto;\n"
        "  en el envio real se usa {APP_PUBLIC_URL}/logo.webp.\n"
        f"  Asunto: {subject}\n"
        "-->\n"
    )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    logo = _logo_data_uri()
    base = "https://bitacora.objdigital.com"

    previews = {
        "bienvenida.html": welcome_email(
            name="Ana Martínez",
            email="ana.martinez@objdigital.com",
            login_url=f"{base}/login",
            logo_url=logo,
        ),
        "tarea-atrasada.html": overdue_task_email(
            name="Ana Martínez",
            task_title="Grabar la Unidad 2",
            project_name="Diplomado en Innovación Educativa",
            due_date=datetime.date.today() - datetime.timedelta(days=3),
            days_overdue=3,
            task_url=f"{base}/projects/1/tareas",
        ),
        "entrega-para-revisar.html": deliverable_submitted_email(
            leader_name="Jorge Ríos",
            submitter_name="Ana Martínez",
            task_title="Guion de la Unidad 2",
            project_name="Diplomado en Innovación Educativa",
            review_url=f"{base}/workspace",
        ),
        "recordatorio.html": reminder_email(
            name="Ana Martínez",
            title="Llamar al cliente del Diplomado",
            note="Confirmar la fecha de publicación del primer módulo.",
        ),
    }

    for filename, mail in previews.items():
        (OUT_DIR / filename).write_text(
            _note(mail.subject) + mail.html, encoding="utf-8"
        )
        print(f"escrito: {OUT_DIR / filename}")


if __name__ == "__main__":
    main()
