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
  return <div className={cn("flex flex-col space-y-1 p-5", className)} {...props} />;
}

function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
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
