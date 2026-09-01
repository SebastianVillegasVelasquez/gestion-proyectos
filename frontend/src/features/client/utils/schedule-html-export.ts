// Exporta el cronograma del cliente a un HTML autónomo (un solo archivo, sin
// dependencias externas) que se ve IGUAL que la vista en pantalla: mismas barras,
// mismos colores por tipo de elemento, misma banda de meses y misma línea de
// "hoy". Es una foto estática —sin zoom ni scroll interactivo— pensada para
// adjuntar en un correo o guardar como evidencia del avance.

import {
  barMetrics,
  monthBands,
  dayOffsetPct,
  shortDate,
  toDayNumber,
  type TimelineRange,
} from "@/features/projects/gantt/timeline";

/** Fila lista para exportar: ya resuelta a color y jerarquía, sin lógica de UI. */
export interface ScheduleExportRow {
  name: string;
  depth: number;
  start: string;
  due: string;
  progressPct: number;
  isParent: boolean;
  overdue: boolean;
  tipoNombre: string | null;
  /** Color sólido de la barra en HEX (de `tipoStyle().barHex`). */
  barHex: string;
}

export interface ScheduleExportInput {
  projectName: string;
  rows: ScheduleExportRow[];
  range: TimelineRange;
  /** px por día del zoom actual: el ancho exportado calca al de la pantalla. */
  pxPerDay: number;
  today: string;
  /** Leyenda de tipos presentes (rótulo + color), para la cabecera del HTML. */
  tipos: { nombre: string; barHex: string }[];
  generatedAt?: Date;
}

const LABEL_W = 260;
const ROW_H = 34;
const MIN_TRACK = 640;

/** Escapa texto para incrustarlo en HTML sin romper el marcado. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** `#rrggbb` → `rgba(r,g,b,alpha)`, para la "pista" tenue bajo el avance. */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) {
    return hex;
  }
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
}

