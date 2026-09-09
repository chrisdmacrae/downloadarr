import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { DiscoveryScreen, type DiscoveryRail } from '@/components/discovery/DiscoveryScreen'
import { GameDetailModal } from '@/components/GameDetailModal'
import { SearchResult, apiService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'

type GamesTab = 'pc' | 'rom'

/** ROM platforms this screen builds rails from, in order. */
const TARGET_PLATFORMS = [
  'NES',
  'SNES',
  'N64',
  'GameCube',
  'Wii',
  'Wii U',
  'Game Boy',
  'Game Boy Color',
  'Game Boy Advance',
  'Switch',
  'Genesis',
  'Saturn',
  'Dreamcast',
  'PlayStation',
  'PlayStation 2',
  'PlayStation 3',
  'Xbox',
  'Xbox 360',
]

const PC_GENRES = [
  'Action',
  'Adventure',
  'Strategy',
  'RPG',
  'Shooter',
  'Simulation',
  'Sports',
  'Racing',
  'Puzzle',
  'Indie',
]

export default function GamesDiscovery() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<GamesTab>('pc')
  const [featured, setFeatured] = useState<SearchResult[]>([])
  const [popular, setPopular] = useState<SearchResult[]>([])
  const [rails, setRails] = useState<DiscoveryRail[]>([])
  const [selectedGame, setSelectedGame] = useState<{ id: string; title: string } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const tab = searchParams.get('tab') as GamesTab | null
    if (tab && ['pc', 'rom'].includes(tab)) setActiveTab(tab)
  }, [searchParams])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as GamesTab)
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next)
  }

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setRails([])
      try {
        if (activeTab === 'pc') {
          const first = await apiService.getPcGamesByGenre(PC_GENRES[0], 25)
          if (!cancelled && first.success && first.data) {
            setFeatured(first.data.slice(0, 5))
            setPopular(first.data.slice(5))
          }

          const built: DiscoveryRail[] = []
          for (const genre of PC_GENRES) {
            try {
              const response = await apiService.getPcGamesByGenre(genre, 20)
              if (response.success && response.data?.length) {
                built.push({ id: genre, title: genre, items: response.data.slice(0, 20) })
              }
            } catch (err) {
              console.error(`Failed to load PC games for genre ${genre}:`, err)
            }
          }
          if (!cancelled) setRails(built)
        } else {
          const popularResponse = await apiService.getPopularGames(25)
          if (!cancelled && popularResponse.success && popularResponse.data) {
            setFeatured(popularResponse.data.slice(0, 5))
            setPopular(popularResponse.data.slice(5))
          }

          const platformsResponse = await apiService.getSupportedPlatforms()
          if (!cancelled && platformsResponse.success && platformsResponse.data) {
            const platforms = TARGET_PLATFORMS.map((name) =>
              platformsResponse.data!.find((p) => p.name === name)
            ).filter(Boolean) as Array<{ name: string; id: number }>

            const built: DiscoveryRail[] = []
            for (const platform of platforms) {
              try {
                const response = await apiService.getGamesByPlatform(platform.name, 20)
                if (response.success && response.data?.length) {
                  built.push({
                    id: platform.name,
                    title: platform.name,
                    items: response.data.slice(0, 20),
                  })
                }
              } catch (err) {
                console.error(`Failed to load games for platform ${platform.name}:`, err)
              }
            }
            if (!cancelled) setRails(built)
          }
        }
      } catch {
        if (!cancelled) {
          toast({
            title: 'Discovery unavailable',
            description: 'Failed to load games discovery data. Check your IGDB keys in Settings.',
            variant: 'destructive',
          })
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  return (
    <>
      <DiscoveryScreen
        kind="game"
        eyebrow="Find"
        title="Discover games"
        description="Find your next gaming adventure, for games that you own"
        searchPlaceholder="Search for games…"
        searchTab="games"
        featured={featured}
        popular={popular}
        popularTitle={activeTab === 'pc' ? 'Popular PC games' : 'Popular ROMs'}
        genreRails={rails}
        isLoading={isLoading}
        tabs={[
          { id: 'pc', label: 'PC' },
          { id: 'rom', label: 'ROM' },
        ]}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onItemClick={(item) => {
          setSelectedGame({ id: item.id, title: item.title })
          setIsModalOpen(true)
        }}
        requestLabel="View details"
        onRequest={(item) => {
          // Games pick a platform first, so the detail modal owns the request.
          setSelectedGame({ id: item.id, title: item.title })
          setIsModalOpen(true)
        }}
      />

      {selectedGame && (
        <GameDetailModal
          gameId={selectedGame.id}
          title={selectedGame.title}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
        />
      )}
    </>
  )
}
