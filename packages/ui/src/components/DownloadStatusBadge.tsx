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

interface DownloadStatusBadgeProps {
  request: TorrentRequest | undefined
  className?: string
}

export function DownloadStatusBadge({ request, className }: DownloadStatusBadgeProps) {
  if (!request) return null

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
      
      {request.status === 'DOWNLOADING' && request.downloadProgress !== null && (
        <div className="space-y-1">
          <Progress value={request.downloadProgress} className="h-1" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{request.downloadProgress?.toFixed(1)}%</span>
            {request.downloadSpeed && <span>{request.downloadSpeed}</span>}
          </div>
          {request.downloadEta && (
            <div className="text-xs text-muted-foreground">
              ETA: {request.downloadEta}
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
