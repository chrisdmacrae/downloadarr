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
      <div className={cn(
        "fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-3",
        className
      )}>
        {/* Expanded Options */}
        {isExpanded && (
          <div className="flex flex-col space-y-2 animate-in slide-in-from-bottom-2 duration-200">
            <Button
              onClick={handleBugReportClick}
              size="sm"
              variant="secondary"
              className="flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <Bug className="h-4 w-4" />
              Report Bug
            </Button>
            <Button
              onClick={handleFeatureRequestClick}
              size="sm"
              variant="secondary"
              className="flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <Lightbulb className="h-4 w-4" />
              Request Feature
            </Button>
          </div>
        )}

        {/* Main FAB */}
        <Button
          onClick={handleMainButtonClick}
          size="icon"
          className={cn(
            "h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200",
            isExpanded && "rotate-45"
          )}
          aria-label="Report an issue or request a feature"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
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
