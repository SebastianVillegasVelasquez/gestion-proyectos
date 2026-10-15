import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentState, ComponentStats } from "../../api/analytics.api";
import {
  COMPONENT_SORT_LABELS,
  COMPONENT_STATE_META,
  COMPONENT_STATE_ORDER,
  DEFAULT_CRITERIA,
  countByState,
  distinctTipos,
  initialCollapsed,
  matchesCriteria,
  needsFlatList,
  sortComponents,
  visibleTree,
  type ComponentCriteria,
  type ComponentSort,
} from "../../utils/component-tree";

/** Por encima de esto el árbol arranca plegado: abrir cientos de filas de golpe
 *  no se lee. */
const FOLD_AFTER = 40;

function toggled<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(value)) {
    next.add(value);
  }
  return next;
}

function StatePill({ state }: { state: ComponentState }) {
  const meta = COMPONENT_STATE_META[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        meta.chip,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

/** Composición de las tareas del componente: hechas / iniciadas / por iniciar. */
function CompositionBar({ row }: { row: ComponentStats }) {
  const pending = Math.max(100 - row.completed_pct - row.started_pct, 0);
  return (
    <div
      className="flex h-2.5 w-full min-w-[120px] overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`${String(row.completed)} hechas, ${String(row.started)} iniciadas, ${String(row.not_started)} sin iniciar`}
      title={`${String(row.completed)} hechas · ${String(row.started)} iniciadas · ${String(row.not_started)} sin iniciar`}
    >
      <div className="bg-brand-teal" style={{ width: `${String(row.completed_pct)}%` }} />
      <div className="bg-brand-gold" style={{ width: `${String(row.started_pct)}%` }} />
      <div style={{ width: `${String(pending)}%` }} />
    </div>
  );
}

function Cell({ n, pct, tone }: { n: number; pct: number; tone?: string }) {
  return (
    <span className="tabular-nums">
      <span className={cn("font-semibold text-foreground", tone)}>{n}</span>
      <span className="ml-1 text-xs text-muted-foreground">{pct}%</span>
    </span>
  );
}

function ComponentRow({
  row,
  flat,
  collapsed,
  onToggle,
}: {
  row: ComponentStats;
  flat: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const canFold = !flat && row.child_count > 0;
  return (
    <tr className="border-b border-border last:border-0 hover:bg-accent/30">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1" style={{ paddingLeft: flat ? 0 : row.depth * 18 }}>
          {canFold ? (
            <button
              type="button"
              onClick={onToggle}
              aria-label={collapsed ? `Desplegar ${row.name}` : `Plegar ${row.name}`}
              aria-expanded={!collapsed}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent"
            >
              {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          ) : (
            !flat && <span className="inline-block size-5" />
          )}
          <div className="min-w-0">
            <p
              className="truncate text-sm font-medium text-foreground"
              title={row.path.join(" › ")}
            >
              {row.name}
              {row.tipo_nombre && (
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {row.tipo_nombre}
                </span>
              )}
            </p>
            {flat && row.path.length > 1 && (
              <p className="truncate text-[11px] text-muted-foreground">
                {row.path.slice(0, -1).join(" › ")}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <StatePill state={row.state} />
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{row.total}</td>
      <td className="px-3 py-2.5 text-right">
        <Cell
          n={row.completed}
          pct={row.completed_pct}
          tone="text-brand-teal-dark dark:text-brand-teal"
        />
      </td>
      <td className="px-3 py-2.5 text-right">
        <Cell n={row.started} pct={row.started_pct} />
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
        {row.not_started}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        <span
          className={cn(
            row.overdue > 0
              ? "font-semibold text-brand-red-dark dark:text-brand-red"
              : "text-muted-foreground",
          )}
        >
          {row.overdue}
        </span>
        <span className="text-muted-foreground"> / </span>
        <span
          className={cn(
            row.at_risk > 0
              ? "font-semibold text-orange-600 dark:text-orange-400"
              : "text-muted-foreground",
          )}
        >
          {row.at_risk}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {row.progress_pct}%
            </span>
            {row.started > 0 && (
              <span
                className="text-[11px] text-muted-foreground"
                title="Cuánto llevan, de media, las tareas ya iniciadas"
              >
                iniciadas al {row.started_progress_pct}%
              </span>
            )}
          </div>
          <CompositionBar row={row} />
        </div>
      </td>
    </tr>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-brand-gold bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold/15 dark:text-brand-gold"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * «Componentes»: cómo va cada pieza de la estructura —un curso, un módulo, una
 * unidad— sumando todo lo que cuelga de ella: cuántas tareas están hechas,
 * cuántas ya empezaron y cuánto llevan, y cuántas siguen sin iniciar.
 *
 * Con cientos de elementos manda el filtrado: búsqueda por nombre o ruta,
 * estado, tipo, nivel y orden. Mientras se filtra o se ordena la lista es plana
 * (cada coincidencia con su ruta); sin filtros se ve el árbol plegable.
 */
export function ComponentsTab({ rows }: { rows: ComponentStats[] }) {
  const [criteria, setCriteria] = useState<ComponentCriteria>(DEFAULT_CRITERIA);
  const [sort, setSort] = useState<ComponentSort>("estructura");
  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    rows.filter((r) => r.total > 0).length > FOLD_AFTER ? initialCollapsed(rows, 1) : new Set(),
  );

  const patch = (p: Partial<ComponentCriteria>) => {
    setCriteria((c) => ({ ...c, ...p }));
  };

  const withTasks = useMemo(() => rows.filter((r) => r.total > 0), [rows]);
  const counts = useMemo(() => countByState(withTasks), [withTasks]);
  const tipos = useMemo(() => distinctTipos(rows), [rows]);
  const maxDepth = useMemo(() => Math.max(0, ...rows.map((r) => r.depth)), [rows]);

  const flat = needsFlatList(criteria, sort);
  const shown = useMemo(() => {
    const matching = rows.filter((r) => matchesCriteria(r, criteria));
    return flat ? sortComponents(matching, sort) : visibleTree(matching, collapsed);
  }, [rows, criteria, sort, flat, collapsed]);

  const hasFilters =
    criteria.query !== "" ||
    criteria.states.size > 0 ||
    criteria.tipos.size > 0 ||
    criteria.maxDepth !== null ||
    !criteria.hideEmpty ||
    sort !== "estructura";

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este proyecto aún no tiene estructura, o el filtro no deja ninguna rama.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Resumen: cuántos componentes hay en cada estado (también es un filtro). */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {COMPONENT_STATE_ORDER.filter((s) => s !== "sin_tareas").map((state) => {
          const meta = COMPONENT_STATE_META[state];
          const active = criteria.states.has(state);
          return (
            <button
              key={state}
              type="button"
              onClick={() => {
                patch({ states: toggled(criteria.states, state) });
              }}
              aria-pressed={active}
              className={cn(
                "rounded-2xl border bg-card px-4 py-3 text-left shadow-sm transition-colors",
                active
                  ? "border-brand-gold ring-1 ring-brand-gold"
                  : "border-border hover:border-brand-gold/60",
              )}
            >
              <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <span className={cn("size-2 rounded-full", meta.dot)} />
                {meta.label}
              </span>
              <span className="mt-1 block text-3xl font-bold tabular-nums tracking-tight text-foreground">
                {counts[state]}
              </span>
              <span className="text-xs text-muted-foreground">componentes</span>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={criteria.query}
              onChange={(e) => {
                patch({ query: e.target.value });
              }}
              placeholder="Buscar un componente por nombre o ruta…"
              aria-label="Buscar componente"
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-8 text-sm outline-none focus:border-brand-gold"
            />
            {criteria.query && (
              <button
                type="button"
                aria-label="Borrar búsqueda"
                onClick={() => {
                  patch({ query: "" });
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </label>

          <select
            aria-label="Nivel"
            value={criteria.maxDepth ?? ""}
            onChange={(e) => {
              patch({ maxDepth: e.target.value === "" ? null : Number(e.target.value) });
            }}
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-brand-gold"
          >
            <option value="">Todos los niveles</option>
            {Array.from({ length: maxDepth + 1 }, (_, d) => (
              <option key={d} value={d}>
                {d === 0 ? "Solo el nivel superior" : `Hasta el nivel ${String(d + 1)}`}
              </option>
            ))}
          </select>

          <select
            aria-label="Orden"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as ComponentSort);
            }}
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-brand-gold"
          >
            {Object.entries(COMPONENT_SORT_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tipos.length > 1 && (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tipo
              </span>
              {tipos.map((t) => (
                <Chip
                  key={t}
                  active={criteria.tipos.has(t)}
                  onClick={() => {
                    patch({ tipos: toggled(criteria.tipos, t) });
                  }}
                >
                  {t}
                </Chip>
              ))}
            </>
          )}
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={criteria.hideEmpty}
              onChange={(e) => {
                patch({ hideEmpty: e.target.checked });
              }}
            />
            Ocultar componentes sin tareas
          </label>
          {!flat && (
            <span className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  setCollapsed(new Set());
                }}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronsUpDown className="size-3.5" /> Desplegar todo
              </button>
              <button
                type="button"
                onClick={() => {
                  setCollapsed(initialCollapsed(rows, 0));
                }}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronsDownUp className="size-3.5" /> Plegar todo
              </button>
            </span>
          )}
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setCriteria(DEFAULT_CRITERIA);
                setSort("estructura");
              }}
              className="text-xs font-medium text-brand-teal-dark hover:underline dark:text-brand-teal"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {shown.length} componente{shown.length === 1 ? "" : "s"}
        {flat ? " · lista plana con su ruta" : ""}
      </p>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-3">Componente</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3 text-right">Tareas</th>
              <th className="px-3 py-3 text-right">Hechas</th>
              <th className="px-3 py-3 text-right">Iniciadas</th>
              <th className="px-3 py-3 text-right">Sin iniciar</th>
              <th className="px-3 py-3 text-right" title="Vencidas / en riesgo">
                Venc. / riesgo
              </th>
              <th className="min-w-[200px] px-4 py-3">Avance</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <ComponentRow
                key={row.id}
                row={row}
                flat={flat}
                collapsed={collapsed.has(row.id)}
                onToggle={() => {
                  setCollapsed((c) => toggled(c, row.id));
                }}
              />
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Ningún componente coincide con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-brand-teal" /> Hechas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-brand-gold" /> Iniciadas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-muted" /> Sin iniciar
        </span>
        <span>
          · «Avance» promedia TODAS las tareas, así que cuenta también lo que ya está empezado.
        </span>
      </p>
    </div>
  );
}
