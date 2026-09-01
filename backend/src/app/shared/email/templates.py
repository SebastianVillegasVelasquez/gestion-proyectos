"""Plantillas de correo de Bitácora OBJ.

Cada función devuelve un :class:`RenderedEmail` (asunto + HTML + texto plano).
La lógica de negocio decide *cuándo* mandar; aquí solo vive el *cómo se ve*.

Reglas de diseño (por qué así):
  * HTML con estilos **inline** y layout de tablas: Gmail/Outlook ignoran
    `<style>` y flexbox. Es feo de escribir pero es lo único que renderiza
    igual en todos los clientes.
  * Siempre se acompaña de una versión en texto plano: filtros anti-spam la
    exigen y algunos clientes la prefieren.
  * Paleta tomada de ``frontend/src/App.css`` (marca OBJ): dorado #e4b54f,
    teal #4da0b1, tinta #1c1b18.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

# ── Marca ────────────────────────────────────────────────────────────────────
GOLD = "#e4b54f"
GOLD_DARK = "#c49840"
TEAL = "#4da0b1"
INK = "#1c1b18"
MUTED = "#6b6862"
SURFACE = "#f5f5f4"
BORDER = "#e7e5e4"
RED = "#c4573a"


@dataclass(frozen=True)
class RenderedEmail:
    subject: str
    html: str
    text: str


def _button(label: str, url: str, color: str = GOLD) -> str:
    if not url:
        return ""
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" '
        f'style="margin:24px 0;"><tr><td align="center" bgcolor="{color}" '
        f'style="border-radius:8px;">'
        f'<a href="{url}" target="_blank" '
        f'style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;'
        f'font-size:15px;font-weight:bold;color:{INK};text-decoration:none;border-radius:8px;">'
        f"{label}</a></td></tr></table>"
    )


def _brand_header(logo_url: str) -> str:
    """Cabecera: logo (si hay URL) + marca denominativa. El texto queda como
    respaldo cuando el cliente bloquea imágenes."""
    wordmark = (
        f'<span style="font-size:13px;font-weight:bold;letter-spacing:2px;'
        f'color:{GOLD_DARK};text-transform:uppercase;">Bit&aacute;cora OBJ</span>'
    )
    if not logo_url:
        return wordmark
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0"><tr>'
        f'<td style="padding-right:12px;" bgcolor="#ffffff">'
        f'<img src="{logo_url}" width="40" height="40" alt="Bit&aacute;cora OBJ" '
        f'style="display:block;border:0;border-radius:9px;width:40px;max-width:40px;'
        f'height:auto;background:#ffffff;" /></td>'
        f'<td style="vertical-align:middle;">{wordmark}</td>'
        "</tr></table>"
    )


def _shell(*, title: str, preheader: str, body_html: str, logo_url: str = "") -> str:
    """Envoltura común: cabecera con banda dorada, contenido y pie."""
    return f"""\
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
</head>
<body style="margin:0;padding:0;background:{SURFACE};">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">{preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{SURFACE};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0"
           style="max-width:560px;width:100%;background:#ffffff;border:1px solid {BORDER};border-radius:14px;overflow:hidden;">
      <tr><td style="height:5px;background:{GOLD};"></td></tr>
      <tr><td style="padding:26px 36px 8px 36px;font-family:Arial,Helvetica,sans-serif;">
        {_brand_header(logo_url)}
      </td></tr>
      <tr><td style="padding:8px 36px 32px 36px;font-family:Arial,Helvetica,sans-serif;color:{INK};font-size:15px;line-height:1.6;">
        {body_html}
      </td></tr>
      <tr><td style="padding:20px 36px;background:{SURFACE};border-top:1px solid {BORDER};
                     font-family:Arial,Helvetica,sans-serif;font-size:12px;color:{MUTED};line-height:1.5;">
        Este es un mensaje autom&aacute;tico de Bit&aacute;cora OBJ, la plataforma de gesti&oacute;n
        de proyectos de OBJ Digital. Si no esperabas este correo, puedes ignorarlo.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>"""


def _h(text: str) -> str:
    return f'<h1 style="margin:0 0 12px 0;font-size:20px;color:{INK};">{text}</h1>'


def _p(text: str) -> str:
    return f'<p style="margin:0 0 14px 0;">{text}</p>'


def _facts(rows: list[tuple[str, str]]) -> str:
    cells = "".join(
        f"<tr>"
        f'<td style="padding:6px 12px 6px 0;color:{MUTED};font-size:13px;white-space:nowrap;">{k}</td>'
        f'<td style="padding:6px 0;color:{INK};font-size:14px;font-weight:bold;">{v}</td>'
        f"</tr>"
        for k, v in rows
    )
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" '
        f'style="margin:4px 0 8px 0;border-left:3px solid {GOLD};padding-left:14px;">'
        f"{cells}</table>"
    )


# ── Correos concretos ────────────────────────────────────────────────────────


def welcome_email(
    *,
    name: str,
    email: str,
    login_url: str = "",
    logo_url: str = "",
    temporary_password: str | None = None,
) -> RenderedEmail:
    """Bienvenida al crear la cuenta.

    Si ``temporary_password`` viene informada (el sistema la gener&oacute;: el admin
    no defini&oacute; ninguna), el correo la incluye — es lo que la persona necesita
    para entrar — y le avisa que caduca en 24 horas para empujarla a cambiarla.
    Si va vac&iacute;a, se asume que la clave la entrega quien dio el alta por otro
    canal.

    ``logo_url`` debe ser una URL http(s) accesible (p. ej.
    ``{APP_PUBLIC_URL}/logo-email.jpg``): los clientes de correo bloquean las
    im&aacute;genes en ``data:`` URI. Si va vac&iacute;a, la cabecera cae a la marca
    en texto.
    """
    subject = "Te damos la bienvenida a Bitácora OBJ"

    body = _h(f"Hola, {name}") + _p(
        "Se cre&oacute; una cuenta para ti en <strong>Bit&aacute;cora OBJ</strong>, "
        "la plataforma con la que damos seguimiento a los proyectos, tareas y "
        "entregables del equipo de OBJ Digital."
    )

    if temporary_password:
        body += _facts(
            [
                ("Usuario", email),
                (
                    "Contrase&ntilde;a temporal",
                    f'<span style="font-family:Consolas,Menlo,monospace;font-size:15px;'
                    f'letter-spacing:1px;">{temporary_password}</span>',
                ),
            ]
        ) + _p(
            f'<span style="color:{RED};font-weight:bold;">Esta contrase&ntilde;a '
            "caduca en 24 horas.</span> Entra cuanto antes: al ingresar, la "
            "plataforma te pedir&aacute; crear una contrase&ntilde;a propia que "
            "solo t&uacute; conozcas."
        )
    else:
        body += _facts([("Usuario", email)]) + _p(
            "Tu contrase&ntilde;a de acceso te la entregar&aacute; directamente la "
            "persona que te dio de alta. La primera vez que entres, la plataforma "
            "te pedir&aacute; crear tu propia contrase&ntilde;a."
        )

    body += _button("Entrar a la plataforma", login_url) + _p(
        f'<span style="color:{MUTED};font-size:13px;">Si el bot&oacute;n no funciona, '
        "copia y pega esta direcci&oacute;n en tu navegador:"
        f'<br /><span style="color:{TEAL};">{login_url or "—"}</span></span>'
    )

    text = (
        f"Hola, {name}\n\n"
        f"Se creó una cuenta para ti en Bitácora OBJ con el usuario {email}.\n"
    )
    if temporary_password:
        text += (
            f"\nContraseña temporal: {temporary_password}\n"
            "Esta contraseña caduca en 24 horas. Entra cuanto antes: al ingresar, "
            "la plataforma te pedirá crear una contraseña propia.\n"
        )
    else:
        text += (
            "Tu contraseña te la entregará la persona que te dio de alta. "
            "La primera vez que entres, la plataforma te pedirá crear tu propia "
            "contraseña.\n"
        )
    if login_url:
        text += f"\nEntrar a la plataforma: {login_url}\n"

    return RenderedEmail(
        subject=subject,
        html=_shell(
            title=subject,
            preheader="Tu cuenta ya está lista.",
            body_html=body,
            logo_url=logo_url,
        ),
        text=text,
    )


def overdue_task_email(
    *,
    name: str,
    task_title: str,
    project_name: str,
    due_date: date,
    days_overdue: int,
    task_url: str = "",
) -> RenderedEmail:
    """Advertencia: una tarea del responsable pasó su fecha de entrega."""
    plural = "día" if days_overdue == 1 else "días"
    subject = f"Tarea atrasada: {task_title}"
    body = (
        _h("Tienes una tarea atrasada")
        + _p(
            f"Hola {name}, la siguiente tarea super&oacute; su fecha de entrega y "
            "sigue sin marcarse como completada:"
        )
        + _facts(
            [
                ("Tarea", task_title),
                ("Proyecto", project_name),
                ("Venc&iacute;a", due_date.strftime("%d/%m/%Y")),
                (
                    "Atraso",
                    f'<span style="color:{RED};">{days_overdue} {plural}</span>',
                ),
            ]
        )
        + _p(
            "Si ya la terminaste, m&aacute;rcala como <em>en revisi&oacute;n</em> y sube "
            "tu entregable. Si necesitas m&aacute;s tiempo, avisa a tu l&iacute;der para "
            "reprogramar la fecha."
        )
        + _button("Abrir la tarea", task_url, color=GOLD)
    )
    text = (
        f"Hola {name},\n\n"
        f'La tarea "{task_title}" del proyecto "{project_name}" está atrasada '
        f"{days_overdue} {plural} (vencía el {due_date.strftime('%d/%m/%Y')}).\n\n"
        "Si ya la terminaste, márcala como en revisión y sube tu entregable. "
        "Si necesitas más tiempo, avisa a tu líder.\n"
    )
    if task_url:
        text += f"\nAbrir la tarea: {task_url}\n"
    return RenderedEmail(
        subject=subject,
        html=_shell(
            title=subject,
            preheader=f"{task_title} venció hace {days_overdue} {plural}.",
            body_html=body,
        ),
        text=text,
    )


def deliverable_submitted_email(
    *,
    leader_name: str,
    submitter_name: str,
    task_title: str,
    project_name: str,
    review_url: str = "",
) -> RenderedEmail:
    """Aviso al líder: un integrante entregó una tarea y espera revisión."""
    subject = f"Nueva entrega para revisar: {task_title}"
    body = (
        _h("Hay una entrega esperando tu revisi&oacute;n")
        + _p(
            f"Hola {leader_name}, <strong>{submitter_name}</strong> marc&oacute; una tarea "
            "como entregada y subi&oacute; su entregable:"
        )
        + _facts(
            [
                ("Tarea", task_title),
                ("Proyecto", project_name),
                ("Entreg&oacute;", submitter_name),
            ]
        )
        + _p(
            "Rev&iacute;sala y apru&eacute;bala o devu&eacute;lvela con observaciones "
            "para que el responsable la ajuste."
        )
        + _button("Revisar la entrega", review_url, color=TEAL)
    )
    text = (
        f"Hola {leader_name},\n\n"
        f'{submitter_name} entregó la tarea "{task_title}" del proyecto '
        f'"{project_name}" y está esperando tu revisión.\n'
    )
    if review_url:
        text += f"\nRevisar: {review_url}\n"
    return RenderedEmail(
        subject=subject,
        html=_shell(
            title=subject,
            preheader=f"{submitter_name} entregó {task_title}.",
            body_html=body,
        ),
        text=text,
    )


def reminder_email(
    *,
    name: str,
    title: str,
    note: str | None,
) -> RenderedEmail:
    """Recordatorio personal que la propia persona se programó."""
    subject = f"Recordatorio: {title}"
    facts: list[tuple[str, str]] = [("Recordatorio", title)]
    if note:
        facts.append(("Nota", note))
    body = (
        _h("Te dejaste un recordatorio")
        + _p(f"Hola {name}, programaste este aviso en Bit&aacute;cora OBJ:")
        + _facts(facts)
    )
    text = f"Hola {name},\n\nRecordatorio: {title}\n"
    if note:
        text += f"\n{note}\n"
    return RenderedEmail(
        subject=subject,
        html=_shell(title=subject, preheader=title, body_html=body),
        text=text,
    )
