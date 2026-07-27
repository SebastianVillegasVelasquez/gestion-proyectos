import { motion, useReducedMotion } from "framer-motion";

// Toda la composición usa solo transform/opacity (compositables por GPU) para
// que la animación sea fluida sin repaints. Los tiempos están desfasados entre
// figuras para que el conjunto no se sienta mecánico ni sincronizado.

// Orbes difuminados de fondo: dan color y profundidad, no son el foco.
const ORBS = [
  { size: 300, top: "-6%", left: "6%", color: "var(--brand-gold)", duration: 14, delay: 0 },
  { size: 240, top: "56%", left: "58%", color: "var(--brand-teal)", duration: 17, delay: 1.4 },
  { size: 180, top: "72%", left: "2%", color: "var(--brand-gold)", duration: 12, delay: 0.6 },
];

// Anillos nítidos que rotan y laten: la "figura que se mueve" más evidente.
const RINGS = [
  { size: 360, top: "24%", left: "30%", duration: 28, color: "var(--brand-gold)", opacity: 0.35 },
  { size: 240, top: "34%", left: "44%", duration: 22, color: "var(--brand-teal)", opacity: 0.3 },
  { size: 150, top: "58%", left: "18%", duration: 34, color: "var(--brand-gold)", opacity: 0.25 },
];

// Formas geométricas sólidas que flotan (círculo, cuadrado rotado, triángulo).
const SHAPES = [
  { kind: "circle", size: 18, top: "20%", left: "72%", color: "var(--brand-gold)", duration: 7 },
  { kind: "square", size: 22, top: "70%", left: "70%", color: "var(--brand-teal)", duration: 9 },
  { kind: "circle", size: 12, top: "82%", left: "40%", color: "var(--brand-teal)", duration: 6 },
  { kind: "square", size: 14, top: "12%", left: "44%", color: "var(--brand-gold)", duration: 8 },
  { kind: "circle", size: 10, top: "46%", left: "80%", color: "var(--brand-gold)", duration: 5.5 },
] as const;

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

      {/* Composición animada */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {ORBS.map((orb, i) => (
          <motion.div
            key={`orb-${i}`}
            className="absolute rounded-full blur-3xl"
            style={{
              width: orb.size,
              height: orb.size,
              top: orb.top,
              left: orb.left,
              background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
              opacity: 0.3,
            }}
            animate={
              reduceMotion
                ? undefined
                : { y: [0, -26, 0, 20, 0], x: [0, 18, 0, -16, 0], scale: [1, 1.1, 1, 0.94, 1] }
            }
            transition={{
              duration: orb.duration,
              delay: orb.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        {RINGS.map((ring, i) => (
          <motion.div
            key={`ring-${i}`}
            className="absolute rounded-full"
            style={{
              width: ring.size,
              height: ring.size,
              top: ring.top,
              left: ring.left,
              border: `1.5px solid ${ring.color}`,
              opacity: ring.opacity,
            }}
            animate={reduceMotion ? undefined : { rotate: 360, scale: [1, 1.06, 1] }}
            transition={{ duration: ring.duration, repeat: Infinity, ease: "linear" }}
          />
        ))}

        {SHAPES.map((shape, i) => (
          <motion.div
            key={`shape-${i}`}
            className="absolute"
            style={{
              width: shape.size,
              height: shape.size,
              top: shape.top,
              left: shape.left,
              background: shape.color,
              borderRadius: shape.kind === "circle" ? "9999px" : "5px",
              opacity: 0.55,
            }}
            animate={
              reduceMotion
                ? undefined
                : {
                    y: [0, -18, 0, 14, 0],
                    x: [0, 10, 0, -8, 0],
                    rotate: shape.kind === "square" ? [0, 90, 180, 270, 360] : 0,
                    opacity: [0.55, 0.85, 0.55],
                  }
            }
            transition={{
              duration: shape.duration,
              delay: i * 0.5,
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
