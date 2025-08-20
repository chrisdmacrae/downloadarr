import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useOnboardingStatus } from '@/hooks/useOnboarding'
import { Skeleton } from '@/components/ui/skeleton'

interface OnboardingGuardProps {
  children: React.ReactNode
}

export default function OnboardingGuard({ children }: OnboardingGuardProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: onboardingStatus, isLoading, error } = useOnboardingStatus()

  useEffect(() => {
    // Don't redirect if we're already on the onboarding page
    if (location.pathname === '/onboarding') {
      return
    }

    // Don't redirect if still loading or if there's an error
    if (isLoading || error) {
      return
    }

    // Redirect to onboarding if not completed
    if (onboardingStatus && !onboardingStatus.completed) {
      navigate('/onboarding', { replace: true })
    }
  }, [onboardingStatus, isLoading, error, location.pathname, navigate])

  // Show loading skeleton while checking onboarding status
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  // Show error state if there's an error checking onboarding status
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Connection Error</h1>
          <p className="text-muted-foreground mb-4">
            Unable to connect to the Downloadarr API. Please check that the server is running.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // If onboarding is completed or we're on the onboarding page, render children
  return <>{children}</>
}
