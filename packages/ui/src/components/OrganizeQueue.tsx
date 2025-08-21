import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Folder, Film, Tv, Gamepad2, Check, X, Trash2 } from 'lucide-react'

import { useToast } from '@/hooks/use-toast'
import { 
  useOrganizeQueue, 
  useProcessOrganizeQueueItem, 
  useSkipOrganizeQueueItem, 
  useDeleteOrganizeQueueItem,
  useGamePlatformOptions 
} from '@/hooks/useApi'
import type { OrganizeQueueItem } from '@/services/api'

interface ProcessDialogData {
  selectedTmdbId?: string;
  selectedIgdbId?: string;
  selectedTitle?: string;
  selectedYear?: number;
  selectedPlatform?: string;
}

export function OrganizeQueue() {
  const { toast } = useToast()
  const { data: queueData, isLoading } = useOrganizeQueue()
  const { data: platformOptions } = useGamePlatformOptions(false)
  const processItem = useProcessOrganizeQueueItem()
  const skipItem = useSkipOrganizeQueueItem()
  const deleteItem = useDeleteOrganizeQueueItem()

  const [selectedItem, setSelectedItem] = useState<OrganizeQueueItem | null>(null)
  const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false)
  const [processData, setProcessData] = useState<ProcessDialogData>({})

  const getContentTypeIcon = (contentType: string) => {
    switch (contentType) {
      case 'MOVIE': return Film
      case 'TV_SHOW': return Tv
      case 'GAME': return Gamepad2
      default: return Folder
    }
  }

  const getContentTypeColor = (contentType: string) => {
    switch (contentType) {
      case 'MOVIE': return 'bg-blue-100 text-blue-800'
      case 'TV_SHOW': return 'bg-green-100 text-green-800'
      case 'GAME': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'PROCESSING': return 'bg-blue-100 text-blue-800'
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'FAILED': return 'bg-red-100 text-red-800'
      case 'SKIPPED': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleProcessItem = (item: OrganizeQueueItem) => {
    setSelectedItem(item)
    setProcessData({
      selectedTitle: item.detectedTitle,
      selectedYear: item.detectedYear,
      selectedPlatform: item.detectedPlatform,
    })
    setIsProcessDialogOpen(true)
  }

  const handleSaveProcess = async () => {
    if (!selectedItem) return

    try {
      await processItem.mutateAsync({
        id: selectedItem.id,
        data: processData
      })
      toast({
        title: "Item processed",
        description: "The folder has been processed and organized successfully.",
      })
      setIsProcessDialogOpen(false)
      setSelectedItem(null)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process item. Please try again.",
      })
    }
  }

  const handleSkipItem = async (item: OrganizeQueueItem) => {
    try {
      await skipItem.mutateAsync(item.id)
      toast({
        title: "Item skipped",
        description: "The folder has been marked as skipped.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to skip item. Please try again.",
      })
    }
  }

  const handleDeleteItem = async (item: OrganizeQueueItem) => {
    try {
      await deleteItem.mutateAsync(item.id)
      toast({
        title: "Item deleted",
        description: "The folder has been removed from the queue.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete item. Please try again.",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const items = queueData?.items || []

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Folder className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No items in organize queue</h3>
          <p className="text-muted-foreground text-center">
            Folders that need manual organization will appear here after reverse indexing.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const Icon = getContentTypeIcon(item.contentType)
        
        return (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <Badge className={getContentTypeColor(item.contentType)}>
                    <Icon className="w-3 h-3 mr-1" />
                    {item.contentType.replace('_', ' ')}
                  </Badge>
                  <Badge className={getStatusColor(item.status)} variant="outline">
                    {item.status}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {item.status === 'PENDING' && (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => handleProcessItem(item)}
                        disabled={processItem.isPending}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Process
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleSkipItem(item)}
                        disabled={skipItem.isPending}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Skip
                      </Button>
                    </>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleDeleteItem(item)}
                    disabled={deleteItem.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Folder Path:</label>
                <code className="block mt-1 p-2 bg-muted rounded text-sm break-all">
                  {item.folderPath}
                </code>
              </div>
              
              {item.detectedTitle && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Title:</span> {item.detectedTitle}
                  </div>
                  {item.detectedYear && (
                    <div>
                      <span className="font-medium">Year:</span> {item.detectedYear}
                    </div>
                  )}
                  {item.detectedSeason && (
                    <div>
                      <span className="font-medium">Season:</span> {item.detectedSeason}
                    </div>
                  )}
                  {item.detectedPlatform && (
                    <div>
                      <span className="font-medium">Platform:</span> {item.detectedPlatform}
                    </div>
                  )}
                </div>
              )}
              
              <div className="text-xs text-muted-foreground">
                Created: {new Date(item.createdAt).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Process Dialog */}
      <Dialog open={isProcessDialogOpen} onOpenChange={setIsProcessDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Process Organize Queue Item</DialogTitle>
            <DialogDescription>
              Review and confirm the metadata for this folder before organizing it.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4">
              <div>
                <Label>Folder Path</Label>
                <code className="block mt-1 p-2 bg-muted rounded text-sm break-all">
                  {selectedItem.folderPath}
                </code>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={processData.selectedTitle || ''}
                  onChange={(e) => setProcessData(prev => ({ ...prev, selectedTitle: e.target.value }))}
                  placeholder="Enter the correct title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={processData.selectedYear || ''}
                  onChange={(e) => setProcessData(prev => ({ ...prev, selectedYear: parseInt(e.target.value) || undefined }))}
                  placeholder="Enter the release year"
                />
              </div>

              {selectedItem.contentType === 'GAME' && (
                <div className="space-y-2">
                  <Label htmlFor="platform">Platform</Label>
                  <Select
                    value={processData.selectedPlatform || ''}
                    onValueChange={(value) => setProcessData(prev => ({ ...prev, selectedPlatform: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {platformOptions?.data?.map((platform: { value: string; label: string }) => (
                        <SelectItem key={platform.value} value={platform.value}>
                          {platform.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProcessDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveProcess}
              disabled={processItem.isPending || !processData.selectedTitle}
            >
              {processItem.isPending ? 'Processing...' : 'Process Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
