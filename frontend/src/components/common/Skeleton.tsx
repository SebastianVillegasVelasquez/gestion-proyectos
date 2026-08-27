import { cn } from "@/lib/utils";

/**
 * Hueco que late mientras llega el dato que va en su sitio.
 *
 * Va DENTRO de la caja definitiva, no en lugar de ella: sustituir la tarjeta
 * entera por un rectángulo gris hace que al llegar los datos salte todo el
 * layout, y mientras tanto no se entiende qué se está esperando. Con la caja ya
 * dibujada, lo único que cambia es el contenido.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block animate-pulse rounded-md bg-muted-foreground/15", className)}
    />
  );
}
