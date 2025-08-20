import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { useCompleteOnboarding } from '@/hooks/useOnboarding'
import JackettStep from './onboarding/JackettStep'
import OrganizationStep from './onboarding/OrganizationStep'
import CompletionStep from './onboarding/CompletionStep'

interface OnboardingData {
  jackettApiKey: string
  organizationEnabled: boolean
}

const STEPS = [
  { id: 'jackett', title: 'Jackett Configuration', description: 'Configure your Jackett API key' },
  { id: 'organization', title: 'File Organization', description: 'Set up file organization preferences' },
  { id: 'complete', title: 'Complete Setup', description: 'Finish your setup' },
]

export default function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(0)
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    jackettApiKey: '',
    organizationEnabled: true,
  })
  
  const navigate = useNavigate()
  const { toast } = useToast()
  const completeOnboarding = useCompleteOnboarding()

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = async () => {
    try {
      await completeOnboarding.mutateAsync(onboardingData)
      toast({
        title: "Setup Complete!",
        description: "Welcome to Downloadarr! Your setup is now complete.",
      })
      navigate('/')
    } catch (error) {
      toast({
        title: "Setup Failed",
        description: "There was an error completing your setup. Please try again.",
        variant: "destructive",
      })
    }
  }

  const updateOnboardingData = (updates: Partial<OnboardingData>) => {
    setOnboardingData(prev => ({ ...prev, ...updates }))
  }

  const progress = ((currentStep + 1) / STEPS.length) * 100

  const renderStep = () => {
    switch (STEPS[currentStep].id) {
      case 'jackett':
        return (
          <JackettStep
            data={onboardingData}
            onUpdate={updateOnboardingData}
            onNext={handleNext}
          />
        )
      case 'organization':
        return (
          <OrganizationStep
            data={onboardingData}
            onUpdate={updateOnboardingData}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        )
      case 'complete':
        return (
          <CompletionStep
            data={onboardingData}
            onComplete={handleComplete}
            onPrevious={handlePrevious}
            isLoading={completeOnboarding.isPending}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome to Downloadarr</h1>
          <p className="text-muted-foreground">
            Let's get you set up with everything you need to start downloading media
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <div>
                <CardTitle>{STEPS[currentStep].title}</CardTitle>
                <CardDescription>{STEPS[currentStep].description}</CardDescription>
              </div>
              <div className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {STEPS.length}
              </div>
            </div>
            <Progress value={progress} className="w-full" />
          </CardHeader>
          <CardContent>
            {renderStep()}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
