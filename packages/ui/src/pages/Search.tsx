import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search as SearchIcon, Download, Loader2, AlertCircle } from 'lucide-react'
import { apiService, SearchResult } from '@/services/api'
import { useToast } from '@/hooks/use-toast'

export default function Search() {
  const [activeTab, setActiveTab] = useState<'movies' | 'tv' | 'games'>('movies')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // Load popular content when tab changes
  useEffect(() => {
    loadPopularContent()
  }, [activeTab])

  const loadPopularContent = async () => {
    if (searchQuery) return // Don't load popular if there's a search query

    setIsLoading(true)
    setError(null)

    try {
      let response
      switch (activeTab) {
        case 'movies':
          response = await apiService.getPopularMovies(1)
          break
        case 'tv':
          response = await apiService.getPopularTvShows(1)
          break
        case 'games':
          response = await apiService.getPopularGames(20)
          break
        default:
          setSearchResults([])
          setIsLoading(false)
          return
      }

      if (response.success && response.data) {
        setSearchResults(response.data)
      } else {
        setError(response.error || 'Failed to load content')
      }
    } catch (err) {
      setError('Failed to load content')
      console.error('Error loading popular content:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Search query required",
        description: "Please enter a search term",
      })
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      let response
      switch (activeTab) {
        case 'movies':
          response = await apiService.searchMovies(searchQuery)
          break
        case 'tv':
          response = await apiService.searchTvShows(searchQuery)
          break
        case 'games':
          response = await apiService.searchGames(searchQuery)
          break
      }

      if (response.success && response.data) {
        setSearchResults(response.data)
        if (response.data.length === 0) {
          toast({
            title: "No results found",
            description: `No ${activeTab} found for "${searchQuery}"`,
          })
        }
      } else {
        setError(response.error || 'Search failed')
        toast({
          title: "Search failed",
          description: response.error || 'An error occurred while searching',
        })
      }
    } catch (err) {
      setError('Search failed')
      toast({
        title: "Search failed",
        description: 'An error occurred while searching',
      })
      console.error('Search error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const tabs = [
    { id: 'movies' as const, label: 'Movies' },
    { id: 'tv' as const, label: 'TV Shows' },
    { id: 'games' as const, label: 'Games' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Search</h1>
        <p className="text-muted-foreground">
          Discover and download movies, TV shows, and ROMs
        </p>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={`Search for ${activeTab === 'games' ? 'games' : activeTab === 'tv' ? 'TV shows' : 'movies'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Search'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setSearchQuery('')
              setSearchResults([])
              setError(null)
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      {/* Search Results */}
      {!isLoading && !error && (
        <>
          {searchResults.length === 0 && searchQuery && (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <SearchIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No results found for "{searchQuery}"</p>
              </CardContent>
            </Card>
          )}

          {searchResults.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {searchResults.map((item) => (
                <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-[2/3] bg-muted relative">
                    {item.poster ? (
                      <img
                        src={item.poster}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          target.nextElementSibling?.classList.remove('hidden')
                        }}
                      />
                    ) : null}
                    <div className={`absolute inset-0 flex items-center justify-center text-muted-foreground ${item.poster ? 'hidden' : ''}`}>
                      No Image
                    </div>
                    <Badge className="absolute top-2 right-2 capitalize">
                      {item.type === 'game' ? 'Game' : item.type === 'tv' ? 'TV' : 'Movie'}
                    </Badge>
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg line-clamp-2" title={item.title}>
                      {item.title}
                    </CardTitle>
                    <CardDescription className="flex items-center justify-between">
                      <span>{item.year || 'Unknown'}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {item.overview && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                        {item.overview}
                      </p>
                    )}
                    <Button className="w-full" size="sm" variant="outline">
                      <Download className="h-3 w-3 mr-1" />
                      Find Downloads
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
