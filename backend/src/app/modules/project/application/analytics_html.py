"""Informe del proyecto como un HTML autocontenido y descargable.

Sustituye la vieja exportación a CSV/PDF: un solo archivo `.html`, sin recursos
externos, que se puede abrir sin conexión, imprimir o adjuntar. Trae los mismos
datos que la pantalla del informe (los filtros ya aplicados al generarlo), con
pestañas ("vistas") y un filtro rápido sobre la tabla de tareas.
"""

import html
import json
from datetime import datetime, timezone

from app.modules.project.application.analytics import (
    Burnup,
    DeliveryLapse,
    Overview,
    PersonPerformance,
    ProjectAnalytics,
    TeamPerformance,
    WeekCount,
)
from app.modules.tasks.infrastructure.enums import TaskStatus

_STATUS_LABEL = {
    TaskStatus.PENDIENTE_POR_INICIAR.value: "Pendiente por iniciar",
    TaskStatus.EN_PROGRESO.value: "En progreso",
    TaskStatus.EN_REVISION.value: "En revisión",
    TaskStatus.DEVUELTA.value: "Devuelta",
    TaskStatus.COMPLETADA.value: "Completada",
    TaskStatus.CANCELADA.value: "Cancelada",
}


def _e(value) -> str:
    return html.escape(str(value), quote=True)


def _d(n: float) -> str:
    return f"{n:g} d"


def _path(parts: list[str]) -> str:
    return " › ".join(parts) if parts else "Sin ubicar"


# ── Gráficos (SVG estático, sin JS) ──────────────────────────────────────────


def _burnup_svg(b: Burnup) -> str:
    if not b.points:
        return "<p class='muted'>Sin datos en el rango.</p>"
    w, h, pad = 640, 220, 28
    n = len(b.points)
    max_y = max(b.total_scope, *(max(p.ideal, p.actual) for p in b.points), 1)

    def xy(i: int, v: float) -> tuple[float, float]:
        x = pad + (0 if n == 1 else i / (n - 1) * (w - 2 * pad))
        y = h - pad - v / max_y * (h - 2 * pad)
        return x, y

    def poly(key: str) -> str:
        return " ".join(
            f"{x:.1f},{y:.1f}"
            for i, p in enumerate(b.points)
            for x, y in [xy(i, getattr(p, key))]
        )

    grid = "".join(
        f"<line x1='{pad}' x2='{w - pad}' y1='{h - pad - r * (h - 2 * pad):.1f}' "
        f"y2='{h - pad - r * (h - 2 * pad):.1f}' class='grid'/>"
        for r in (0, 0.25, 0.5, 0.75, 1)
    )
    return (
        f"<svg viewBox='0 0 {w} {h}' class='chart' role='img' "
        f"aria-label='Burn-up: real frente a plan'>{grid}"
        f"<polyline points='{poly('ideal')}' class='line-ideal'/>"
        f"<polyline points='{poly('actual')}' class='line-actual'/>"
        f"<text x='{pad}' y='{h - 8}' class='tick'>{_e(b.points[0].date)}</text>"
        f"<text x='{w - pad}' y='{h - 8}' text-anchor='end' class='tick'>"
        f"{_e(b.points[-1].date)}</text>"
        f"<text x='4' y='{pad}' class='tick'>{max_y}</text>"
        f"<text x='4' y='{h - pad}' class='tick'>0</text></svg>"
    )


def _throughput_svg(weeks: list[WeekCount]) -> str:
    if not weeks:
        return "<p class='muted'>Sin datos.</p>"
    w, h, pad = 640, 180, 24
    n = len(weeks)
    max_c = max((wk.count for wk in weeks), default=1) or 1
    slot = (w - 2 * pad) / n
    bar_w = slot * 0.6
    bars = "".join(
        f"<rect x='{pad + i * slot + (slot - bar_w) / 2:.1f}' "
        f"y='{h - pad - wk.count / max_c * (h - 2 * pad):.1f}' "
        f"width='{bar_w:.1f}' "
        f"height='{wk.count / max_c * (h - 2 * pad):.1f}' class='bar'>"
        f"<title>Semana del {_e(wk.week_start)}: {wk.count}</title></rect>"
        for i, wk in enumerate(weeks)
    )
    return (
        f"<svg viewBox='0 0 {w} {h}' class='chart' role='img' "
        f"aria-label='Tareas completadas por semana'>"
        f"<line x1='{pad}' x2='{w - pad}' y1='{h - pad}' y2='{h - pad}' class='grid'/>"
        f"{bars}<text x='4' y='{pad}' class='tick'>{max_c}</text></svg>"
    )


