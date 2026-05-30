import { useState } from "react";
import type { LoginRequest } from "@/features/auth/types.ts";

export default function LoginPage() {
    const [form, setForm] = useState<LoginRequest>({ email: "", password: "" });
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError(null);
    };

    const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (!form.email || !form.password) {
            setError("Por favor completa todos los campos.");
            return;
        }
        setLoading(true);
        // TODO: llamar a tu API de autenticación con `form`
        await new Promise((r) => setTimeout(r, 1500));
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
            {/* Fondo sutil con patrón de puntos */}
            <div
                className="absolute inset-0 opacity-40"
                style={{
                    backgroundImage:
                        "radial-gradient(circle, #94a3b8 1px, transparent 1px)",
                    backgroundSize: "28px 28px",
                }}
            />

            {/* Card principal */}
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                {/* Franja superior decorativa */}
                <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400" />

                <div className="px-10 py-10">
                    {/* Logo / Marca */}
                    <div className="mb-8 text-center">
            <span className="inline-block text-xs font-semibold tracking-[0.25em] text-amber-500 uppercase mb-3">
              OBJ Digital
            </span>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                            Acceso al sistema
                        </h1>
                        <p className="text-sm text-slate-400 mt-1">
                            Plataforma privada de gestión de proyectos
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-5 flex items-center gap-2.5 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                            <svg
                                className="w-4 h-4 text-red-500 shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Campo email */}
                    <div className="mb-5">
                        <label
                            htmlFor="email"
                            className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
                        >
                            Correo electrónico
                        </label>
                        <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                >
                  <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </span>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                value={form.email}
                                onChange={handleChange}
                                placeholder="nombre@empresa.com"
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder-slate-400 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 hover:border-slate-300"
                            />
                        </div>
                    </div>

                    {/* Campo contraseña */}
                    <div className="mb-3">
                        <label
                            htmlFor="password"
                            className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
                        >
                            Contraseña
                        </label>
                        <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </span>
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                value={form.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder-slate-400 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 hover:border-slate-300"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                                aria-label={
                                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                                }
                            >
                                {showPassword ? (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Olvidé contraseña */}
                    <div className="flex justify-end mb-7">
                        <button
                            type="button"
                            className="text-xs text-amber-500 hover:text-amber-600 font-medium transition"
                        >
                            ¿Olvidaste tu contraseña?
                        </button>
                    </div>

                    {/* Botón submit */}
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 active:scale-[0.98] text-white font-semibold text-sm tracking-wide transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-amber-100"
                    >
                        {loading ? (
                            <>
                                <svg
                                    className="w-4 h-4 animate-spin"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                                    />
                                </svg>
                                Verificando...
                            </>
                        ) : (
                            "Ingresar"
                        )}
                    </button>

                    {/* Pie */}
                    <p className="mt-6 text-center text-xs text-slate-400">
                        Acceso restringido · Solo usuarios autorizados
                    </p>
                </div>
            </div>
        </div>
    );
}
