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
        title: "Usa una contraseña segura",
        desc: "Mínimo 8 caracteres combinando letras, números y símbolos.",
    },
    {
        d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
        title: "Guarda tus credenciales",
        desc: "Usa un gestor de contraseñas como Bitwarden o 1Password.",
    },
    {
        d: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
        title: "Usa tu correo corporativo",
        desc: "Registra la cuenta con tu email empresarial.",
    },
];

export function AuthPanel({ isRegister, onSwitch }: AuthPanelProps) {
    const items = isRegister ? REGISTER_TIPS : LOGIN_FEATURES;

    return (
        <aside className="relative flex w-full md:w-1/2 flex-col justify-between overflow-hidden bg-slate-900 px-8 py-12 md:px-14 md:py-16">
            {/* Malla de puntos */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.20]"
                style={{
                    backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
                    backgroundSize: "26px 26px",
                    color: "#475569",
                }}
            />
            {/* Resplandor azul */}
            <div
                className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
                style={{ background: "radial-gradient(circle, #2563eb 0%, transparent 70%)" }}
            />

            <div className="relative z-10">
                <span className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-400">
                    OBJ Digital
                </span>

                <h2 className="mt-6 max-w-md text-balance text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
                    {isRegister
                        ? "Crea tu cuenta de forma segura"
                        : "Gestiona tus proyectos con precisión"}
                </h2>

                <ul className="mt-10 space-y-5">
                    {items.map((item, i) => (
                        <li key={i} className="flex items-start gap-3.5">
                            <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400">
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
                        className="font-medium text-blue-400 transition hover:text-blue-300"
                    >
                        {isRegister ? "Inicia sesión" : "Regístrate"}
                    </button>
                </p>
                <p className="mt-3 text-xs text-slate-600">
                    Plataforma privada · Acceso solo autorizado
                </p>
            </div>
        </aside>
    );
}