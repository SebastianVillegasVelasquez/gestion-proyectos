import { motion } from "framer-motion";

// Formas ambientales: solo transform/opacity (GPU-friendly), en bucle infinito
// y desfasadas entre sí para que el movimiento no se sienta mecánico.
const ORBS = [
  { size: 260, top: "8%", left: "12%", color: "var(--brand-gold)", duration: 12, delay: 0 },
  { size: 200, top: "58%", left: "62%", color: "var(--brand-teal)", duration: 15, delay: 1.2 },
  { size: 150, top: "68%", left: "8%", color: "var(--brand-gold)", duration: 10, delay: 0.6 },
  { size: 120, top: "14%", left: "68%", color: "var(--brand-teal)", duration: 13, delay: 2 },
];

const RINGS = [
  { size: 340, top: "30%", left: "38%", duration: 26 },
  { size: 220, top: "42%", left: "48%", duration: 34 },
];

export function AuthPanel() {
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
            key={i}
            className="absolute rounded-full blur-3xl"
            style={{
              width: orb.size,
              height: orb.size,
              top: orb.top,
              left: orb.left,
              background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
              opacity: 0.22,
            }}
            animate={{
              y: [0, -22, 0, 18, 0],
              x: [0, 16, 0, -14, 0],
              scale: [1, 1.08, 1, 0.95, 1],
            }}
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
            key={i}
            className="absolute rounded-full border border-brand-gold/20"
            style={{ width: ring.size, height: ring.size, top: ring.top, left: ring.left }}
            animate={{ rotate: 360, scale: [1, 1.04, 1] }}
            transition={{ duration: ring.duration, repeat: Infinity, ease: "linear" }}
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
