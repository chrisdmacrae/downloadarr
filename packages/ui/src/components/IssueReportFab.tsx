import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { IssueReportForm } from '@/components/IssueReportForm'
import { MessageSquare, Bug, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IssueReportFabProps {
  className?: string
}

export function IssueReportFab({ className }: IssueReportFabProps) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleMainButtonClick = () => {
    if (isExpanded) {
      setIsExpanded(false)
    } else {
      setIsExpanded(true)
    }
  }

  const handleBugReportClick = () => {
    setIsFormOpen(true)
    setIsExpanded(false)
  }

  const handleFeatureRequestClick = () => {
    setIsFormOpen(true)
    setIsExpanded(false)
  }

  return (
    <>
      <div
        className={cn(
          'fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3',
          className
        )}
      >
        {/* Expanded options */}
        {isExpanded && (
          <div className="flex animate-fade-up flex-col gap-2">
            <Button onClick={handleBugReportClick} size="sm" variant="glass" className="shadow-3">
              <Bug className="h-4 w-4" />
              Report a bug
            </Button>
            <Button
              onClick={handleFeatureRequestClick}
              size="sm"
              variant="glass"
              className="shadow-3"
            >
              <Lightbulb className="h-4 w-4" />
              Request a feature
            </Button>
          </div>
        )}

        {/* The FAB is glass — one of the three places blur is used. */}
        <button
          type="button"
          onClick={handleMainButtonClick}
          aria-label="Report an issue or request a feature"
          aria-expanded={isExpanded}
          className={cn(
            'glass inline-flex h-12 w-12 items-center justify-center rounded-pill border border-strong text-fg-primary shadow-3',
            'transition-[background-color,transform] duration-fast ease-standard hover:-translate-y-px hover:bg-white/[.14] active:scale-[.98]',
            'focus-visible:outline-none focus-visible:shadow-focus',
            isExpanded && 'rotate-45'
          )}
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      </div>

      {/* Backdrop to close expanded menu */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsExpanded(false)}
          aria-hidden="true"
        />
      )}

      {/* Issue Report Form */}
      <IssueReportForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
      />
    </>
  )
}
