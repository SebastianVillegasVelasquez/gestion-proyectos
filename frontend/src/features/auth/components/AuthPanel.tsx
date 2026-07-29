import { motion, useReducedMotion } from "framer-motion";

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

export function AuthPanel() {
  const reduceMotion = useReducedMotion();

  return (
    <aside className="relative flex w-full md:w-1/2 flex-col justify-between overflow-hidden bg-sidebar text-sidebar-foreground px-8 py-12 md:px-14 md:py-16">
      {/* Malla de puntos */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.20]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          color: "#475569",
        }}
      />

      {/* Composición animada: cuadros que se iluminan en secuencia */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {SQUARES.map((square, i) => (
          <motion.div
            key={`square-${String(i)}`}
            className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-md"
            style={{
              top: square.top,
              left: square.left,
              background: square.color,
            }}
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

      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <img
            src="/logo.webp"
            alt="Bitácora OBJ"
            className="h-10 w-10 shrink-0 rounded-lg object-contain"
          />
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-gold">
            Bitácora OBJ
          </span>
        </div>
      </div>

      <div className="relative z-10 mt-10">
        <p className="text-xs text-slate-600">Plataforma privada · Acceso solo autorizado</p>
      </div>
    </aside>
  );
}
