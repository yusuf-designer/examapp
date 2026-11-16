import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const alertVariants = cva("relative w-full rounded-2xl border p-4 text-sm", {
  variants: { variant: {
    default: "bg-secondary text-secondary-foreground border-transparent",
    warning: "bg-amber-50 text-amber-950 border-amber-200",
    destructive: "bg-red-50 text-red-950 border-red-200",
    success: "bg-green-50 text-green-950 border-green-200",
  } },
  defaultVariants: { variant: "default" },
});
const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>>(({ className, variant, ...p }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...p} />));
Alert.displayName = "Alert";
const AlertTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => <h5 className={cn("mb-1 font-semibold leading-none", className)} {...p} />;
const AlertDescription = ({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) => <div className={cn("leading-relaxed", className)} {...p} />;
export { Alert, AlertTitle, AlertDescription };
