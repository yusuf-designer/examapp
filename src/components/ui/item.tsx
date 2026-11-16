import * as React from "react";
import { cn } from "@/lib/utils";
const Item = ({ className, ...props }: React.ComponentProps<"div">) => <div className={cn("flex items-start gap-4 rounded-xl border bg-card p-5", className)} {...props} />;
const ItemMedia = ({ className, ...props }: React.ComponentProps<"div">) => <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground", className)} {...props} />;
const ItemContent = ({ className, ...props }: React.ComponentProps<"div">) => <div className={cn("flex flex-1 flex-col gap-1", className)} {...props} />;
const ItemTitle = ({ className, ...props }: React.ComponentProps<"div">) => <div className={cn("font-semibold", className)} {...props} />;
const ItemDescription = ({ className, ...props }: React.ComponentProps<"p">) => <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
export { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription };
