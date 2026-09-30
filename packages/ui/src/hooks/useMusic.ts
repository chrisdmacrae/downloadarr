import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { musicApi } from '@/services/music'

export const musicKeys = {
  discover: (profileId?: string) => ['music', 'discover', profileId ?? 'all'] as const,
  dismissals: (profileId?: string) => ['music', 'dismissals', profileId ?? 'all'] as const,
}

/** Omit `profileId` for every profile, merged. */
export const useMusicDiscover = (profileId?: string) =>
  useQuery({ queryKey: musicKeys.discover(profileId), queryFn: () => musicApi.getDiscover(profileId), staleTime: 60_000 })

export const useMusicDismissals = (profileId?: string) =>
  useQuery({ queryKey: musicKeys.dismissals(profileId), queryFn: () => musicApi.getDismissals(profileId) })

export const useDismissMusic = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ artistName, albumTitle, profileId }: { artistName: string; albumTitle?: string; profileId?: string }) =>
      musicApi.dismiss(artistName, albumTitle, profileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['music'] }),
  })
}

export const useUndoMusicDismissal = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: musicApi.undoDismissal,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['music', 'dismissals'] }),
  })
}
