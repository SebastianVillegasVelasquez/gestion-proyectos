import { useEffect } from "react";

/** Distancia al borde (px) dentro de la cual el contenedor empieza a desplazarse. */
const EDGE = 56;
/** Velocidad máxima, en px por fotograma, al pegarse al borde. */
const MAX_SPEED = 18;

/**
 * Desplaza `ref` mientras se arrastra cerca de sus bordes superior/inferior.
 *
 * HTML5 drag & drop no hace auto-scroll dentro de un contenedor con overflow:
 * si el destino queda fuera de la parte visible, sencillamente no hay forma de
 * llegar hasta él sin soltar. En un árbol de proyecto con varias ramas abiertas
 * eso hace que mover un elemento a otra rama parezca "imposible", que es justo
 * lo que se sentía al arrastrar hijos entre padres distintos.
 *
 * El listener va en `document` (no en el contenedor) porque durante un arrastre
 * el puntero puede salirse de él, y en fase de captura para no depender de que
 * nadie llame a stopPropagation por el camino.
 */
export function useDragAutoScroll(ref: React.RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }
    let frame = 0;
    let speed = 0;

    const step = () => {
      const el = ref.current;
      if (el && speed !== 0) {
        el.scrollTop += speed;
      }
      frame = requestAnimationFrame(step);
    };

    const onDragOver = (e: DragEvent) => {
      const el = ref.current;
      if (!el) {
        return;
      }
      const rect = el.getBoundingClientRect();
      const fromTop = e.clientY - rect.top;
      const fromBottom = rect.bottom - e.clientY;
      // Fuera del contenedor (o de su franja de borde) no desplazamos nada.
      if (fromTop < 0 || fromBottom < 0) {
        speed = 0;
      } else if (fromTop < EDGE) {
        // Cuanto más cerca del borde, más rápido: da control fino al acercarse
        // al destino y velocidad para recorrer listas largas.
        speed = -Math.ceil(((EDGE - fromTop) / EDGE) * MAX_SPEED);
      } else if (fromBottom < EDGE) {
        speed = Math.ceil(((EDGE - fromBottom) / EDGE) * MAX_SPEED);
      } else {
        speed = 0;
      }
    };

    const stop = () => {
      speed = 0;
    };

    document.addEventListener("dragover", onDragOver, true);
    document.addEventListener("drop", stop, true);
    document.addEventListener("dragend", stop, true);
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("dragover", onDragOver, true);
      document.removeEventListener("drop", stop, true);
      document.removeEventListener("dragend", stop, true);
    };
  }, [ref, active]);
}
