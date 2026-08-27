import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminUserSortField, SortDirection } from "../../api/users.api";

// ── Cabecera ordenable ──────────────────────────────────────────────────────
// El orden lo resuelve el backend (la lista está paginada), así que la
// cabecera solo publica "por qué columna y en qué sentido".
export function SortableHeader({
  field,
  label,
  sort,
  onSort,
  align = "center",
}: {
  field: AdminUserSortField;
  label: string;
  sort: { by: AdminUserSortField; dir: SortDirection };
  onSort: (field: AdminUserSortField) => void;
  align?: "left" | "center" | "right";
}) {
  const active = sort.by === field;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;

  return (
    <th
      scope="col"
      // aria-sort le dice al lector de pantalla lo mismo que la flecha dice
      // visualmente: por qué columna está ordenada la tabla.
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "py-2.5",
        // La tabla es text-left por defecto: la cabecera centrada tiene que
        // pedir el centrado explícitamente para alinearse con su columna.
        align === "left"
          ? "px-5 text-left"
          : align === "right"
            ? "px-5 text-right"
            : "px-3 text-center",
      )}
    >
      <button
        type="button"
        onClick={() => {
          onSort(field);
        }}
        className={cn(
          "inline-flex items-center gap-1 rounded transition hover:text-foreground",
          align === "center" && "justify-center",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", !active && "opacity-40")} />
      </button>
    </th>
  );
}
