import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play, Pause, X, Loader2 } from 'lucide-react'
import { useDownloads, usePauseDownload, useResumeDownload, useCancelDownload } from '@/hooks/useApi'
import { useToast } from '@/hooks/use-toast'

export default function Downloads() {
  const { data: downloads, isLoading, error } = useDownloads()
  const { toast } = useToast()

  const pauseDownloadMutation = usePauseDownload()
  const resumeDownloadMutation = useResumeDownload()
  const cancelDownloadMutation = useCancelDownload()

  const handlePauseDownload = async (id: string) => {
    try {
      await pauseDownloadMutation.mutateAsync(id)
      toast({
        title: "Download Paused",
        description: "The download has been paused successfully.",
      })
    } catch (error) {
      toast({
        title: "Failed to Pause",
        description: "Could not pause the download. Please try again.",
      })
    }
  }

  const handleResumeDownload = async (id: string) => {
    try {
      await resumeDownloadMutation.mutateAsync(id)
      toast({
        title: "Download Resumed",
        description: "The download has been resumed successfully.",
      })
    } catch (error) {
      toast({
        title: "Failed to Resume",
        description: "Could not resume the download. Please try again.",
      })
    }
  }

  const handleCancelDownload = async (id: string) => {
    try {
      await cancelDownloadMutation.mutateAsync(id)
      toast({
        title: "Download Cancelled",
        description: "The download has been cancelled successfully.",
      })
    } catch (error) {
      toast({
        title: "Failed to Cancel",
        description: "Could not cancel the download. Please try again.",
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-500'
      case 'downloading': return 'bg-blue-500'
      case 'complete': return 'bg-green-500'
      case 'completed': return 'bg-green-500'
      case 'waiting': return 'bg-yellow-500'
      case 'queued': return 'bg-yellow-500'
      case 'paused': return 'bg-gray-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Downloading'
      case 'complete': return 'Complete'
      case 'waiting': return 'Queued'
      case 'paused': return 'Paused'
      case 'error': return 'Error'
      default: return status
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDownloadSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond === 0) return '0 MB/s'
    const mbps = bytesPerSecond / (1024 * 1024)
    return mbps.toFixed(2) + ' MB/s'
  }

  const getETA = (download: any) => {
    if (download.status === 'complete') return 'Complete'
    if (download.status === 'waiting') return 'Queued'
    if (download.status === 'paused') return 'Paused'
    if (download.status === 'error') return 'Error'

    // Calculate ETA based on download speed and remaining bytes
    if (download.downloadSpeed > 0) {
      const remainingBytes = download.totalSize - download.completedSize
      const etaSeconds = remainingBytes / download.downloadSpeed

      if (etaSeconds < 60) return `${Math.round(etaSeconds)}s`
      if (etaSeconds < 3600) return `${Math.round(etaSeconds / 60)}m`
      return `${Math.round(etaSeconds / 3600)}h`
    }

    return 'Calculating...'
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Downloads</h1>
            <p className="text-muted-foreground">
              Manage your active and queued downloads
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              <p>Failed to load downloads. Please check if the download service is running.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Downloads</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage your active and queued downloads
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading downloads...</span>
        </div>
      ) : !downloads || downloads.length === 0 ? (
        <div className="text-center text-muted-foreground p-8">
          <p>No downloads found. Start downloading something to see it here!</p>
        </div>
      ) : (
            <div className="space-y-3 md:space-y-4">
              {downloads.map((download) => (
                <div key={download.id} className="border rounded-lg p-3 md:p-4">
                  <div className="flex gap-3">
                    {/* Main content */}
                    <div className="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
                      <div className={`w-3 h-3 rounded-full mt-0.5 flex-shrink-0 ${getStatusColor(download.status)}`}></div>
                      <div className="flex-1 min-w-0">
                        {/* Title and metadata */}
                        <div className="flex items-start justify-between gap-2 mb-2 md:mb-0">
                          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 flex-1">
                            <p className="text-sm md:text-base font-medium line-clamp-2 md:line-clamp-1">
                              {download.mediaTitle || download.name}
                            </p>
                            <div className="flex items-center gap-2">
                              {download.mediaYear && (
                                <span className="text-xs text-muted-foreground">({download.mediaYear})</span>
                              )}
                              {download.mediaType && (
                                <span className="text-xs bg-secondary px-2 py-1 rounded">
                                  {download.mediaType.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Mobile: Action buttons on top right */}
                          <div className="flex items-center gap-1 md:hidden">
                            {download.status === 'active' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePauseDownload(download.id)}
                                disabled={pauseDownloadMutation.isPending}
                              >
                                {pauseDownloadMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Pause className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                            {download.status === 'paused' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResumeDownload(download.id)}
                                disabled={resumeDownloadMutation.isPending}
                              >
                                {resumeDownloadMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancelDownload(download.id)}
                              disabled={cancelDownloadMutation.isPending}
                            >
                              {cancelDownloadMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Download metadata */}
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs text-muted-foreground mb-2">
                          <span>{formatFileSize(download.totalSize)}</span>
                          <span>{formatDownloadSpeed(download.downloadSpeed)}</span>
                          <span className="hidden md:inline">Status: {getStatusText(download.status)}</span>
                          <span>ETA: {getETA(download)}</span>
                          <span className="hidden md:inline">{download.files.length} files</span>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-secondary rounded-full h-2 mb-1">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${download.progress}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {download.progress}% complete ({formatFileSize(download.completedSize)} / {formatFileSize(download.totalSize)})
                        </div>
                      </div>
                    </div>

                    {/* Desktop: Action buttons on the right */}
                    <div className="hidden md:flex items-center gap-2">
                      {download.status === 'active' && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handlePauseDownload(download.id)}
                          disabled={pauseDownloadMutation.isPending}
                        >
                          {pauseDownloadMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Pause className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      {download.status === 'paused' && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleResumeDownload(download.id)}
                          disabled={resumeDownloadMutation.isPending}
                        >
                          {resumeDownloadMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleCancelDownload(download.id)}
                        disabled={cancelDownloadMutation.isPending}
                      >
                        {cancelDownloadMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>


                </div>
              ))}
        </div>
      )}
    </div>
  )
}
