import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './useApi'

// Runtime configuration
const getRuntimeApiUrl = (): string => {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    // Try to get config from window object (set by runtime config script)
    const windowConfig = (window as any).__RUNTIME_CONFIG__;
    if (windowConfig?.apiUrl) {
      return windowConfig.apiUrl;
    }

    // Fallback: determine API URL based on current location
    const { port } = window.location;

    // If we're accessing via nginx proxy (production Docker), use relative URLs
    if (port === '3000' || port === '') {
      return '/api';
    }

    // Development fallback
    return 'http://localhost:3001';
  }

  // Server-side rendering fallback
  return import.meta.env.VITE_API_URL || 'http://localhost:3001';
};

const API_BASE_URL = getRuntimeApiUrl();

interface AppConfiguration {
  id: string
  onboardingCompleted: boolean
  onboardingCompletedAt: string | null
  jackettApiKey: string | null
  jackettUrl: string
  organizationEnabled: boolean
  omdbApiKey: string | null
  tmdbApiKey: string | null
  igdbClientId: string | null
  igdbClientSecret: string | null
  createdAt: string
  updatedAt: string
}

interface OnboardingData {
  jackettApiKey: string
  organizationEnabled: boolean
  omdbApiKey?: string
  tmdbApiKey?: string
  igdbClientId?: string
  igdbClientSecret?: string
}

interface JackettConfig {
  apiKey: string | null
  url: string
}

// Get app configuration
export const useAppConfiguration = () => {
  return useQuery({
    queryKey: queryKeys.appConfiguration,
    queryFn: async (): Promise<AppConfiguration> => {
      const response = await fetch(`${API_BASE_URL}/configuration`)
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
      const response = await fetch(`${API_BASE_URL}/configuration/onboarding/status`)
      if (!response.ok) {
        throw new Error('Failed to fetch onboarding status')
      }
      return response.json()
    },
  })
}

// Get Jackett configuration
export const useJackettConfig = () => {
  return useQuery({
    queryKey: queryKeys.jackettConfig,
    queryFn: async (): Promise<JackettConfig> => {
      const response = await fetch(`${API_BASE_URL}/configuration/jackett`)
      if (!response.ok) {
        throw new Error('Failed to fetch Jackett configuration')
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
      const response = await fetch(`${API_BASE_URL}/configuration/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

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
        queryClient.invalidateQueries({ queryKey: queryKeys.jackettConfig }),
        queryClient.invalidateQueries({ queryKey: queryKeys.organizationSettings })
      ])
    },
  })
}

// Update app configuration
export const useUpdateAppConfiguration = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: Partial<AppConfiguration>) => {
      const response = await fetch(`${API_BASE_URL}/configuration`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update app configuration')
      }
      
      return response.json()
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.appConfiguration })
      queryClient.invalidateQueries({ queryKey: queryKeys.jackettConfig })
    },
  })
}
