import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SearchResultCarousel } from '@/components/SearchResultCarousel'
import { SearchResultCard } from '@/components/SearchResultCard'
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

interface Genre {
  name: string
}

export default function GamesDiscovery() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<'pc' | 'rom'>('pc')
  const [featuredGames, setFeaturedGames] = useState<SearchResult[]>([])
  const [popularGames, setPopularGames] = useState<SearchResult[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [platformGames, setPlatformGames] = useState<Record<string, SearchResult[]>>({})
  const [pcGenres, setPcGenres] = useState<Genre[]>([])
  const [pcGenreGames, setPcGenreGames] = useState<Record<string, SearchResult[]>>({})
  const [selectedGame, setSelectedGame] = useState<SearchResult | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const { toast } = useToast()
  const navigate = useNavigate()

  // Target platforms from the spec (for ROM tab)
  const targetPlatforms = [
    'NES', 'SNES', 'N64', 'GameCube', 'Wii', 'Wii U',
    'Game Boy', 'Game Boy Color', 'Game Boy Advance', 'Switch',
    'Genesis', 'Saturn', 'Dreamcast',
    'PlayStation', 'PlayStation 2', 'PlayStation 3',
    'Xbox', 'Xbox 360'
  ]

  // PC game genres
  const pcGameGenres = [
    'Action', 'Adventure', 'Strategy', 'RPG', 'Shooter',
    'Simulation', 'Sports', 'Racing', 'Puzzle', 'Indie'
  ]

  // Handle tab changes
  const handleTabChange = (tab: 'pc' | 'rom') => {
    setActiveTab(tab)
    const newParams = new URLSearchParams(searchParams)
    newParams.set('tab', tab)
    setSearchParams(newParams)
  }

  // Initialize from URL parameters
  useEffect(() => {
    const tab = searchParams.get('tab') as 'pc' | 'rom'
    if (tab && ['pc', 'rom'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  useEffect(() => {
    loadDiscoveryData()
  }, [activeTab])

  const loadDiscoveryData = async () => {
    setIsLoading(true)
    try {
      if (activeTab === 'pc') {
        // Load PC games by genre
        // Get PC games from the first genre for featured/popular
        const firstGenreResponse = await apiService.getPcGamesByGenre(pcGameGenres[0], 25)
        if (firstGenreResponse.success && firstGenreResponse.data) {
          const games = firstGenreResponse.data
          setFeaturedGames(games.slice(0, 5)) // Top 5 for featured
          setPopularGames(games.slice(5)) // Rest for carousel
        }

        // Set up PC genres
        const genres = pcGameGenres.map(name => ({ name }))
        setPcGenres(genres)

        // Load games for each PC genre
        const genreGamesData: Record<string, SearchResult[]> = {}
        for (const genreName of pcGameGenres) {
          try {
            const genreResponse = await apiService.getPcGamesByGenre(genreName, 20)
            if (genreResponse.success && genreResponse.data) {
              genreGamesData[genreName] = genreResponse.data.slice(0, 20) // Limit to 20 per genre
            }
          } catch (error) {
            console.error(`Failed to load PC games for genre ${genreName}:`, error)
          }
        }
        setPcGenreGames(genreGamesData)

        // Clear platform data for PC tab
        setPlatforms([])
        setPlatformGames({})
      } else {
        // ROM tab - load platform-based games
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

        // Clear PC genre data for ROM tab
        setPcGenres([])
        setPcGenreGames({})
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

  const tabs = [
    { id: 'pc' as const, label: 'PC' },
    { id: 'rom' as const, label: 'ROM' },
  ]

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Discover Games</h1>
          <p className="text-muted-foreground">Find your next gaming adventure</p>
        </div>

        {/* Search Bar Skeleton */}
        <div className="max-w-2xl">
          <div className="flex space-x-2">
            <Skeleton className="flex-1 h-10" />
            <Skeleton className="h-10 w-20" />
          </div>
        </div>

        {/* Tabs Skeleton */}
        <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
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
    <div className="space-y-4 md:space-y-8">
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

      {/* Tabs */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
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

      {/* Featured Section */}
      {featuredGames.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Featured</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {featuredGames.map((game) => (
              <SearchResultCard
                key={game.id}
                item={game}
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
        <SearchResultCarousel
          title={activeTab === 'pc' ? 'Popular PC Games' : 'Popular Games'}
          items={popularGames}
          onItemClick={handleGameClick}
          cardSize="medium"
        />
      )}

      {/* PC Genre Carousels - Only show for PC tab */}
      {activeTab === 'pc' && pcGenres.map((genre) => {
        const games = pcGenreGames[genre.name]
        if (!games || games.length === 0) return null

        return (
          <SearchResultCarousel
            key={genre.name}
            title={genre.name}
            items={games}
            onItemClick={handleGameClick}
            cardSize="medium"
          />
        )
      })}

      {/* Platform Carousels - Only show for ROM tab */}
      {activeTab === 'rom' && platforms.map((platform) => {
        const games = platformGames[platform.name]
        if (!games || games.length === 0) return null

        return (
          <SearchResultCarousel
            key={platform.name}
            title={platform.name}
            items={games}
            onItemClick={handleGameClick}
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
