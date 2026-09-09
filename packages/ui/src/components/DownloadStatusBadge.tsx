import { StatusBadge } from '@/components/ds/StatusBadge'
import { Progress } from '@/components/ui/progress'
import { TorrentRequest } from '@/services/api'
import { useDownloadStatus } from '@/hooks/useDownloadStatus'
import { cn } from '@/lib/utils'
import { formatFileSize, formatPercent, statusTone } from '@/lib/status'

interface DownloadStatusBadgeProps {
  request: TorrentRequest | undefined
  className?: string
  variant?: 'default' | 'compact'
}

/**
 * A request's status pill plus its live transfer telemetry. Status colour is
 * monochrome — value on the ink ramp, never hue — and the label always rides
 * with the dot.
 */
export function DownloadStatusBadge({
  request,
  className,
  variant = 'default',
}: DownloadStatusBadgeProps) {
  // Hooks must run unconditionally; the id is undefined when there is nothing
  // to poll, which the hook already treats as a no-op.
  const { downloadStatus } = useDownloadStatus(
    request?.status === 'DOWNLOADING' ? request.id : undefined
  )

  if (!request) return null

  const tone = statusTone(request.status)
  const isDownloading = request.status === 'DOWNLOADING' && downloadStatus

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <StatusBadge status={request.status} size={variant === 'compact' ? 'sm' : 'default'} />

      {isDownloading && (
        <Progress
          value={downloadStatus.progress}
          className="h-[3px]"
          indicatorColor={tone.color}
          striped
        />
      )}

      {variant === 'default' && isDownloading && (
        <div className="flex flex-col gap-0.5 font-mono text-xs text-fg-muted">
          <div className="flex justify-between gap-3">
            <span>{formatPercent(downloadStatus.progress)}</span>
            <span>{downloadStatus.downloadSpeed}</span>
          </div>
          {downloadStatus.eta && downloadStatus.eta !== '∞' && <span>ETA {downloadStatus.eta}</span>}
          {downloadStatus.totalSize > 0 && (
            <span>
              {formatFileSize(downloadStatus.completedSize)} /{' '}
              {formatFileSize(downloadStatus.totalSize)}
            </span>
          )}
        </div>
      )}

      {variant === 'default' && request.status === 'SEARCHING' && (
        <span className="font-mono text-xs text-fg-muted">
          Attempt {request.searchAttempts} of {request.maxSearchAttempts}
        </span>
      )}

      {variant === 'default' && request.status === 'FOUND' && request.foundTorrentTitle && (
        <span
          className="line-clamp-1 break-all font-mono text-xs text-fg-muted"
          title={request.foundTorrentTitle}
        >
          {request.foundTorrentTitle}
        </span>
      )}
    </div>
  )
}
