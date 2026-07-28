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
 *   - Forma de las piezas: los paths aproximan logo-as-svg.svg (que es un
 *     JPEG incrustado, sin vectores reutilizables): TEAL_* forman el "6"
 *     (ascendente + anillo alrededor del ojo), GOLD_* el remolino grande y
 *     la "j". Retocar puntos de control o tealRingPath() para iterar.
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
const CX = 90;
const CY = 97;

// Centro/radios del aro dorado grande — el resto de piezas ("ojo" teal,
// pupila) se dimensionan en función de estos valores para llenar su hueco.
const GOLD_CX = 86;
const GOLD_CY = 100;
const GOLD_RX = 72;
const GOLD_RY = 65;

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

/**
 * Anillo teal ovalado alrededor del ojo: ~1.15 vueltas desde arriba-izquierda
 * (donde aterriza el ascendente), con el radio creciendo al final para
 * formar el remolino que sobresale hacia el aro dorado en el logo original.
 * rx/ry grandes a propósito: el aro debe llenar el hueco de GOLD_SWIRL_PATH.
 */
function tealRingPath(rx: number, ry: number, steps = 90): string {
  const parts: string[] = [];
  const startAngle = (215 / 180) * Math.PI;
  const turns = 1.15;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = startAngle + t * turns * Math.PI * 2;
    const grow = Math.max(0, (t - 0.78) / 0.22); // último tramo se abre hacia afuera
    const x = CX + (rx + grow * 16) * Math.cos(a);
    const y = CY + (ry + grow * 12) * Math.sin(a);
    parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return parts.join(" ");
}

const TEAL_RING_PATH = tealRingPath(38, 33);
// Ascendente del "6" teal: baja desde arriba y conecta con el inicio del
// anillo (calculado para el nuevo rx/ry de tealRingPath).
const TEAL_ASCENDER_PATH = "M 55 8 C 51 30 52 56 59 79";
// Óvalo dorado grande (achatado en Y), trazado con dos arcos SVG para que
// cierre sobre sí mismo en vez de dejar la abertura del remolino original.
const GOLD_SWIRL_PATH = `M ${String(GOLD_CX - GOLD_RX)} ${String(GOLD_CY)} A ${String(GOLD_RX)} ${String(GOLD_RY)} 0 1 0 ${String(GOLD_CX + GOLD_RX)} ${String(GOLD_CY)} A ${String(GOLD_RX)} ${String(GOLD_RY)} 0 1 0 ${String(GOLD_CX - GOLD_RX)} ${String(GOLD_CY)}`;
// "J" dorada (trazo más delgado): baja por la derecha bajo el punto naranja,
// movida un poco más a la derecha para despegarse del aro grande.
const GOLD_J_PATH = "M 153 44 C 163 58 167 82 165 106 C 163 136 153 160 131 176";

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
      {/* Dorado: remolino grande + "j" (envuelve al ojo) */}
      <motion.g
        variants={animated ? goldPiece : undefined}
        style={{ transformOrigin: `${String(GOLD_CX)}px ${String(GOLD_CY)}px` }}
      >
        <path
          d={GOLD_SWIRL_PATH}
          fill="none"
          stroke={COLORS.gold}
          strokeWidth={26}
          strokeLinecap="round"
        />
        <path
          d={GOLD_J_PATH}
          fill="none"
          stroke={COLORS.gold}
          strokeWidth={17}
          strokeLinecap="round"
        />
      </motion.g>
      {/* Ojo: fondo claro + "6" teal (ascendente y anillo con remolino) */}
      <motion.g
        variants={animated ? spiralPiece : undefined}
        style={{ transformOrigin: `${String(CX)}px ${String(CY)}px` }}
      >
        <ellipse cx={CX} cy={CY} rx={50} ry={44} fill={COLORS.eyeWhite} />
        <path
          d={TEAL_ASCENDER_PATH}
          fill="none"
          stroke={COLORS.teal}
          strokeWidth={12.5}
          strokeLinecap="round"
        />
        <path
          d={TEAL_RING_PATH}
          fill="none"
          stroke={COLORS.teal}
          strokeWidth={12.5}
          strokeLinecap="round"
        />
      </motion.g>
      {/* Pupila */}
      <motion.circle
        variants={animated ? pupilPiece : undefined}
        cx={CX}
        cy={CY}
        r={17}
        fill={COLORS.pupil}
        style={{ transformOrigin: `${String(CX)}px ${String(CY)}px` }}
      />
      {/* Punto naranja (toque final) */}
      <motion.circle
        variants={animated ? orangePiece : undefined}
        cx={166}
        cy={18}
        r={9.5}
        fill={COLORS.orange}
        style={{ transformOrigin: "166px 18px" }}
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
