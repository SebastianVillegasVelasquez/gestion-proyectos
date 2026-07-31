/**
 * Utilidades puras para la edición masiva de títulos de tareas.
 *
 * Caso típico: se crean muchas tareas de un módulo y todas quedan como
 * "C1 - Guion", "C1 - Locución"… Al seleccionarlas, detectamos el prefijo común
 * ("C1 - ") y permitimos reemplazar solo esa parte en todas de una vez.
 */

/** Prefijo común más largo de un conjunto de títulos (cadena vacía si no hay). */
export function commonPrefix(titles: string[]): string {
  if (titles.length === 0) {
    return "";
  }
  let prefix = titles[0];
  for (const title of titles.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < title.length && prefix[i] === title[i]) {
      i += 1;
    }
    prefix = prefix.slice(0, i);
    if (prefix === "") {
      break;
    }
  }
  return prefix;
}

/**
 * Reemplaza la primera aparición de `find` por `replace` en `title`. Si `find`
 * está vacío o no aparece, devuelve el título sin cambios. Se usa para cambiar el
 * fragmento común (p. ej. "C1 - ") sin tocar el resto de cada título.
 */
export function replaceInTitle(title: string, find: string, replace: string): string {
  if (!find) {
    return title;
  }
  const idx = title.indexOf(find);
  if (idx === -1) {
    return title;
  }
  return title.slice(0, idx) + replace + title.slice(idx + find.length);
}
