// Tema claro/oscuro: una sola fuente de verdad, aplicada ANTES de montar React.
//
// La clase `dark` tiene que estar en <html> desde el primer pintado. Si se pone
// en un efecto (después del montaje) pasan dos cosas: se ve un parpadeo claro, y
// —peor— los campos de formulario se quedan pintados con los valores del tema
// claro, porque el navegador no vuelve a resolver el `var()` de su fondo cuando
// la variable cambia en la raíz una vez ya los pintó. El resto de elementos sí
// se actualizan, así que el síntoma era una pantalla oscura con los inputs en
// gris claro.

const THEME_KEY = "obj-theme";

/** El tema guardado; si no hay ninguno, oscuro (el de la app). */
export function readStoredTheme(): boolean {
  try {
    return localStorage.getItem(THEME_KEY) !== "light";
  } catch {
    return true;
  }
}

/** Fija la clase en <html> y recuerda la elección. */
export function applyTheme(dark: boolean): void {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch {
    // Sin localStorage el tema dura lo que dure la pestaña: no es motivo para
    // romper nada.
  }
}
