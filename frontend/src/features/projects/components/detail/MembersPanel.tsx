import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSortableData } from "@/hooks/use-sortable-data";
import { SortableTh } from "@/components/ui/SortableTh";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  useProjectMemberProgress,
  useRemoveMember,
  useUpdateMemberRole,
} from "../../hooks/use-members";
import { memberInitials } from "../../utils/group-members";
import { filterMembers } from "../../utils/filter-members";
import {
  PROJECT_ROLE_LABELS,
  PROJECT_ROLE_ACCENT,
  PROJECT_ROLE_ORDER,
  positionLabel,
} from "../../types/labels";
import type { ProjectMemberProgress, ProjectRole } from "../../types/api.types";
import { AddMemberModal } from "./AddMemberModal";

const PAGE_SIZE = 15;

// Columnas ordenables: nombre, cargo, rol y avance. Acciones queda fuera.
type SortKey = "name" | "position" | "project_role" | "progress_pct";

const headerCell =
  "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

/** Barra de avance compacta: color según qué tan cerca está de pagarse. */
function ProgressBar({ pct }: { pct: number }) {
  const tone =
    pct >= 100
      ? "bg-emerald-500"
      : pct >= 50
        ? "bg-brand-blue"
        : pct > 0
          ? "bg-brand-gold"
          : "bg-muted-foreground/30";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-accent">
        <div
          className={cn("h-full rounded-full transition-all", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">
        {pct}%
      </span>
    </div>
  );
}

function MemberRow({
  member,
  projectId,
  canManage,
}: {
  member: ProjectMemberProgress;
  projectId: string;
  canManage: boolean;
}) {
  const updateRole = useUpdateMemberRole(projectId);
  const removeMember = useRemoveMember(projectId);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const paid = member.progress_pct >= 100 && member.tasks_total > 0;

  return (
    <tr className="border-b border-accent/60 transition-colors last:border-0 hover:bg-accent/30">
      {/* Integrante: avatar + nombre + correo */}
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              PROJECT_ROLE_ACCENT[member.project_role],
            )}
          >
            {memberInitials(member)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {member.name} {member.last_name}
            </p>
            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
          </div>
        </div>
      </td>

      {/* Cargo */}
      <td className="px-4 py-3 text-sm text-muted-foreground">{positionLabel(member.position)}</td>

      {/* Rol dentro del proyecto */}
      <td className="px-4 py-3">
        {canManage ? (
          <select
            value={member.project_role}
            disabled={updateRole.isPending}
            onChange={(e) => {
              updateRole.mutate({ memberId: member.id, role: e.target.value as ProjectRole });
            }}
            className={cn(
              "rounded-md border-0 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide outline-none ring-1 ring-inset ring-transparent transition focus:ring-brand-gold disabled:opacity-60",
              PROJECT_ROLE_ACCENT[member.project_role],
            )}
          >
            {PROJECT_ROLE_ORDER.map((role) => (
              <option key={role} value={role}>
                {PROJECT_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        ) : (
          <span
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
              PROJECT_ROLE_ACCENT[member.project_role],
            )}
          >
            {PROJECT_ROLE_LABELS[member.project_role]}
          </span>
        )}
      </td>

      {/* Avance ponderado: determina cuándo corresponde pagarle */}
      <td className="px-4 py-3">
        {member.tasks_total === 0 ? (
          <span className="text-xs italic text-muted-foreground">Sin tareas</span>
        ) : (
          <div className="flex flex-col gap-1">
            <ProgressBar pct={member.progress_pct} />
            <span className="text-[11px] text-muted-foreground">
              {member.tasks_completed} de {member.tasks_total} tareas
              {paid && (
                <span className="ml-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  · Listo para pago
                </span>
              )}
            </span>
          </div>
        )}
      </td>

      {/* Acciones */}
      <td className="px-4 py-3 text-right">
        {canManage &&
          (confirmingRemove ? (
            <div className="flex justify-end gap-1">
              <button
                type="button"
                onClick={() => {
                  removeMember.mutate(member.id, {
                    onSettled: () => {
                      setConfirmingRemove(false);
                    },
                  });
                }}
                disabled={removeMember.isPending}
                className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {removeMember.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Quitar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingRemove(false);
                }}
                disabled={removeMember.isPending}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setConfirmingRemove(true);
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
            >
              Quitar
            </button>
          ))}
      </td>
    </tr>
  );
}

export function MembersPanel({ projectId }: { projectId: string }) {
  const membersQuery = useProjectMemberProgress(projectId);
  const { hasRole } = useAuth();
  const canManage = hasRole(["admin", "super_admin"]);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const filtered = useMemo(() => filterMembers(members, search), [members, search]);

  const { sorted, sort, toggleSort } = useSortableData<ProjectMemberProgress, SortKey>(
    filtered,
    (member, key) => {
      switch (key) {
        case "name":
          return `${member.name} ${member.last_name}`;
        case "position":
          return positionLabel(member.position);
        case "project_role":
          return PROJECT_ROLE_LABELS[member.project_role];
        case "progress_pct":
          return member.progress_pct;
      }
    },
  );

  // Al cambiar la búsqueda volvemos a la página 1 (comparado en render, sin efecto).
  const [searchAtReset, setSearchAtReset] = useState(search);
  if (search !== searchAtReset) {
    setSearchAtReset(search);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Toolbar: buscador + acción principal */}
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            placeholder="Buscar integrante…"
            aria-label="Buscar integrante"
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
          />
        </div>
        <span className="hidden flex-1 sm:block" />
        <span className="text-xs font-semibold text-muted-foreground">
          {members.length} {members.length === 1 ? "integrante" : "integrantes"}
        </span>
        <button
          type="button"
          onClick={() => {
            setShowAdd(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-brand-gold-dark"
        >
          <UserPlus className="size-4" /> Agregar integrante
        </button>
      </div>

      {membersQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-accent" />
          ))}
        </div>
      ) : membersQuery.isError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
        >
          No se pudo cargar el equipo.
        </div>
      ) : filtered.length === 0 && members.length > 0 ? (
        <p className="text-sm italic text-muted-foreground">
          Ningún integrante coincide con «{search}».
        </p>
      ) : members.length === 0 ? (
        <button
          type="button"
          onClick={() => {
            setShowAdd(true);
          }}
          className="flex min-h-[80px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-border text-muted-foreground transition-colors hover:border-brand-gold/60 hover:text-foreground"
        >
          <UserPlus className="size-5" />
          <span className="text-sm font-bold">Agregar integrante</span>
        </button>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-card">
                <tr>
                  <SortableTh
                    label="Integrante"
                    columnKey="name"
                    activeKey={sort.key}
                    direction={sort.direction}
                    onSort={toggleSort}
                    className={headerCell}
                  />
                  <SortableTh
                    label="Cargo"
                    columnKey="position"
                    activeKey={sort.key}
                    direction={sort.direction}
                    onSort={toggleSort}
                    className={headerCell}
                  />
                  <SortableTh
                    label="Rol"
                    columnKey="project_role"
                    activeKey={sort.key}
                    direction={sort.direction}
                    onSort={toggleSort}
                    className={headerCell}
                  />
                  <SortableTh
                    label="Avance"
                    columnKey="progress_pct"
                    activeKey={sort.key}
                    direction={sort.direction}
                    onSort={toggleSort}
                    className={headerCell}
                  />
                  <th className={cn(headerCell, "w-24 text-right")}>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((m) => (
                  <MemberRow
                    key={m.user_id}
                    member={m}
                    projectId={projectId}
                    canManage={canManage}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="flex shrink-0 items-center justify-between text-xs text-muted-foreground">
            <span>
              {sorted.length} {sorted.length === 1 ? "resultado" : "resultados"}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  aria-label="Página anterior"
                  onClick={() => {
                    setPage((p) => p - 1);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border transition hover:bg-accent disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span>
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  aria-label="Página siguiente"
                  onClick={() => {
                    setPage((p) => p + 1);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border transition hover:bg-accent disabled:opacity-40"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {showAdd && (
        <AddMemberModal
          projectId={projectId}
          onClose={() => {
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}
