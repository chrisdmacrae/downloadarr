import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Clock,
  Search,
  CheckCircle,
  Download,
  AlertCircle,
  XCircle,
  Timer
} from 'lucide-react'
import { TorrentRequest } from '@/services/api'
import { useDownloadStatus } from '@/hooks/useDownloadStatus'

interface DownloadStatusBadgeProps {
  request: TorrentRequest | undefined
  className?: string
}

// Utility function to format file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function DownloadStatusBadge({ request, className }: DownloadStatusBadgeProps) {
  if (!request) return null

  // Get live download status for downloading requests
  const { downloadStatus } = useDownloadStatus(
    request.status === 'DOWNLOADING' ? request.id : undefined
  )

  const getStatusConfig = (status: TorrentRequest['status']) => {
    switch (status) {
      case 'PENDING':
        return {
          icon: Clock,
          label: 'Pending',
          variant: 'secondary' as const,
          color: 'text-yellow-600',
        }
      case 'SEARCHING':
        return {
          icon: Search,
          label: 'Searching',
          variant: 'secondary' as const,
          color: 'text-blue-600',
        }
      case 'FOUND':
        return {
          icon: CheckCircle,
          label: 'Found',
          variant: 'default' as const,
          color: 'text-green-600',
        }
      case 'DOWNLOADING':
        return {
          icon: Download,
          label: 'Downloading',
          variant: 'default' as const,
          color: 'text-blue-600',
        }
      case 'COMPLETED':
        return {
          icon: CheckCircle,
          label: 'Completed',
          variant: 'default' as const,
          color: 'text-green-600',
        }
      case 'FAILED':
        return {
          icon: AlertCircle,
          label: 'Failed',
          variant: 'destructive' as const,
          color: 'text-red-600',
        }
      case 'CANCELLED':
        return {
          icon: XCircle,
          label: 'Cancelled',
          variant: 'secondary' as const,
          color: 'text-gray-600',
        }
      case 'EXPIRED':
        return {
          icon: Timer,
          label: 'Expired',
          variant: 'secondary' as const,
          color: 'text-gray-600',
        }
      default:
        return {
          icon: Clock,
          label: 'Unknown',
          variant: 'secondary' as const,
          color: 'text-gray-600',
        }
    }
  }

  const config = getStatusConfig(request.status)
  const Icon = config.icon

  return (
    <div className={`space-y-1 ${className}`}>
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
      
      {request.status === 'DOWNLOADING' && downloadStatus && (
        <div className="space-y-1">
          <Progress value={downloadStatus.progress} className="h-1" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{downloadStatus.progress.toFixed(1)}%</span>
            <span>{downloadStatus.downloadSpeed}</span>
          </div>
          {downloadStatus.eta && downloadStatus.eta !== '∞' && (
            <div className="text-xs text-muted-foreground">
              ETA: {downloadStatus.eta}
            </div>
          )}
          {downloadStatus.totalSize > 0 && (
            <div className="text-xs text-muted-foreground">
              {formatFileSize(downloadStatus.completedSize)} / {formatFileSize(downloadStatus.totalSize)}
            </div>
          )}
        </div>
      )}
      
      {request.status === 'SEARCHING' && (
        <div className="text-xs text-muted-foreground">
          Attempt {request.searchAttempts} of {request.maxSearchAttempts}
        </div>
      )}
      
      {request.status === 'FOUND' && request.foundTorrentTitle && (
        <div className="text-xs text-muted-foreground line-clamp-1" title={request.foundTorrentTitle}>
          Found: {request.foundTorrentTitle}
        </div>
      )}
    </div>
  )
}
