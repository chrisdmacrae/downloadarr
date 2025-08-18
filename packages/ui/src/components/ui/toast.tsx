import * as React from "react"

// Simplified toast components for now
export const ToastProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>
export const Toast = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className="fixed top-4 right-4 bg-card border rounded-lg p-4 shadow-lg" {...props}>
    {children}
  </div>
)
export const ToastTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="font-semibold">{children}</div>
)
export const ToastDescription = ({ children }: { children: React.ReactNode }) => (
  <div className="text-sm text-muted-foreground">{children}</div>
)
export const ToastClose = () => <button className="ml-auto">×</button>
export const ToastViewport = () => null
