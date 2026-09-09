import { useState, type ReactNode } from 'react'

import { TopNav } from '@/components/ds/TopNav'
import { SubnavProvider } from '@/components/ds/Subnav'
import { IssueReportFab } from '@/components/IssueReportFab'
import { UpdateCard } from '@/components/UpdateCard'
import { HttpDownloadRequestModal } from '@/components/HttpDownloadRequestModal'

interface LayoutProps {
  children: ReactNode
}

/**
 * The app chrome: a sticky glass top bar with artwork running full width
 * beneath it, the update notice, the report FAB and the toast stack. Pages
 * publish their context filters into the nav's second row via `useSubnav`.
 */
export default function Layout({ children }: LayoutProps) {
  const [addUrlOpen, setAddUrlOpen] = useState(false)
  const [subnav, setSubnav] = useState<ReactNode>(null)

  return (
    <SubnavProvider value={setSubnav}>
      <div className="flex min-h-screen flex-col bg-surface-app">
        <TopNav subnav={subnav} onAddUrl={() => setAddUrlOpen(true)} />

        <main className="flex-1">{children}</main>

        {/* Available-update notice, above the report FAB. */}
        <UpdateCard />
        <IssueReportFab />

        <HttpDownloadRequestModal open={addUrlOpen} onOpenChange={setAddUrlOpen} />
      </div>
    </SubnavProvider>
  )
}
