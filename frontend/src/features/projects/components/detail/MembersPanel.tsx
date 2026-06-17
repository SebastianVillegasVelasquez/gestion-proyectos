import { useMemo, useState } from "react";
import { UserPlus, Users, Search, Mail, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectMembers } from "../../hooks/use-members";
import { memberInitials, groupMembersByRole } from "../../utils/group-members";
import { filterMembers } from "../../utils/filter-members";
import { PROJECT_ROLE_LABELS, PROJECT_ROLE_ACCENT, positionLabel } from "../../types/labels";
import type { ProjectMember } from "../../types/api.types";
import { AddMemberModal } from "./AddMemberModal";

function MemberRow({ member }: { member: ProjectMember }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 transition-colors hover:border-blue-200 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          PROJECT_ROLE_ACCENT[member.project_role],
        )}
      >
        {memberInitials(member)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
          {member.name} {member.last_name}
        </p>
        <p className="flex items-center gap-1 truncate text-xs text-slate-400 dark:text-slate-500">
          <Briefcase className="size-3 shrink-0" />
          {positionLabel(member.position)}
        </p>
        {member.email && (
          <p className="flex items-center gap-1 truncate text-xs text-slate-400 dark:text-slate-500">
            <Mail className="size-3 shrink-0" />
            <span className="truncate">{member.email}</span>
          </p>
        )}
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
          PROJECT_ROLE_ACCENT[member.project_role],
        )}
      >
        {PROJECT_ROLE_LABELS[member.project_role]}
      </span>
    </div>
  );
}

export function MembersPanel({ projectId }: { projectId: string }) {
  const membersQuery = useProjectMembers(projectId);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const filtered = useMemo(() => filterMembers(members, search), [members, search]);
  const groups = useMemo(() => groupMembersByRole(filtered), [filtered]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Users className="size-4 text-emerald-500" /> Integrantes
          <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500 dark:bg-slate-800">
            {members.length}
          </span>
        </h2>
        <button
          type="button"
          onClick={() => {
            setShowAdd(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
        >
          <UserPlus className="size-3.5" /> Agregar integrante
        </button>
      </div>

      {/* Búsqueda por integrante, correo o cargo */}
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          placeholder="Buscar por nombre, correo o cargo…"
          aria-label="Buscar integrante"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/20"
        />
      </div>

      {membersQuery.isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      ) : membersQuery.isError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
        >
          No se pudo cargar el equipo.
        </div>
      ) : members.length === 0 ? (
        <p className="text-sm italic text-slate-400">Aún no hay integrantes.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm italic text-slate-400">Ningún integrante coincide con «{search}».</p>
      ) : (
        // Contenedor con scroll: muestra n integrantes sin desbordar la pantalla.
        <div className="flex max-h-[28rem] min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
          {groups.map((group) => (
            <section key={group.role} className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {PROJECT_ROLE_LABELS[group.role]}
                <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500 dark:bg-slate-800">
                  {group.members.length}
                </span>
              </p>
              {group.members.map((m) => (
                <MemberRow key={m.user_id} member={m} />
              ))}
            </section>
          ))}
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