/** Documento HTML completo (string) con el cronograma pintado. */
export function buildScheduleHtml(input: ScheduleExportInput): string {
  const { projectName, rows, range, pxPerDay, today, tipos } = input;
  const generatedAt = input.generatedAt ?? new Date();

  const trackWidth = Math.max(MIN_TRACK, Math.round(range.totalDays * pxPerDay));
  const pctToPx = (pct: number) => (pct / 100) * trackWidth;
  const totalWidth = LABEL_W + trackWidth;
  const bodyHeight = rows.length * ROW_H;

  const months = monthBands(range);
  const todayPct = dayOffsetPct(today, range);

  const monthCells = months
    .map(
      (b) =>
        `<div class="month" style="left:${String(pctToPx(b.startPct))}px;width:${String(
          pctToPx(b.widthPct),
        )}px">${pctToPx(b.widthPct) >= 44 ? esc(b.label ?? "") : ""}</div>`,
    )
    .join("");

  const monthLines = months
    .slice(1)
    .map((b) => `<div class="mline" style="left:${String(pctToPx(b.startPct))}px"></div>`)
    .join("");

  const rowsHtml = rows
    .map((row) => {
      const m = barMetrics({ start_date: row.start, due_date: row.due }, range);
      const left = pctToPx(m.offsetPct);
      const width = Math.max(10, pctToPx(m.widthPct));
      const days = toDayNumber(row.due) - toDayNumber(row.start) + 1;
      const dateLabel = `${shortDate(row.start)} – ${shortDate(row.due)} · ${String(days)} d`;
      const labelFitsRight = left + width + 150 <= trackWidth;
      const pct = Math.max(0, Math.min(100, Math.round(row.progressPct)));
      const indent = 8 + row.depth * 14;
      return `<div class="row">
  <div class="label" style="padding-left:${String(indent)}px">
    <span class="dot" style="background:${row.barHex}"></span>
    ${row.tipoNombre ? `<span class="chip" style="color:${row.barHex}">${esc(row.tipoNombre)}</span>` : ""}
    <span class="name${row.isParent ? " parent" : ""}">${esc(row.name)}</span>
    <span class="pct">${String(pct)}%</span>
  </div>
  <div class="track">
    <div class="bar${row.overdue ? " overdue" : ""}" style="left:${String(left)}px;width:${String(
      width,
    )}px;background:${withAlpha(row.barHex, 0.28)}">
      <span class="fill" style="width:${String(pct)}%;background:${row.barHex}"></span>
    </div>
    <span class="datelbl${row.overdue ? " overdue" : ""}" style="${
      labelFitsRight
        ? `left:${String(left + width + 8)}px`
        : `right:${String(trackWidth - left + 8)}px`
    }">${esc(dateLabel)}</span>
  </div>
</div>`;
    })
    .join("\n");

  const legend = tipos
    .map(
      (t) =>
        `<span class="lg"><span class="lg-dot" style="background:${t.barHex}"></span>${esc(
          t.nombre,
        )}</span>`,
    )
    .join("");

  const stamp = generatedAt.toLocaleString("es", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Cronograma · ${esc(projectName)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f8fafc; color: #0f172a;
    font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .wrap { padding: 24px; }
  header { margin-bottom: 16px; }
  h1 { margin: 0 0 4px; font-size: 18px; font-weight: 600; }
  .sub { color: #64748b; font-size: 12px; }
  .legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
  .lg { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: #475569; }
  .lg-dot { width: 9px; height: 9px; border-radius: 999px; display: inline-block; }
  .chart { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 12px;
    background: #fff; box-shadow: 0 1px 2px rgba(15,23,42,.05); }
  .inner { position: relative; width: ${String(totalWidth)}px; }
  .head { display: flex; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; background: #fff; }
  .head .corner { width: ${String(LABEL_W)}px; flex: 0 0 ${String(LABEL_W)}px;
    border-right: 1px solid #e2e8f0; display: flex; align-items: flex-end; padding: 0 12px 6px;
    font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; }
  .head .axis { position: relative; height: 26px; width: ${String(trackWidth)}px; flex: 0 0 ${String(
    trackWidth,
  )}px; }
  .month { position: absolute; top: 0; bottom: 0; display: flex; align-items: center;
    border-left: 1px solid #e2e8f0; padding-left: 6px; font-size: 10px; font-weight: 600; color: #64748b;
    overflow: hidden; white-space: nowrap; }
  .body { position: relative; }
  .mline { position: absolute; top: 0; bottom: 0; width: 1px; background: #e2e8f0; z-index: 0; }
  .today { position: absolute; top: 0; bottom: 0; width: 2px; background: rgba(244,63,94,.75); z-index: 3; }
  .today-lbl { position: absolute; top: 2px; transform: translateX(-50%); background: #f43f5e; color: #fff;
    font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 999px; z-index: 4; }
  .row { display: flex; height: ${String(ROW_H)}px; border-bottom: 1px solid #f1f5f9; position: relative; z-index: 1; }
  .label { width: ${String(LABEL_W)}px; flex: 0 0 ${String(LABEL_W)}px; display: flex; align-items: center;
    gap: 6px; border-right: 1px solid #e2e8f0; padding-right: 8px; background: #fff; }
  .dot { width: 8px; height: 8px; border-radius: 999px; flex: 0 0 auto; }
  .chip { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; flex: 0 0 auto; }
  .name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-size: 12px; color: #334155; }
  .name.parent { font-weight: 600; color: #1e293b; }
  .pct { flex: 0 0 auto; font-size: 10px; color: #64748b; background: #f1f5f9; border-radius: 999px;
    padding: 1px 6px; font-variant-numeric: tabular-nums; }
  .track { position: relative; flex: 1 1 auto; }
  .bar { position: absolute; top: 50%; height: 18px; transform: translateY(-50%); border-radius: 5px;
    overflow: hidden; box-shadow: 0 1px 2px rgba(15,23,42,.08); }
  .bar.overdue { outline: 1px solid #f43f5e; }
  .fill { position: absolute; inset: 0 auto 0 0; height: 100%; display: block; }
  .datelbl { position: absolute; top: 50%; transform: translateY(-50%); white-space: nowrap;
    font-size: 10px; color: #94a3b8; font-variant-numeric: tabular-nums; }
  .datelbl.overdue { color: #f43f5e; font-weight: 600; }
  footer { margin-top: 12px; font-size: 11px; color: #94a3b8; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Cronograma · ${esc(projectName)}</h1>
    <div class="sub">Vista de solo lectura · ${String(rows.length)} elemento${
      rows.length === 1 ? "" : "s"
    }</div>
    ${legend ? `<div class="legend">${legend}</div>` : ""}
  </header>
  <div class="chart">
    <div class="inner">
      <div class="head">
        <div class="corner">Cronograma</div>
        <div class="axis">
          ${monthCells}
        </div>
      </div>
      <div class="body" style="height:${String(bodyHeight)}px">
        ${monthLines}
        ${
          todayPct == null
            ? ""
            : `<div class="today" style="left:${String(
                LABEL_W + pctToPx(todayPct),
              )}px"></div><div class="today-lbl" style="left:${String(
                LABEL_W + pctToPx(todayPct),
              )}px">Hoy</div>`
        }
        ${rowsHtml}
      </div>
    </div>
  </div>
  <footer>Generado el ${esc(stamp)}</footer>
</div>
</body>
</html>`;
}

/** Dispara la descarga del HTML en el navegador (Blob + enlace efímero). */
export function downloadScheduleHtml(input: ScheduleExportInput): void {
  const html = buildScheduleHtml(input);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const safeName = input.projectName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const a = document.createElement("a");
  a.href = url;
  a.download = `cronograma-${safeName || "proyecto"}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Se libera en el siguiente tick: algunos navegadores cancelan la descarga si
  // el objeto URL se revoca en el mismo frame del click.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
