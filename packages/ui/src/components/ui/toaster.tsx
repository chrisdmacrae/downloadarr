import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastDescription,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <ToastViewport>
      {toasts.map(({ id, title, description, action, variant }) => (
        <Toast key={id} variant={variant} onDismiss={() => dismiss(id)}>
          {title && <ToastTitle>{title}</ToastTitle>}
          {description && <ToastDescription>{description}</ToastDescription>}
          {action}
        </Toast>
      ))}
    </ToastViewport>
  )
}
