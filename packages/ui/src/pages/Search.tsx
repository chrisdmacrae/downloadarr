import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Search as SearchIcon, Download, Star } from 'lucide-react'

export default function Search() {
  const [activeTab, setActiveTab] = useState('movies')

  const searchResults = [
    {
      id: '1',
      title: 'The Matrix',
      year: '1999',
      rating: '8.7',
      genre: 'Action, Sci-Fi',
      poster: '/api/placeholder/150/225',
      type: 'movie',
    },
    {
      id: '2',
      title: 'Breaking Bad',
      year: '2008-2013',
      rating: '9.5',
      genre: 'Crime, Drama',
      poster: '/api/placeholder/150/225',
      type: 'tv',
    },
    {
      id: '3',
      title: 'Super Mario Bros',
      year: '1985',
      rating: '9.2',
      genre: 'Platform',
      poster: '/api/placeholder/150/225',
      type: 'rom',
      system: 'NES',
    },
  ]

  const tabs = [
    { id: 'movies', label: 'Movies' },
    { id: 'tv', label: 'TV Shows' },
    { id: 'roms', label: 'ROMs' },
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
              <input
                type="text"
                placeholder="Search for movies, TV shows, or ROMs..."
                className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background"
              />
            </div>
            <Button>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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

      {/* Search Results */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {searchResults.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <div className="aspect-[2/3] bg-muted relative">
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                No Image
              </div>
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg line-clamp-1">{item.title}</CardTitle>
              <CardDescription className="flex items-center justify-between">
                <span>{item.year}</span>
                <div className="flex items-center space-x-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs">{item.rating}</span>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-3 line-clamp-1">
                {item.genre}
                {item.type === 'rom' && item.system && ` • ${item.system}`}
              </p>
              <Button className="w-full" size="sm">
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
