import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/hooks/use-sortable-data";

/**
 * Header de columna ordenable: mismo look que un `<th>` normal, pero clicable.
 * Muestra una flecha tenue (sin ordenar), o llena con la dirección activa.
 */
export function SortableTh<K extends string>({
  label,
  columnKey,
  activeKey,
  direction,
  onSort,
  className,
  align = "left",
}: {
  label: string;
  columnKey: K;
  activeKey: K | null;
  direction: SortDirection;
  onSort: (key: K) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const isActive = activeKey === columnKey;
  const Icon = isActive ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => {
          onSort(columnKey);
        }}
        aria-label={`Ordenar por ${label}`}
        className={cn(
          "flex items-center gap-1 transition-colors hover:text-foreground",
          align === "right" && "ml-auto flex-row-reverse",
          isActive && "text-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3 shrink-0", !isActive && "opacity-40")} />
      </button>
    </th>
  );
}
