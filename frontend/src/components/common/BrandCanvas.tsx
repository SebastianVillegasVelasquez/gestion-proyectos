import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// Grilla de cuadros que se iluminan de forma escalonada, tipo "tablero" de luces.
const GRID_COLS = 7;
const GRID_ROWS = 5;
const SQUARES = Array.from({ length: GRID_COLS * GRID_ROWS }, (_, i) => {
  const col = i % GRID_COLS;
  const row = Math.floor(i / GRID_COLS);
  return {
    top: `${String((row / (GRID_ROWS - 1)) * 100)}%`,
    left: `${String((col / (GRID_COLS - 1)) * 100)}%`,
    color: (col + row) % 2 === 0 ? "var(--brand-gold)" : "var(--brand-teal)",
    delay: (col + row) * 0.15,
  };
});

/**
 * El telón animado de la marca: malla de puntos + cuadros dorados y teal que se
 * encienden en secuencia.
 *
 * Vive aquí, y no dentro del panel de acceso, porque es la misma imagen en dos
 * sitios (la pantalla de acceso y la portada del perfil): duplicarla habría
 * hecho que una de las dos se quedara atrás en cuanto la otra cambiara.
 *
 * Es puramente decorativo (`aria-hidden`) y respeta «reducir movimiento».
 */
export function BrandCanvas({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden="true"
    >
      {/* Malla de puntos */}
      <div
        className="absolute inset-0 opacity-[0.20]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          color: "#475569",
        }}
      />

      {SQUARES.map((square, i) => (
        <motion.div
          key={`square-${String(i)}`}
          className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-md"
          style={{ top: square.top, left: square.left, background: square.color }}
          animate={
            reduceMotion
              ? undefined
              : {
                  opacity: [0.12, 0.7, 0.12],
                  boxShadow: [
                    `0 0 0px ${square.color}`,
                    `0 0 18px ${square.color}`,
                    `0 0 0px ${square.color}`,
                  ],
                }
          }
          transition={{
            duration: 3,
            delay: square.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
