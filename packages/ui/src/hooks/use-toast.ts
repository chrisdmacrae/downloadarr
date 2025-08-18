import { useState } from 'react'

interface Toast {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = ({ title, description }: { title?: string; description?: string }) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast = { id, title, description }
    
    setToasts(prev => [...prev, newToast])
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }

  return { toasts, toast }
}
