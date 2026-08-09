import { useMemo, useState } from "react";
import { UserPlus, Search, Mail, Briefcase, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useProjectMembers, useRemoveMember, useUpdateMemberRole } from "../../hooks/use-members";
import { memberInitials } from "../../utils/group-members";
import { filterMembers } from "../../utils/filter-members";
import {
  PROJECT_ROLE_LABELS,
  PROJECT_ROLE_ACCENT,
  PROJECT_ROLE_ORDER,
  positionLabel,
} from "../../types/labels";
import type { ProjectMember, ProjectRole } from "../../types/api.types";
import { AddMemberModal } from "./AddMemberModal";

// Fila de integrante: información explícita en una sola línea (correo, cargo,
// rol) con acciones de edición rápida (cambiar rol, quitar) visibles al pasar
// el mouse, sin salir de la lista.
function MemberRow({
  member,
  projectId,
  canManage,
}: {
  member: ProjectMember;
  projectId: string;
  canManage: boolean;
}) {
  const updateRole = useUpdateMemberRole(projectId);
  const removeMember = useRemoveMember(projectId);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  return (
    <li className="group/row flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-brand-gold/40 sm:flex-nowrap">
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          PROJECT_ROLE_ACCENT[member.project_role],
        )}
      >
        {memberInitials(member)}
      </div>

      <div className="min-w-[160px] flex-1">
        <p className="truncate text-[14.5px] font-bold text-foreground">
          {member.name} {member.last_name}
        </p>
        {member.email && (
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Mail className="size-3 shrink-0" />
            <span className="truncate">{member.email}</span>
          </p>
        )}
      </div>

      <span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-muted-foreground">
        <Briefcase className="size-3.5 shrink-0" />
        <span className="truncate">{positionLabel(member.position)}</span>
      </span>

      {canManage ? (
        <select
          value={member.project_role}
          disabled={updateRole.isPending}
          onChange={(e) => {
            updateRole.mutate({ memberId: member.id, role: e.target.value as ProjectRole });
          }}
          className={cn(
            "shrink-0 rounded-md border-0 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide outline-none ring-1 ring-inset ring-transparent transition focus:ring-brand-gold disabled:opacity-60",
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
            "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
            PROJECT_ROLE_ACCENT[member.project_role],
          )}
        >
          {PROJECT_ROLE_LABELS[member.project_role]}
        </span>
      )}

      {canManage && (
        <div className="flex shrink-0 items-center gap-1">
          {confirmingRemove ? (
            <>
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
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setConfirmingRemove(true);
              }}
              aria-label="Quitar integrante"
              title="Quitar del proyecto"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-600 focus:opacity-100 group-hover/row:opacity-100 dark:hover:text-rose-400"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export function MembersPanel({ projectId }: { projectId: string }) {
  const membersQuery = useProjectMembers(projectId);
  const { hasRole } = useAuth();
  const canManage = hasRole(["admin", "super_admin"]);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const filtered = useMemo(() => filterMembers(members, search), [members, search]);

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
            <div key={i} className="h-16 animate-pulse rounded-xl bg-accent" />
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
      ) : (
        // Lista de integrantes con información explícita y edición rápida.
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <ul className="flex flex-col gap-2">
            {filtered.map((m) => (
              <MemberRow key={m.user_id} member={m} projectId={projectId} canManage={canManage} />
            ))}
          </ul>
          {filtered.length === 0 && (
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
          )}
        </div>
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
