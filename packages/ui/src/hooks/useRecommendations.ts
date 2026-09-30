import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { recommendationsApi, type RecommendationSourceProvider, type VideoKind } from '@/services/recommendations'

export const recommendationKeys = {
  profiles: ['recommendations', 'profiles'] as const,
  sources: ['recommendations', 'sources'] as const,
  apps: ['recommendations', 'apps'] as const,
  syncStatus: ['recommendations', 'sync', 'status'] as const,
}

/** Everything built from a sync: music lists, movie and TV rails. */
const RESULT_KEYS = [['music'], ['recommendations', 'video']] as const

export const useRecommendationProfiles = () =>
  useQuery({ queryKey: recommendationKeys.profiles, queryFn: recommendationsApi.getProfiles, staleTime: 60_000 })

export const useRecommendationSources = () =>
  useQuery({ queryKey: recommendationKeys.sources, queryFn: recommendationsApi.getSources })

export const useRecommendationApps = () =>
  useQuery({ queryKey: recommendationKeys.apps, queryFn: recommendationsApi.getApps })

export const useCreateProfile = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recommendationsApi.createProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: recommendationKeys.profiles }),
  })
}

export const useRenameProfile = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => recommendationsApi.renameProfile(id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: recommendationKeys.profiles }),
  })
}

export const useDeleteProfile = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recommendationsApi.deleteProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recommendationKeys.profiles })
      queryClient.invalidateQueries({ queryKey: recommendationKeys.sources })
      for (const key of RESULT_KEYS) queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export const useSaveApps = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recommendationsApi.saveApps,
    onSuccess: (apps) => queryClient.setQueryData(recommendationKeys.apps, apps),
  })
}

export const useSaveSource = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      profileId,
      provider,
      ...body
    }: {
      profileId: string
      provider: RecommendationSourceProvider
      username: string
      apiKey?: string
      enabled?: boolean
    }) => recommendationsApi.saveSource(profileId, provider, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recommendationKeys.sources })
      // Saving a source starts a sync on the server.
      queryClient.invalidateQueries({ queryKey: recommendationKeys.syncStatus })
    },
  })
}

export const useRemoveSource = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ profileId, provider }: { profileId: string; provider: RecommendationSourceProvider }) =>
      recommendationsApi.removeSource(profileId, provider),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: recommendationKeys.sources }),
  })
}

/**
 * Sync status, polled every 2s while a sync runs. When one finishes, the
 * recommendations and account states are refetched.
 */
export const useRecommendationSyncStatus = () => {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: recommendationKeys.syncStatus,
    queryFn: recommendationsApi.getSyncStatus,
    refetchInterval: (q) => (q.state.data?.running ? 2000 : false),
  })

  const wasRunning = useRef(false)
  const running = Boolean(query.data?.running)
  useEffect(() => {
    if (wasRunning.current && !running) {
      for (const key of RESULT_KEYS) queryClient.invalidateQueries({ queryKey: key })
      queryClient.invalidateQueries({ queryKey: recommendationKeys.sources })
      queryClient.invalidateQueries({ queryKey: recommendationKeys.profiles })
    }
    wasRunning.current = running
  }, [running, queryClient])

  return query
}

export const useStartRecommendationSync = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (profileId?: string) => recommendationsApi.startSync(profileId),
    onSuccess: (status) => queryClient.setQueryData(recommendationKeys.syncStatus, status),
  })
}

/** Omit `profileId` for every profile, merged. */
export const useVideoRecommendations = (kind: VideoKind, profileId?: string) =>
  useQuery({
    queryKey: ['recommendations', 'video', kind, profileId ?? 'all'],
    queryFn: () => recommendationsApi.getVideoRails(kind, profileId),
    staleTime: 60_000,
  })

export const useDismissVideo = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recommendationsApi.dismissVideo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recommendations', 'video'] }),
  })
}

export const useVideoDismissals = (profileId?: string) =>
  useQuery({
    queryKey: ['recommendations', 'video', 'dismissals', profileId ?? 'all'],
    queryFn: () => recommendationsApi.getVideoDismissals(profileId),
  })

export const useUndoVideoDismissal = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recommendationsApi.undoVideoDismissal,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recommendations', 'video', 'dismissals'] }),
  })
}
