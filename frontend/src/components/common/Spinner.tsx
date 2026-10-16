/**
 * Indicador de carga único de la app.
 *
 * Había ocho versiones a mano repartidas por las pantallas, cada una con su
 * tamaño y su color: unas doradas, otras grises, unas con borde y otras con un
 * SVG girando. Esta es la que vale.
 */
export function Spinner({
  size = "md",
  label = "Cargando",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  /** Lo lee un lector de pantalla; no se pinta. */
  label?: string;
  className?: string;
}) {
  const sizes = { sm: "size-4 border-2", md: "size-6 border-2", lg: "size-8 border-[3px]" };
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block animate-spin rounded-full border-brand-gold border-t-transparent ${sizes[size]} ${className}`}
    />
  );
}

/** Spinner centrado que ocupa el espacio disponible (fallback de una ruta). */
export function SpinnerScreen({ label = "Cargando" }: { label?: string }) {
  return (
    <div className="flex h-full w-full flex-1 items-center justify-center p-10">
      <Spinner size="md" label={label} />
    </div>
  );
}
