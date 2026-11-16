import * as React from "react";
import { cn } from "@/lib/utils";
const Empty = ({ className, ...props }: React.ComponentProps<"div">) => <div className={cn("flex min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-card p-10 text-center", className)} {...props} />;
const EmptyHeader = ({ className, ...props }: React.ComponentProps<"div">) => <div className={cn("flex max-w-md flex-col items-center gap-2 text-center", className)} {...props} />;
const EmptyTitle = ({ className, ...props }: React.ComponentProps<"div">) => <div className={cn("text-lg font-semibold", className)} {...props} />;
const EmptyDescription = ({ className, ...props }: React.ComponentProps<"p">) => <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
export { Empty, EmptyHeader, EmptyTitle, EmptyDescription };
