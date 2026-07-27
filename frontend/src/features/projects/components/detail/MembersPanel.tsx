import { useMemo, useState } from "react";
import { UserPlus, Search, Mail, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectMembers } from "../../hooks/use-members";
import { memberInitials } from "../../utils/group-members";
import { filterMembers } from "../../utils/filter-members";
import { PROJECT_ROLE_LABELS, PROJECT_ROLE_ACCENT, positionLabel } from "../../types/labels";
import type { ProjectMember } from "../../types/api.types";
import { AddMemberModal } from "./AddMemberModal";

// Tarjeta de integrante (grid). El color del avatar y del badge de rol comparten
// el mismo acento para reconocer el rol de un vistazo y de forma consistente
// entre pantallas.
function MemberCard({ member }: { member: ProjectMember }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-5 transition-all hover:border-brand-gold/40 hover:shadow-lg">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            PROJECT_ROLE_ACCENT[member.project_role],
          )}
        >
          {memberInitials(member)}
        </div>
        <div className="min-w-0 flex-1">
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
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-accent/70 pt-3">
        <span
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
            PROJECT_ROLE_ACCENT[member.project_role],
          )}
        >
          {PROJECT_ROLE_LABELS[member.project_role]}
        </span>
        <span className="flex min-w-0 items-center gap-1 truncate text-xs font-semibold text-muted-foreground">
          <Briefcase className="size-3 shrink-0" />
          <span className="truncate">{positionLabel(member.position)}</span>
        </span>
      </div>
    </div>
  );
}

export function MembersPanel({ projectId }: { projectId: string }) {
  const membersQuery = useProjectMembers(projectId);
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-accent" />
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
        // Grid de integrantes; la última celda es la acción de agregar.
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((m) => (
              <MemberCard key={m.user_id} member={m} />
            ))}
            <button
              type="button"
              onClick={() => {
                setShowAdd(true);
              }}
              className="flex min-h-[126px] flex-col items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-border text-muted-foreground transition-colors hover:border-brand-gold/60 hover:text-foreground"
            >
              <UserPlus className="size-5" />
              <span className="text-sm font-bold">Agregar integrante</span>
            </button>
          </div>
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
