import { motion, useReducedMotion, type Variants } from "framer-motion";

/**
 * <LogoAssembly /> — animación de ensamblaje del logo Bitácora OBJ.
 *
 * Corre UNA sola vez al montar y termina en un idle sutil infinito.
 * Fases (los números clave para iterar timing están en TIMING, abajo):
 *   1. 0.0s - 0.3s  → nada visible (las partículas nacen fuera del viewBox).
 *   2. 0.3s - 2.2s  → 16 partículas convergen en espiral hacia el centro.
 *   3. 1.8s - 3.2s  → las piezas reales del logo se ensamblan (overlap con fase 2).
 *   4. 3.2s → ∞     → micro-flotación + pulso de glow.
 *
 * Cómo iterar el diseño:
 *   - Timing global: ajustar TIMING (todo lo demás se deriva de ahí).
 *   - Colores: COLORS usa los tokens de marca de App.css con fallback hex;
 *     el naranja no tiene token, es el color del punto del logo original.
 *   - Forma de las piezas: SPIRAL_PATH y GOLD_PATH aproximan el logo.webp
 *     (trazo a mano alzada); retocar los puntos de control del path dorado
 *     o los radios de spiralPath() si el diseño entrega un SVG oficial.
 *
 * Rendimiento: solo se animan transform y opacity (compositables por GPU,
 * no disparan layout). SVG inline, sin canvas ni libs nuevas. Con
 * prefers-reduced-motion se muestra el logo estático directamente.
 */

const TIMING = {
  particlesStart: 0.3, // inicio fase 2
  particleStagger: 0.045, // delay entre partículas
  particleDuration: 1.5, // vuelo de cada partícula
  piecesStart: 1.8, // inicio fase 3 (overlap intencional con fase 2)
  idleStart: 3.4, // inicio fase 4
} as const;

const COLORS = {
  teal: "var(--brand-teal, #4da0b1)",
  gold: "var(--brand-gold, #e4b54f)",
  orange: "#d96b2b", // punto del logo original; no existe token de marca
  pupil: "#141414",
  eyeWhite: "#faf7ef",
} as const;

// Centro del "ojo" dentro del viewBox 0 0 200 200.
const CX = 104;
const CY = 92;

const PARTICLE_COUNT = 16;
const PARTICLE_COLORS = [COLORS.teal, COLORS.gold, COLORS.orange, COLORS.gold, COLORS.teal];

/** Pseudo-aleatorio determinista: mismas trayectorias en cada montaje. */
function jitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Keyframes de una trayectoria espiral (radio y ángulo decrecientes) hacia
 * el centro. Framer Motion interpola los arrays x/y; el easing "hacia
 * adentro" va codificado en la propia curva (t²), así la llegada se siente
 * acelerada y con peso sin depender de springs (los springs de Framer no
 * soportan keyframes múltiples).
 */
function spiralTrajectory(
  startAngle: number,
  startRadius: number,
  spin: number,
  steps = 16,
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const eased = t * t; // acelera al acercarse al centro
    const r = startRadius * (1 - eased);
    const a = startAngle + spin * eased;
    xs.push(CX + r * Math.cos(a));
    ys.push(CY + r * Math.sin(a));
  }
  return { xs, ys };
}

interface Particle {
  xs: number[];
  ys: number[];
  size: number;
  color: string;
  delay: number;
}

// Generadas una sola vez a nivel de módulo (no en cada render).
const PARTICLES: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + jitter(i) * 0.8;
  const radius = 150 + jitter(i + 40) * 70; // nace fuera del viewBox (r > 100√2 no hace falta; 150+ ya queda fuera visualmente)
  const spin = Math.PI * (1.1 + jitter(i + 80) * 0.7); // ~media vuelta a una vuelta de espiral
  const { xs, ys } = spiralTrajectory(angle, radius, spin);
  return {
    xs,
    ys,
    size: 2 + jitter(i + 120) * 2, // radio 2-4 → diámetro 4-8px
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    delay: TIMING.particlesStart + i * TIMING.particleStagger,
  };
});

/** Espiral teal: generada como polilínea suave (radio creciente, ~1.6 vueltas). */
function spiralPath(rStart: number, rEnd: number, turns: number, steps = 72): string {
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = -Math.PI / 2 + t * turns * Math.PI * 2;
    const r = rStart + (rEnd - rStart) * t;
    const x = CX + r * Math.cos(a);
    const y = CY + r * Math.sin(a);
    parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return parts.join(" ");
}

const SPIRAL_PATH = spiralPath(14, 34, 1.6);

// Trazo dorado tipo "6": ascendente arriba-izquierda, envuelve por debajo
// y sube por la derecha hacia el punto naranja (aproximación del logo.webp).
const GOLD_PATH =
  "M 86 8 C 68 34 46 62 44 100 C 42 146 74 174 112 170 C 150 166 172 138 168 104 C 165 76 152 58 156 34";

// ── Variants por fase ────────────────────────────────────────────────────────

/** Contenedor de las piezas del logo: solo orquesta, no anima nada propio. */
const logoContainer: Variants = {
  hidden: {},
  assembled: {},
};

/** Fase 3 — espiral teal: rota -90°→0°, escala 0.6→1, fade in. */
const spiralPiece: Variants = {
  hidden: { opacity: 0, rotate: -90, scale: 0.6 },
  assembled: {
    opacity: 1,
    rotate: 0,
    scale: 1,
    transition: {
      delay: TIMING.piecesStart,
      type: "spring",
      stiffness: 100,
      damping: 16,
    },
  },
};

