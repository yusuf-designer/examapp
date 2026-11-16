import * as React from "react";
import { cn } from "@/lib/utils";
const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn("flex h-11 w-full rounded-full border-0 bg-input px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-80", className)} {...props} />));
NativeSelect.displayName = "NativeSelect";
export { NativeSelect };
