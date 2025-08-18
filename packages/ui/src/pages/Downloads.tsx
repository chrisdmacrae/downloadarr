import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play, Pause, X, MoreHorizontal } from 'lucide-react'

export default function Downloads() {
  const downloads = [
    {
      id: '1',
      name: 'The Matrix (1999) [1080p]',
      type: 'movie',
      status: 'downloading',
      progress: 65,
      size: '2.1GB',
      speed: '5.2 MB/s',
      eta: '8 min',
    },
    {
      id: '2',
      name: 'Super Mario Bros (NES)',
      type: 'rom',
      status: 'downloading',
      progress: 100,
      size: '32KB',
      speed: '0 MB/s',
      eta: 'Complete',
    },
    {
      id: '3',
      name: 'Breaking Bad S01E01',
      type: 'tv',
      status: 'queued',
      progress: 0,
      size: '1.4GB',
      speed: '0 MB/s',
      eta: 'Queued',
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'downloading': return 'bg-blue-500'
      case 'completed': return 'bg-green-500'
      case 'queued': return 'bg-yellow-500'
      case 'paused': return 'bg-gray-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Downloads</h1>
          <p className="text-muted-foreground">
            Manage your active and queued downloads
          </p>
        </div>
        <Button>Add Download</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Downloads</CardTitle>
          <CardDescription>
            Currently downloading and queued items
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {downloads.map((download) => (
              <div key={download.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(download.status)}`}></div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{download.name}</p>
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                    <span>{download.size}</span>
                    <span>{download.speed}</span>
                    <span>ETA: {download.eta}</span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-secondary rounded-full h-2 mt-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${download.progress}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {download.progress}% complete
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {download.status === 'downloading' && (
                    <Button variant="outline" size="icon">
                      <Pause className="h-4 w-4" />
                    </Button>
                  )}
                  {download.status === 'paused' && (
                    <Button variant="outline" size="icon">
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="outline" size="icon">
                    <X className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
