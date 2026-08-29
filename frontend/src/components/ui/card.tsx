import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

const cardVariants = cva("rounded-lg border border-border bg-card text-card-foreground", {
  variants: {
    /** Borde izquierdo de acento (header de card gold, riesgo alto red). */
    accent: {
      none: "",
      gold: "border-l-4 border-l-brand-gold",
      red: "border-l-4 border-l-brand-red",
    },
    /** Elevación sutil en hover para cards clicables. */
    interactive: {
      true: "transition-shadow hover:shadow-md",
      false: "",
    },
  },
  defaultVariants: { accent: "none", interactive: false },
});

interface CardProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

function Card({ className, accent, interactive, ...props }: CardProps) {
  return <div className={cn(cardVariants({ accent, interactive }), className)} {...props} />;
}

function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // Padding más ajustado en móvil; a partir de `sm` recupera el del diseño.
  return <div className={cn("flex flex-col space-y-1 p-4 sm:p-5", className)} {...props} />;
}

// `ref` incluido en las props: React 19 lo trata como una prop normal en
// componentes de función, y algunas vistas necesitan el nodo del contenedor
// (p. ej. para auto-scroll mientras se arrastra dentro de él).
function CardContent({
  className,
  ref,
  ...props
}: HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div ref={ref} className={cn("p-4 pt-0 sm:p-5 sm:pt-0", className)} {...props} />;
}

function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-sm font-semibold leading-none text-card-foreground", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardContent, CardTitle };
