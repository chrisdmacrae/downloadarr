import { useEffect, useState } from 'react'

export type ToastVariant = 'default' | 'destructive'

export interface Toast {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
  variant?: ToastVariant
}

/**
 * Toasts live in a module-level store rather than in each hook instance, so a
 * `toast()` call from any component reaches the single mounted `<Toaster />`.
 */
const AUTO_DISMISS_MS = 3200
const MAX_VISIBLE = 4

let toasts: Toast[] = []
const listeners = new Set<(next: Toast[]) => void>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function emit() {
  listeners.forEach((listener) => listener(toasts))
}

export function dismissToast(id: string) {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function toast({
  title,
  description,
  variant = 'default',
  action,
}: {
  title?: string
  description?: string
  variant?: ToastVariant
  action?: React.ReactNode
}) {
  const id = Math.random().toString(36).slice(2, 11)

  toasts = [...toasts, { id, title, description, variant, action }].slice(-MAX_VISIBLE)
  emit()

  timers.set(
    id,
    setTimeout(() => dismissToast(id), AUTO_DISMISS_MS)
  )

  return { id, dismiss: () => dismissToast(id) }
}

export function useToast() {
  const [current, setCurrent] = useState<Toast[]>(toasts)

  useEffect(() => {
    listeners.add(setCurrent)
    setCurrent(toasts)
    return () => {
      listeners.delete(setCurrent)
    }
  }, [])

  return { toasts: current, toast, dismiss: dismissToast }
}
