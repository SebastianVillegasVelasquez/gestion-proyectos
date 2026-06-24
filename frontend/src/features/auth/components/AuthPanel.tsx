interface AuthPanelProps {
  isRegister: boolean;
  onSwitch: () => void;
}

const LOGIN_FEATURES = [
  {
    d: "M3 7h18M3 12h18M3 17h18",
    title: "Centraliza todos tus proyectos",
  },
  {
    d: "M9 19V6l12-3v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z",
    title: "Seguimiento en tiempo real y Gantt",
  },
  {
    d: "M13 10V3L4 14h7v7l9-11h-7z",
    title: "Reportes ejecutivos con IA",
  },
];

const REGISTER_TIPS = [
  {
    d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    title: "Crea una contraseña robusta",
    desc: "Prefiere una frase larga (12+ caracteres) con mayúsculas, números y símbolos. Evita nombres, fechas o palabras del diccionario.",
  },
  {
    d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    title: "Usa un gestor de contraseñas",
    desc: "Bitwarden, 1Password o KeePass generan y guardan una clave única por sitio. Así no necesitas memorizarlas ni anotarlas.",
  },
  {
    d: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z",
    title: "No reutilices contraseñas",
    desc: "Una clave distinta por servicio evita que la filtración de un sitio comprometa tus demás cuentas.",
  },
  {
    d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Activa la verificación en dos pasos",
    desc: "Cuando esté disponible, añade 2FA (autenticación en dos pasos) para una capa extra de protección.",
  },
];

export function AuthPanel({ isRegister, onSwitch }: AuthPanelProps) {
  const items = isRegister ? REGISTER_TIPS : LOGIN_FEATURES;

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
      {/* Resplandor dorado ambiental */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--brand-gold) 0%, transparent 70%)" }}
      />

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

        <h2 className="mt-6 max-w-md text-balance text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
          {isRegister ? "Crea tu cuenta de forma segura" : "Gestiona tus proyectos con precisión"}
        </h2>

        <ul className="mt-10 space-y-5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-3.5">
              <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-brand-gold/30 bg-brand-gold/10 text-brand-gold">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={(item as any).d} />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                {"desc" in item && (
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                    {(item as any).desc}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 mt-10">
        <p className="text-xs text-slate-500">
          {isRegister ? "¿Ya tienes cuenta? " : "¿No tienes cuenta? "}
          <button
            type="button"
            onClick={onSwitch}
            className="font-medium text-brand-gold transition hover:text-brand-gold-dark"
          >
            {isRegister ? "Inicia sesión" : "Regístrate"}
          </button>
        </p>
        <p className="mt-3 text-xs text-slate-600">Plataforma privada · Acceso solo autorizado</p>
      </div>
    </aside>
  );
}
