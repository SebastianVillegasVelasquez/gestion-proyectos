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
          Gestiona tus proyectos con precisión
        </h2>

        <ul className="mt-10 space-y-5">
          {LOGIN_FEATURES.map((item, i) => (
            <li key={i} className="flex items-start gap-3.5">
              <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-brand-gold/30 bg-brand-gold/10 text-brand-gold">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.d} />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-100">{item.title}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 mt-10">
        <p className="text-xs text-slate-600">Plataforma privada · Acceso solo autorizado</p>
      </div>
    </aside>
  );
}
