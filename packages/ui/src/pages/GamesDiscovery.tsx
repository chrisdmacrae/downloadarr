import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MovieCarousel } from '@/components/MovieCarousel'
import { MovieCard } from '@/components/MovieCard'
import { GameDetailModal } from '@/components/GameDetailModal'
import { SearchResult, apiService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search as SearchIcon } from 'lucide-react'

interface Platform {
  name: string
  id: number
}

export default function GamesDiscovery() {
  const [featuredGames, setFeaturedGames] = useState<SearchResult[]>([])
  const [popularGames, setPopularGames] = useState<SearchResult[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [platformGames, setPlatformGames] = useState<Record<string, SearchResult[]>>({})
  const [selectedGame, setSelectedGame] = useState<SearchResult | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const { toast } = useToast()
  const navigate = useNavigate()

  // Target platforms from the spec
  const targetPlatforms = [
    'NES', 'SNES', 'N64', 'GameCube', 'Wii', 'Wii U',
    'Game Boy', 'Game Boy Color', 'Game Boy Advance', 'Switch',
    'Genesis', 'Saturn', 'Dreamcast',
    'PlayStation', 'PlayStation 2', 'PlayStation 3',
    'Xbox', 'Xbox 360'
  ]

  useEffect(() => {
    loadDiscoveryData()
  }, [])

  const loadDiscoveryData = async () => {
    setIsLoading(true)
    try {
      // Load popular games first
      const popularResponse = await apiService.getPopularGames(25)
      if (popularResponse.success && popularResponse.data) {
        const games = popularResponse.data
        setFeaturedGames(games.slice(0, 5)) // Top 5 for featured
        setPopularGames(games.slice(5)) // Rest for carousel
      }

      // Load supported platforms
      const platformsResponse = await apiService.getSupportedPlatforms()
      if (platformsResponse.success && platformsResponse.data) {
        // Filter to only include the platforms we want and in the order we want
        const filteredPlatforms = targetPlatforms
          .map(targetName => platformsResponse.data!.find(p => p.name === targetName))
          .filter(Boolean) as Platform[]
        
        setPlatforms(filteredPlatforms)

        // Load games for each platform
        const platformGamesData: Record<string, SearchResult[]> = {}
        for (const platform of filteredPlatforms) {
          try {
            const platformResponse = await apiService.getGamesByPlatform(platform.name, 20)
            if (platformResponse.success && platformResponse.data) {
              platformGamesData[platform.name] = platformResponse.data.slice(0, 20) // Limit to 20 per platform
            }
          } catch (error) {
            console.error(`Failed to load games for platform ${platform.name}:`, error)
          }
        }
        setPlatformGames(platformGamesData)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load games discovery data",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGameClick = (game: SearchResult) => {
    setSelectedGame(game)
    setIsModalOpen(true)
  }

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}&tab=games`)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8 p-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Discover Games</h1>
          <p className="text-muted-foreground">Find your next gaming adventure</p>
        </div>

        {/* Featured Section Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>

        {/* Carousels Skeleton */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="flex space-x-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="flex-shrink-0 w-48 space-y-2">
                  <Skeleton className="aspect-[2/3] w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Discover Games</h1>
        <p className="text-muted-foreground">Find your next gaming adventure</p>
      </div>

      {/* Search Bar */}
      <div className="max-w-2xl">
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyPress}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={!searchQuery.trim()}>
            Search
          </Button>
        </div>
      </div>

      {/* Featured Section */}
      {featuredGames.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Featured</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {featuredGames.map((game) => (
              <MovieCard
                key={game.id}
                movie={game}
                onClick={handleGameClick}
                size="medium"
                showOverview={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Popular Games Carousel */}
      {popularGames.length > 0 && (
        <MovieCarousel
          title="Popular Games"
          movies={popularGames}
          onMovieClick={handleGameClick}
          cardSize="medium"
        />
      )}

      {/* Platform Carousels */}
      {platforms.map((platform) => {
        const games = platformGames[platform.name]
        if (!games || games.length === 0) return null

        return (
          <MovieCarousel
            key={platform.name}
            title={platform.name}
            movies={games}
            onMovieClick={handleGameClick}
            cardSize="medium"
          />
        )
      })}

      {/* Game Detail Modal */}
      <GameDetailModal
        game={selectedGame}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </div>
  )
}
