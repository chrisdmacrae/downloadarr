import { useMemo } from 'react'

import type { DiscoveryRail } from '@/components/discovery/DiscoveryScreen'
import { useProfile } from '@/contexts/ProfileContext'
import { useToast } from '@/hooks/use-toast'
import { useDismissVideo, useVideoRecommendations } from '@/hooks/useRecommendations'
import type { SearchResult } from '@/services/api'
import type { VideoKind } from '@/services/recommendations'

/**
 * The picked profile's Trakt rails for the Movies or TV page — recommended
 * titles and the watchlist — and the "Not interested" handler for them.
 */
export function usePersonalRails(kind: VideoKind) {
  const { toast } = useToast()
  const { profileId, profile, profiles } = useProfile()
  const { data } = useVideoRecommendations(kind, profileId)
  const dismiss = useDismissVideo()
  const several = profiles.length > 1

  const personalRails = useMemo<DiscoveryRail[]>(() => {
    if (!data) return []
    const noun = kind === 'MOVIE' ? 'movies' : 'shows'
    const whose = profile && several ? `${profile.name}’s` : several ? 'Everyone’s' : 'Your'
    return [
      {
        id: 'recommended',
        title: profile && several ? `Recommended for ${profile.name}` : several ? 'Recommended for everyone' : 'Recommended for you',
        items: data.recommended,
        dismissible: true,
      },
      { id: 'watchlist', title: `${whose} ${noun} watchlist`, items: data.watchlist },
    ]
  }, [data, kind, profile, several])

  const onDismiss = (item: SearchResult) =>
    dismiss.mutate(
      { kind, tmdbId: Number(item.id), title: item.title, profileId },
      {
        onSuccess: () =>
          toast({
            title: `${item.title} hidden`,
            description: !profileId && several ? 'Hidden for every profile.' : undefined,
          }),
        onError: (error: any) =>
          toast({
            title: 'Couldn’t hide it',
            description: error?.response?.data?.message ?? error?.message,
            variant: 'destructive',
          }),
      }
    )

  return { personalRails, onDismiss }
}
