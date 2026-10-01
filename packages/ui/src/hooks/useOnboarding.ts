import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './useApi'
import { API_BASE_URL } from '../services/api'
import { withCloudflareAccess } from '../services/cloudflare'

interface AppConfiguration {
  id: string
  onboardingCompleted: boolean
  onboardingCompletedAt: string | null
  prowlarrApiKey: string | null
  prowlarrUrl: string
  flaresolverrUrl: string | null
  organizationEnabled: boolean
  omdbApiKey: string | null
  tmdbApiKey: string | null
  igdbClientId: string | null
  igdbClientSecret: string | null
  createdAt: string
  updatedAt: string
}

interface OnboardingData {
  prowlarrApiKey: string
  organizationEnabled: boolean
  omdbApiKey?: string
  tmdbApiKey?: string
  igdbClientId?: string
  igdbClientSecret?: string
}

interface ProwlarrConfig {
  apiKey: string | null
  url: string
  flaresolverrUrl: string | null
}

interface ProwlarrConnectionTest {
  success: boolean
  message: string
  version?: string
  indexerCount?: number
}

// Get app configuration
export const useAppConfiguration = () => {
  return useQuery({
    queryKey: queryKeys.appConfiguration,
    queryFn: async (): Promise<AppConfiguration> => {
      const response = await fetch(`${API_BASE_URL}/configuration`, withCloudflareAccess())
      if (!response.ok) {
        throw new Error('Failed to fetch app configuration')
      }
      return response.json()
    },
  })
}

// Get onboarding status
export const useOnboardingStatus = () => {
  return useQuery({
    queryKey: queryKeys.onboardingStatus,
    queryFn: async (): Promise<{ completed: boolean }> => {
      const response = await fetch(`${API_BASE_URL}/configuration/onboarding/status`, withCloudflareAccess())
      if (!response.ok) {
        throw new Error('Failed to fetch onboarding status')
      }
      return response.json()
    },
  })
}

// Get Prowlarr configuration
export const useProwlarrConfig = () => {
  return useQuery({
    queryKey: queryKeys.prowlarrConfig,
    queryFn: async (): Promise<ProwlarrConfig> => {
      const response = await fetch(`${API_BASE_URL}/configuration/prowlarr`, withCloudflareAccess())
      if (!response.ok) {
        throw new Error('Failed to fetch Prowlarr configuration')
      }
      return response.json()
    },
  })
}

// Complete onboarding
export const useCompleteOnboarding = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: OnboardingData) => {
      const response = await fetch(`${API_BASE_URL}/configuration/onboarding/complete`, withCloudflareAccess({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }))

      if (!response.ok) {
        let errorMessage = 'Failed to complete onboarding'
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorMessage
        } catch {
          // If we can't parse the error response, use the default message
        }
        throw new Error(`${errorMessage} (Status: ${response.status})`)
      }

      return response.json()
    },
    onSuccess: async () => {
      // Invalidate related queries and wait for them to complete
      // This ensures the cache is properly updated before any navigation occurs
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.appConfiguration }),
        queryClient.invalidateQueries({ queryKey: queryKeys.onboardingStatus }),
        queryClient.invalidateQueries({ queryKey: queryKeys.prowlarrConfig }),
        queryClient.invalidateQueries({ queryKey: queryKeys.organizationSettings })
      ])
    },
  })
}

// Verify a Prowlarr URL and API key without saving them
export const useTestProwlarrConnection = () => {
  return useMutation({
    mutationFn: async (data: { url?: string; apiKey?: string }): Promise<ProwlarrConnectionTest> => {
      const response = await fetch(`${API_BASE_URL}/prowlarr/test`, withCloudflareAccess({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }))

      if (!response.ok) {
        throw new Error('Failed to test the Prowlarr connection')
      }

      return response.json()
    },
  })
}

// Update app configuration
export const useUpdateAppConfiguration = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: Partial<AppConfiguration>) => {
      const response = await fetch(`${API_BASE_URL}/configuration`, withCloudflareAccess({
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }))
      
      if (!response.ok) {
        throw new Error('Failed to update app configuration')
      }
      
      return response.json()
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.appConfiguration })
      queryClient.invalidateQueries({ queryKey: queryKeys.prowlarrConfig })
    },
  })
}