# ── Tablas ───────────────────────────────────────────────────────────────────


def _tiles(o: Overview) -> str:
    done = sum(w.count for w in o.throughput_last_weeks)
    cells = [
        ("Avance", f"{o.progress_pct}%", f"{o.total_tasks} tareas"),
        ("Vencidas abiertas", str(o.overdue_open), ""),
        ("En riesgo (≤1 sem.)", str(o.at_risk_open), ""),
        ("Desviación media", _d(o.avg_schedule_slip_bdays), "+ = cierra tarde"),
        ("Cycle time (mediana)", _d(o.cycle_time_p50_bdays), "inicio → cierre"),
        ("Cycle time (p90)", _d(o.cycle_time_p90_bdays), ""),
        ("Retrabajo", f"{o.rework_rate_pct}%", "devueltas alguna vez"),
        ("Completadas (8 sem.)", str(done), ""),
    ]
    return (
        "<div class='tiles'>"
        + "".join(
            f"<div class='tile'><span class='tl'>{_e(label)}</span>"
            f"<span class='tv'>{_e(value)}</span>"
            f"<span class='th'>{_e(hint)}</span></div>"
            for label, value, hint in cells
        )
        + "</div>"
    )


def _by_status(o: Overview) -> str:
    if not o.by_status:
        return "<p class='muted'>Sin tareas.</p>"
    return (
        "<ul class='kv'>"
        + "".join(
            f"<li><span>{_e(_STATUS_LABEL.get(s, s))}</span><b>{c}</b></li>"
            for s, c in o.by_status.items()
        )
        + "</ul>"
    )


def _teams_table(rows: list[TeamPerformance]) -> str:
    if not rows:
        return "<p class='muted'>Ningún equipo con tareas.</p>"
    body = "".join(
        f"<tr><td>{_e(t.team_name)}</td><td class='n'>{t.assigned}</td>"
        f"<td class='n'>{t.completed}</td><td class='n'>{t.open}</td>"
        f"<td class='n'>{t.overdue}</td><td class='n'>{_d(t.cycle_time_bdays)}</td>"
        f"<td class='n'>{_d(t.review_time_bdays)}</td>"
        f"<td class='n'>{t.rework_rate_pct}%</td>"
        f"<td>{_e(', '.join(f'{m.name} ({m.open_count})' for m in t.open_per_member) or '—')}</td></tr>"
        for t in rows
    )
    return (
        "<table><thead><tr><th>Equipo</th><th>Asignadas</th><th>Completadas</th>"
        "<th>Abiertas</th><th>Vencidas</th><th>Cycle</th><th>Revisión</th>"
        "<th>Retrabajo</th><th>Carga por integrante</th></tr></thead>"
        f"<tbody>{body}</tbody></table>"
    )


def _people_table(rows: list[PersonPerformance]) -> str:
    if not rows:
        return "<p class='muted'>Nadie con tareas.</p>"
    body = "".join(
        f"<tr><td>{_e(p.name)}</td><td class='n'>{p.completed}</td>"
        f"<td class='n'>{p.open_count}</td><td class='n'>{_d(p.cycle_time_bdays)}</td>"
        f"<td class='n'>{p.on_time_pct}%</td><td class='n'>{p.returns_received}</td>"
        f"<td class='n'>{p.logged_hours:g} h</td></tr>"
        for p in rows
    )
    return (
        "<table><thead><tr><th>Persona</th><th>Completadas</th><th>Abiertas</th>"
        "<th>Cycle</th><th>A tiempo</th><th>Devoluciones</th><th>Horas</th>"
        f"</tr></thead><tbody>{body}</tbody></table>"
    )


