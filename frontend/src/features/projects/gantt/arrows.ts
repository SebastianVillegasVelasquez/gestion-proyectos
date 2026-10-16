/** Geometría de una barra en el área de pistas, en píxeles. */
export interface BarBox {
  yTop: number;
  left: number;
  width: number;
}

export interface DependencyEdge {
  id: string;
  /** Clave de la barra predecesora (tarea o elemento). */
  fromKey: string;
  /** Tarea que depende de ella. */
  toKey: string;
}

export interface ArrowPath {
  id: string;
  d: string;
  /** El sucesor empieza antes de que termine su predecesor: las fechas se contradicen. */
  conflict: boolean;
}

const LANE_STEP = 7;
const LANE_BASE = 12;
const ARROW_GAP = 3;

/**
 * Traza las flechas finish-to-start entre barras. Cada dependencia usa su propio
 * carril (desplazado según cuántas comparten origen o destino) para que los
 * tramos verticales paralelos no se pisen. Si el sucesor queda a la izquierda
 * de donde termina el predecesor, la ruta rodea por el borde de su fila y se
 * marca como `conflict`, en vez de doblarse sobre la barra como si fuera normal.
 */
export function routeDependencyArrows(
  edges: DependencyEdge[],
  positions: Map<string, BarBox>,
  rowHeight: number,
): ArrowPath[] {
  const outLane = new Map<string, number>();
  const inLane = new Map<string, number>();
  const half = rowHeight / 2;
  const paths: ArrowPath[] = [];

  for (const edge of edges) {
    const from = positions.get(edge.fromKey);
    const to = positions.get(edge.toKey);
    if (!from || !to) {
      continue;
    }
    const k = outLane.get(edge.fromKey) ?? 0;
    outLane.set(edge.fromKey, k + 1);
    const j = inLane.get(edge.toKey) ?? 0;
    inLane.set(edge.toKey, j + 1);

    const x1 = from.left + from.width;
    const y1 = from.yTop + half;
    const x2 = to.left;
    const y2 = to.yTop + half;
    const exit = x1 + LANE_BASE + k * LANE_STEP;
    const enter = x2 - (LANE_BASE + j * LANE_STEP);
    const end = x2 - ARROW_GAP;
    const forward = exit < enter;
    // Borde de la fila destino por el que se rodea: el más cercano al origen.
    const edgeY = y2 + (y2 >= y1 ? -half : half);

    paths.push({
      id: edge.id,
      conflict: x2 < x1,
      d: forward
        ? `M ${x1} ${y1} H ${exit} V ${y2} H ${end}`
        : `M ${x1} ${y1} H ${exit} V ${edgeY} H ${enter} V ${y2} H ${end}`,
    });
  }
  return paths;
}