/** Fase 3 — pupila: aparece con la espiral, sin protagonismo propio. */
const pupilPiece: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  assembled: {
    opacity: 1,
    scale: 1,
    transition: {
      delay: TIMING.piecesStart + 0.1,
      type: "spring",
      stiffness: 120,
      damping: 15,
    },
  },
};

/** Fase 3 — forma dorada: entra con leve delay, rotando para "envolver". */
const goldPiece: Variants = {
  hidden: { opacity: 0, rotate: -18, scale: 0.85, y: 10 },
  assembled: {
    opacity: 1,
    rotate: 0,
    scale: 1,
    y: 0,
    transition: {
      delay: TIMING.piecesStart + 0.15,
      type: "spring",
      stiffness: 90,
      damping: 15,
    },
  },
};

/** Fase 3 — punto naranja: entra último con "pop" (overshoot del spring). */
const orangePiece: Variants = {
  hidden: { opacity: 0, scale: 0 },
  assembled: {
    opacity: 1,
    scale: 1,
    transition: {
      delay: TIMING.piecesStart + 0.35,
      type: "spring",
      stiffness: 260, // rígido + poco amortiguado → overshoot ~1.15 y asienta
      damping: 12,
    },
  },
};

// ── Piezas del logo (compartidas entre versión animada y estática) ───────────

function LogoPieces({ animated }: { animated: boolean }) {
  return (
    <motion.g
      variants={animated ? logoContainer : undefined}
      initial={animated ? "hidden" : false}
      animate={animated ? "assembled" : false}
    >
      {/* Forma dorada tipo "6" (envuelve por debajo) */}
      <motion.path
        variants={animated ? goldPiece : undefined}
        d={GOLD_PATH}
        fill="none"
        stroke={COLORS.gold}
        strokeWidth={22}
        strokeLinecap="round"
        style={{ transformOrigin: "100px 100px" }}
      />
      {/* Ojo: fondo claro + espiral teal */}
      <motion.g
        variants={animated ? spiralPiece : undefined}
        style={{ transformOrigin: `${String(CX)}px ${String(CY)}px` }}
      >
        <circle cx={CX} cy={CY} r={40} fill={COLORS.eyeWhite} />
        <path
          d={SPIRAL_PATH}
          fill="none"
          stroke={COLORS.teal}
          strokeWidth={9}
          strokeLinecap="round"
        />
      </motion.g>
      {/* Pupila */}
      <motion.circle
        variants={animated ? pupilPiece : undefined}
        cx={CX}
        cy={CY}
        r={12}
        fill={COLORS.pupil}
        style={{ transformOrigin: `${String(CX)}px ${String(CY)}px` }}
      />
      {/* Punto naranja (toque final) */}
      <motion.circle
        variants={animated ? orangePiece : undefined}
        cx={168}
        cy={22}
        r={9}
        fill={COLORS.orange}
        style={{ transformOrigin: "168px 22px" }}
      />
    </motion.g>
  );
}

// ── Componente ───────────────────────────────────────────────────────────────

export function LogoAssembly({ size = 240 }: { size?: number }) {
  const reduceMotion = useReducedMotion();

  // Accesibilidad: con animación reducida en el SO, logo estático directo.
  if (reduceMotion) {
    return (
      <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
        <LogoPieces animated={false} />
      </svg>
    );
  }

  return (
    <div className="relative" style={{ width: size, height: size }} aria-hidden="true">
      {/* Fase 4 — glow que pulsa detrás del logo (solo opacity: barato) */}
      <motion.div
        className="absolute inset-[-20%] rounded-full"
        style={{
          background: `radial-gradient(circle, ${COLORS.gold} 0%, transparent 65%)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.1, 0.22] }}
        transition={{
          delay: TIMING.idleStart,
          duration: 3.5,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "mirror",
        }}
      />

      {/* Fase 4 — micro-flotación del conjunto (arranca tras el ensamblaje) */}
      <motion.div
        animate={{ y: [0, -3] }}
        transition={{
          delay: TIMING.idleStart,
          duration: 3.2,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "mirror",
        }}
        className="relative"
      >
        <svg width={size} height={size} viewBox="0 0 200 200" overflow="visible">
          {/* Fase 2 — partículas convergiendo en espiral. Se animan cx/cy vía
              transform (x/y de Framer sobre <circle> compone transforms, no
              layout) y se desvanecen justo al llegar al centro. */}
          <g>
            {PARTICLES.map((p, i) => (
              <motion.circle
                key={`particle-${String(i)}`}
                r={p.size}
                fill={p.color}
                cx={0}
                cy={0}
                initial={{ x: p.xs[0], y: p.ys[0], opacity: 0 }}
                animate={{
                  x: p.xs,
                  y: p.ys,
                  opacity: [0, 1, 1, 0.9, 0],
                }}
                transition={{
                  delay: p.delay,
                  duration: TIMING.particleDuration,
                  ease: "linear", // el easing real está codificado en la trayectoria (t²)
                  opacity: {
                    delay: p.delay,
                    duration: TIMING.particleDuration,
                    times: [0, 0.12, 0.7, 0.9, 1],
                  },
                }}
              />
            ))}
          </g>

          {/* Fase 3 — piezas reales del logo */}
          <LogoPieces animated />
        </svg>
      </motion.div>
    </div>
  );
}
