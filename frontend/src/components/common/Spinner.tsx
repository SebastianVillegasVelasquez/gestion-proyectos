/**
 * Indicador de carga que ocupa el espacio disponible: el fallback de una ruta
 * que todavía descarga su chunk, o de una sesión que se está comprobando.
 *
 * Los spinners DENTRO de un botón no pasan por aquí a propósito: usan
 * `<Loader2 className="animate-spin" />` y heredan el color del botón con
 * `currentColor`, que es lo que hace que se vean bien tanto en el botón dorado
 * como en el destructivo. Un anillo de color fijo ahí quedaría peor.
 */
export function SpinnerScreen({ label = "Cargando" }: { label?: string }) {
  return (
    <div className="flex h-full w-full flex-1 items-center justify-center p-10">
      <span
        role="status"
        aria-label={label}
        className="inline-block size-6 animate-spin rounded-full border-2 border-brand-gold border-t-transparent"
      />
    </div>
  );
}
