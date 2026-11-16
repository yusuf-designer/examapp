import { Toast, ToastClose, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { useToasts } from "@/lib/store";
export function Toaster() {
  const toasts = useToasts();
  return (
    <ToastProvider duration={5000}>
      {toasts.map((t) => (<Toast key={t.id} variant={t.kind === "error" ? "destructive" : "default"} open><ToastTitle>{t.text}</ToastTitle><ToastClose /></Toast>))}
      <ToastViewport />
    </ToastProvider>
  );
}
