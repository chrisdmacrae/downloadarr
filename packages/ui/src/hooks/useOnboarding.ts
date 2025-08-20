import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './useApi'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface AppConfiguration {
  id: string
  onboardingCompleted: boolean
  onboardingCompletedAt: string | null
  jackettApiKey: string | null
  jackettUrl: string
  organizationEnabled: boolean
  createdAt: string
  updatedAt: string
}

interface OnboardingData {
  jackettApiKey: string
  organizationEnabled: boolean
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
        throw new Error('Failed to complete onboarding')
      }
      
      return response.json()
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.appConfiguration })
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingStatus })
      queryClient.invalidateQueries({ queryKey: queryKeys.jackettConfig })
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationSettings })
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
