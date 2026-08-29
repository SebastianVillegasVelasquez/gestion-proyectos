import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: Crumb[];
  actions?: ReactNode;
  className?: string;
}

/**
 * Encabezado de página del design system Bitácora OBJ.
 * - Título con acento dorado de 3px debajo.
 * - Breadcrumb en teal con subrayado al hover.
 * - Slot de acciones alineado a la derecha.
 */
export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-5 sm:mb-6", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Ruta de navegación" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {breadcrumb.map((crumb, i) => {
              const isLast = i === breadcrumb.length - 1;
              return (
                <li key={`${crumb.label}-${String(i)}`} className="flex items-center gap-1">
                  {crumb.href && !isLast ? (
                    <Link
                      to={crumb.href}
                      className="text-brand-teal transition-colors hover:text-brand-teal-dark hover:underline"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={cn(isLast && "text-foreground")}>{crumb.label}</span>
                  )}
                  {!isLast && <ChevronRight className="size-3 shrink-0 text-muted-foreground" />}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="inline-block text-xl font-semibold tracking-tight text-foreground">
            {title}
            {/* Acento dorado de 3px bajo el título */}
            <span className="mt-1.5 block h-[3px] w-full rounded-full bg-brand-gold" />
          </h1>
          {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