def _lapses(rows: list[DeliveryLapse]) -> str:
    if not rows:
        return "<p class='muted'>Sin entregas registradas.</p>"
    max_t = max((r.total_bdays for r in rows), default=1) or 1
    items = ""
    for r in rows:
        prod_pct = r.production_bdays / max_t * 100
        rev_pct = r.review_bdays / max_t * 100
        items += (
            f"<div class='lap'><div class='lap-h'><span>{_e(r.task_title)}</span>"
            f"<span class='muted'>{_e(_path(r.element_path))} · {r.versions} v.</span></div>"
            f"<div class='lap-bar'><i style='width:{prod_pct:.1f}%' class='seg1'></i>"
            f"<i style='width:{rev_pct:.1f}%' class='seg2'></i>"
            f"<span class='muted'>{r.production_bdays} + {r.review_bdays} = "
            f"{r.total_bdays} d</span></div></div>"
        )
    legend = (
        "<p class='legend'><i class='seg1'></i> Producción "
        "<i class='seg2'></i> Revisión · días laborables</p>"
    )
    return legend + items


def _tasks_table(rows) -> str:
    body = "".join(
        f"<tr><td>{_e(_path(t.element_path))}</td><td>{_e(t.title)}</td>"
        f"<td>{_e(t.responsable or '—')}</td><td>{_e(t.equipo or '—')}</td>"
        f"<td>{_e(_STATUS_LABEL.get(t.estado, t.estado))}</td>"
        f"<td class='n'>{_e(t.due_date or '—')}</td>"
        f"<td class='n'>{_e(t.completed_date or '—')}</td>"
        f"<td class='n'>{'—' if t.slip_bdays is None else f'{t.slip_bdays:+d} d'}</td>"
        f"<td class='n'>{t.returns}</td></tr>"
        for t in rows
    )
    return (
        "<table id='tasks'><thead><tr><th>Ubicación</th><th>Tarea</th>"
        "<th>Responsable</th><th>Equipo</th><th>Estado</th><th>Fin plan.</th>"
        "<th>Fin real</th><th>Retraso</th><th>Dev.</th></tr></thead>"
        f"<tbody>{body}</tbody></table>"
    )


_CSS = """
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
 margin:0;padding:24px;max-width:1100px;margin-inline:auto;
 background:#fcfcfb;color:#0b0b0b}
h1{font-size:20px;margin:0 0 2px}
h2{font-size:15px;margin:24px 0 8px}
.muted{color:#6b6862}
.sub{color:#6b6862;font-size:12px;margin:0 0 16px}
nav{display:flex;gap:4px;border-bottom:1px solid #e7e5e4;margin:16px 0}
nav button{border:0;background:0;padding:8px 12px;font:inherit;cursor:pointer;
 color:#6b6862;border-bottom:2px solid transparent}
nav button[aria-selected=true]{color:#c49840;border-color:#e4b54f}
section[hidden]{display:none}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.tile{border:1px solid #e7e5e4;border-radius:10px;padding:10px;display:flex;flex-direction:column}
.tl{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b6862}
.tv{font-size:22px;font-weight:600;font-variant-numeric:tabular-nums}
.th{font-size:11px;color:#6b6862}
.charts{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
@media(max-width:720px){.charts{grid-template-columns:1fr}}
.card{border:1px solid #e7e5e4;border-radius:10px;padding:12px}
.chart{width:100%;height:auto}
.grid{stroke:#e7e5e4;stroke-width:1}
.tick{fill:#6b6862;font-size:10px}
.line-ideal{fill:none;stroke:#52514e;stroke-width:2;stroke-dasharray:5 4}
.line-actual{fill:none;stroke:#2a78d6;stroke-width:2;stroke-linejoin:round}
.bar{fill:#2a78d6}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:7px 10px;border-bottom:1px solid #e7e5e4}
th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6b6862}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
.kv{list-style:0;padding:0;margin:0;columns:2;font-size:13px}
.kv li{display:flex;justify-content:space-between;padding:2px 0}
.lap{padding:8px 0;border-bottom:1px solid #e7e5e4}
.lap-h{display:flex;justify-content:space-between;gap:12px}
.lap-bar{display:flex;align-items:center;gap:8px;margin-top:4px}
.lap-bar i{height:12px;border-radius:3px;display:inline-block}
.legend{font-size:11px;color:#6b6862;display:flex;align-items:center;gap:6px}
.legend i{width:12px;height:12px;border-radius:3px;display:inline-block}
i.seg1{background:#2a78d6}i.seg2{background:#eb6834}
#q{margin:8px 0;padding:6px 10px;border:1px solid #e7e5e4;border-radius:8px;width:260px;font:inherit}
@media print{nav{display:none}section[hidden]{display:block!important}}
@media(prefers-color-scheme:dark){
 body{background:#1a1a19;color:#fff}
 .muted,.sub,.tl,.th,.tick{color:#c3c2b7}
 .tile,.card,nav,th,td,.lap,#q{border-color:#33322e}
 .grid{stroke:#33322e}.line-ideal{stroke:#c3c2b7}
 .line-actual,.bar,i.seg1{fill:#3987e5;background:#3987e5}
 i.seg2{background:#d95926}
}
"""

