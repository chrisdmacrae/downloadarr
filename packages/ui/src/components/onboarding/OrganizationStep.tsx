import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FolderOpen, FileText, Settings } from 'lucide-react'

interface OrganizationStepProps {
  data: {
    prowlarrApiKey: string
    organizationEnabled: boolean
  }
  onUpdate: (updates: Partial<{ prowlarrApiKey: string; organizationEnabled: boolean }>) => void
  onNext: () => void
  onPrevious: () => void
}

export default function OrganizationStep({ data, onUpdate, onNext, onPrevious }: OrganizationStepProps) {
  const handleOrganizationToggle = (enabled: boolean) => {
    onUpdate({ organizationEnabled: enabled })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">File Organization</h3>
          <p className="text-sm text-fg-secondary mb-4">
            Downloadarr can automatically organize your downloaded files into a structured library.
          </p>
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-1">
            <Label htmlFor="organization-enabled" className="text-base font-medium">
              Enable File Organization
            </Label>
            <p className="text-sm text-fg-secondary">
              Automatically organize downloaded files into your library
            </p>
          </div>
          <Switch
            id="organization-enabled"
            checked={data.organizationEnabled}
            onCheckedChange={handleOrganizationToggle}
          />
        </div>

        {data.organizationEnabled && (
          <div className="space-y-4">
            <div className="bg-white/[.05] p-4 rounded-lg">
              <h4 className="font-medium mb-2">What will be organized:</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      Movies
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-xs">
                      Movies/Title (Year)/Title (Year) - Quality - Format
                    </CardDescription>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      TV Shows
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-xs">
                      TV Shows/Title (Year)/Season X/Episode files
                    </CardDescription>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      Games
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-xs">
                      Games/Title (Platform)/Game files
                    </CardDescription>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="rounded-card border border-hairline bg-white/[.05] p-4">
              <div className="flex items-start space-x-2">
                <Settings className="mt-0.5 h-4 w-4 text-fg-secondary" />
                <div>
                  <p className="text-sm font-medium text-fg-primary">
                    Default organization rules will be created
                  </p>
                  <p className="mt-1 text-xs text-fg-secondary">
                    You can customize these rules later in the Organization settings
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!data.organizationEnabled && (
          <div className="rounded-card border border-hairline bg-white/[.05] p-4">
            <div className="flex items-start space-x-2">
              <FolderOpen className="mt-0.5 h-4 w-4 text-fg-secondary" />
              <div>
                <p className="text-sm font-medium text-fg-primary">
                  Files will remain in the downloads folder
                </p>
                <p className="mt-1 text-xs text-fg-secondary">
                  You can enable organization later in the settings
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrevious}>
          Previous
        </Button>
        <Button onClick={onNext}>
          Continue
        </Button>
      </div>
    </div>
  )
}
