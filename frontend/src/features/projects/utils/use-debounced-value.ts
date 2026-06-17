import { useEffect, useState } from "react";

/** Devuelve el valor tras `delay` ms sin cambios. Evita disparar peticiones
 * en cada tecla (debounce) al buscar. */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(value);
    }, delay);
    return () => {
      clearTimeout(id);
    };
  }, [value, delay]);

  return debounced;
}