_JS = """
(function(){
 var tabs=document.querySelectorAll('nav button');
 var secs=document.querySelectorAll('section[data-view]');
 tabs.forEach(function(b){b.addEventListener('click',function(){
  tabs.forEach(function(x){x.setAttribute('aria-selected',x===b)});
  secs.forEach(function(s){s.hidden=s.dataset.view!==b.dataset.view});
 })});
 var q=document.getElementById('q');
 if(q){q.addEventListener('input',function(){
  var v=q.value.toLowerCase();
  document.querySelectorAll('#tasks tbody tr').forEach(function(tr){
   tr.style.display=tr.textContent.toLowerCase().indexOf(v)>-1?'':'none';
  });
 })}
})();
"""


def render_analytics_html(a: ProjectAnalytics) -> str:
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    applied = {k: v for k, v in a.filters.items() if v}
    filters_note = (
        "Filtros aplicados: "
        + ", ".join(f"{_e(k)}={_e(v)}" for k, v in applied.items())
        if applied
        else "Sin filtros — todo el proyecto."
    )
    tabs = [
        ("general", "General"),
        ("equipos", "Equipos"),
        ("individual", "Individual"),
        ("lapsos", "Lapsos de entrega"),
        ("tareas", "Tareas"),
    ]
    nav = "".join(
        f"<button data-view='{v}' aria-selected='{'true' if i == 0 else 'false'}'>"
        f"{_e(label)}</button>"
        for i, (v, label) in enumerate(tabs)
    )
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Informe · {_e(a.project_name)}</title><style>{_CSS}</style></head><body>
<h1>Informe · {_e(a.project_name)}</h1>
<p class="sub">Generado {generated}. {filters_note}</p>
<nav>{nav}</nav>

<section data-view="general">
{_tiles(a.overview)}
<div class="charts">
 <div class="card"><h2>Avance en el tiempo</h2>{_burnup_svg(a.burnup)}
  <p class="legend"><span style="width:16px;height:2px;background:#2a78d6;display:inline-block"></span> Real
  <span style="width:16px;border-top:2px dashed #52514e;display:inline-block"></span> Plan (ideal)</p></div>
 <div class="card"><h2>Tareas completadas por semana</h2>{_throughput_svg(a.overview.throughput_last_weeks)}</div>
</div>
<h2>Tareas por estado</h2>{_by_status(a.overview)}
</section>

<section data-view="equipos" hidden><h2>Rendimiento por equipo</h2>{_teams_table(a.by_team)}</section>
<section data-view="individual" hidden><h2>Rendimiento individual</h2>{_people_table(a.by_person)}</section>
<section data-view="lapsos" hidden><h2>Lapsos de entrega</h2>{_lapses(a.delivery_lapses)}</section>
<section data-view="tareas" hidden><h2>Tareas ({len(a.tasks)})</h2>
<input id="q" type="search" placeholder="Filtrar tareas…" aria-label="Filtrar tareas">
{_tasks_table(a.tasks)}</section>

<script>{_JS}</script>
<script id="data" type="application/json">{json.dumps({"project": a.project_name, "filters": a.filters})}</script>
</body></html>"""
