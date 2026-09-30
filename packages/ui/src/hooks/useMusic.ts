import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { musicApi, type MusicSourceProvider } from '@/services/music'

export const musicKeys = {
  sources: ['music', 'sources'] as const,
  syncStatus: ['music', 'sync', 'status'] as const,
  discover: ['music', 'discover'] as const,
  dismissals: ['music', 'dismissals'] as const,
}

export const useMusicSources = () =>
  useQuery({ queryKey: musicKeys.sources, queryFn: musicApi.getSources })

export const useMusicDiscover = () =>
  useQuery({ queryKey: musicKeys.discover, queryFn: musicApi.getDiscover, staleTime: 60_000 })

export const useMusicDismissals = () =>
  useQuery({ queryKey: musicKeys.dismissals, queryFn: musicApi.getDismissals })

/**
 * Sync status, polled every 2s while a sync runs. When one finishes, the lists
 * and source states are refetched.
 */
export const useMusicSyncStatus = () => {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: musicKeys.syncStatus,
    queryFn: musicApi.getSyncStatus,
    refetchInterval: (q) => (q.state.data?.running ? 2000 : false),
  })

  const wasRunning = useRef(false)
  const running = Boolean(query.data?.running)
  useEffect(() => {
    if (wasRunning.current && !running) {
      queryClient.invalidateQueries({ queryKey: musicKeys.discover })
      queryClient.invalidateQueries({ queryKey: musicKeys.sources })
    }
    wasRunning.current = running
  }, [running, queryClient])

  return query
}

export const useStartMusicSync = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: musicApi.startSync,
    onSuccess: (status) => queryClient.setQueryData(musicKeys.syncStatus, status),
  })
}

export const useSaveMusicSource = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      provider,
      ...body
    }: {
      provider: MusicSourceProvider
      username: string
      apiKey?: string
      enabled?: boolean
    }) => musicApi.saveSource(provider, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: musicKeys.sources })
      // Saving a source starts a sync on the server.
      queryClient.invalidateQueries({ queryKey: musicKeys.syncStatus })
    },
  })
}

export const useRemoveMusicSource = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: musicApi.removeSource,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: musicKeys.sources }),
  })
}

export const useDismissMusic = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ artistName, albumTitle }: { artistName: string; albumTitle?: string }) =>
      musicApi.dismiss(artistName, albumTitle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: musicKeys.discover })
      queryClient.invalidateQueries({ queryKey: musicKeys.dismissals })
    },
  })
}

export const useUndoMusicDismissal = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: musicApi.undoDismissal,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: musicKeys.dismissals }),
  })
}
