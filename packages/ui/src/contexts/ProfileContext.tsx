import * as React from 'react'

import { useRecommendationProfiles } from '@/hooks/useRecommendations'
import type { RecommendationProfile } from '@/services/recommendations'

const STORAGE_KEY = 'downloadarr.recommendationProfile'
const EVERYONE = 'all'

interface ProfileState {
  profiles: RecommendationProfile[]
  /** The profile recommendations are filtered to; undefined means everyone. */
  profileId: string | undefined
  profile: RecommendationProfile | undefined
  /** "Sam", or "everyone" when no single profile is picked. */
  label: string
  select: (profileId: string | undefined) => void
}

const ProfileContext = React.createContext<ProfileState | null>(null)

function readStored(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? EVERYONE
  } catch {
    return EVERYONE
  }
}

/**
 * Whose recommendations the Music, Movies and TV pages show. The choice is
 * remembered per browser; a remembered profile that was since deleted falls
 * back to everyone.
 */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { data: profiles = [] } = useRecommendationProfiles()
  const [stored, setStored] = React.useState<string>(readStored)

  const profile = profiles.find((p) => p.id === stored)
  // With one profile there's nothing to choose between.
  const effective = profiles.length === 1 ? profiles[0] : profile

  const select = React.useCallback((profileId: string | undefined) => {
    const value = profileId ?? EVERYONE
    setStored(value)
    try {
      window.localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Private windows can refuse storage; the choice then lasts the session.
    }
  }, [])

  const value = React.useMemo<ProfileState>(
    () => ({
      profiles,
      profileId: effective?.id,
      profile: effective,
      label: effective?.name ?? 'everyone',
      select,
    }),
    [profiles, effective, select]
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const context = React.useContext(ProfileContext)
  if (!context) throw new Error('useProfile must be used inside ProfileProvider')
  return context
}
