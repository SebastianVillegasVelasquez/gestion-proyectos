import { BrandCanvas } from "@/components/common/BrandCanvas";

export function AuthPanel() {
  return (
    <aside className="relative flex w-full flex-col justify-between overflow-hidden bg-sidebar px-8 py-12 text-sidebar-foreground md:w-1/2 md:px-14 md:py-16">
      {/* Mismo telón que la portada del perfil (ver BrandCanvas). */}
      <BrandCanvas />

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
