import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ExternalLink, Bug, Lightbulb } from 'lucide-react'

interface IssueReportFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface IssueFormData {
  type: 'bug' | 'feature' | ''
  title: string
  description: string
  stepsToReproduce: string
  expectedBehavior: string
  actualBehavior: string
  browser: string
  operatingSystem: string
  version: string
  deployment: string
  priority: string
  component: string
  additionalContext: string
  hasSearched: boolean
  hasProvidedInfo: boolean
  isSupported: boolean
}

const initialFormData: IssueFormData = {
  type: '',
  title: '',
  description: '',
  stepsToReproduce: '',
  expectedBehavior: '',
  actualBehavior: '',
  browser: '',
  operatingSystem: '',
  version: '',
  deployment: '',
  priority: '',
  component: '',
  additionalContext: '',
  hasSearched: false,
  hasProvidedInfo: false,
  isSupported: false,
}

export function IssueReportForm({ open, onOpenChange }: IssueReportFormProps) {
  const [formData, setFormData] = useState<IssueFormData>(initialFormData)

  const updateField = (field: keyof IssueFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setFormData(initialFormData)
  }

  const generateGitHubIssueUrl = () => {
    const baseUrl = 'https://github.com/chrisdmacrae/downloadarr/issues/new'
    const params = new URLSearchParams()

    if (formData.type === 'bug') {
      params.append('template', 'bug_report.yml')
      params.append('title', `[Bug]: ${formData.title}`)
      params.append('version', formData.version)
      params.append('deployment', formData.deployment)
      params.append('description', formData.description)
      params.append('steps', formData.stepsToReproduce)
      params.append('expected', formData.expectedBehavior)
      params.append('actual', formData.actualBehavior)
      params.append('browser', formData.browser)
      params.append('os', formData.operatingSystem)
      params.append('additional', formData.additionalContext)
    } else if (formData.type === 'feature') {
      params.append('template', 'feature_request.yml')
      params.append('title', `[Feature]: ${formData.title}`)
      params.append('problem', formData.description)
      params.append('solution', formData.expectedBehavior)
      params.append('component', formData.component)
      params.append('priority', formData.priority)
      params.append('use_case', formData.stepsToReproduce)
      params.append('additional', formData.additionalContext)
    }

    return `${baseUrl}?${params.toString()}`
  }

  const handleSubmit = () => {
    const url = generateGitHubIssueUrl()
    window.open(url, '_blank')
    onOpenChange(false)
    resetForm()
  }

  const isFormValid = () => {
    // Basic required fields for all issue types
    const baseValid = formData.type && formData.title.trim() && formData.description.trim() &&
                     formData.hasSearched && formData.hasProvidedInfo && formData.isSupported

    if (formData.type === 'bug') {
      // For bug reports, require steps and expected behavior, but make other fields optional
      return baseValid && formData.stepsToReproduce.trim() && formData.expectedBehavior.trim()
    } else if (formData.type === 'feature') {
      // For feature requests, require solution and component
      return baseValid && formData.expectedBehavior.trim() && formData.component && formData.priority
    }

    return false
  }

  const getValidationErrors = () => {
    const errors: string[] = []

    if (!formData.type) errors.push("Issue type")
    if (!formData.title.trim()) errors.push("Title")
    if (!formData.description.trim()) errors.push("Description")
    if (!formData.hasSearched) errors.push("Confirm you've searched existing issues")
    if (!formData.hasProvidedInfo) errors.push("Confirm you've provided all information")
    if (!formData.isSupported) errors.push("Confirm you're using a supported version")

    if (formData.type === 'bug') {
      if (!formData.stepsToReproduce.trim()) errors.push("Steps to reproduce")
      if (!formData.expectedBehavior.trim()) errors.push("Expected behavior")
    } else if (formData.type === 'feature') {
      if (!formData.expectedBehavior.trim()) errors.push("Proposed solution")
      if (!formData.component) errors.push("Component")
      if (!formData.priority) errors.push("Priority")
    }

    return errors
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {formData.type === 'bug' ? <Bug className="h-5 w-5" /> : <Lightbulb className="h-5 w-5" />}
            Report an Issue
          </DialogTitle>
          <DialogDescription>
            Help us improve Downloadarr by reporting bugs or suggesting new features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Issue Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Issue Type *</Label>
            <Select value={formData.type} onValueChange={(value) => updateField('type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select issue type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">🐛 Bug Report</SelectItem>
                <SelectItem value="feature">✨ Feature Request</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Brief description of the issue or feature"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              {formData.type === 'bug' ? 'Bug Description *' : 'Problem Statement *'}
            </Label>
            <textarea
              id="description"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder={formData.type === 'bug' ? 
                'Describe what happened...' : 
                'Describe the problem you\'re trying to solve...'}
            />
          </div>

          {formData.type === 'bug' && (
            <>
              {/* Steps to Reproduce */}
              <div className="space-y-2">
                <Label htmlFor="steps">Steps to Reproduce *</Label>
                <textarea
                  id="steps"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.stepsToReproduce}
                  onChange={(e) => updateField('stepsToReproduce', e.target.value)}
                  placeholder="1. Go to '...'&#10;2. Click on '...'&#10;3. See error"
                />
              </div>

              {/* Expected Behavior */}
              <div className="space-y-2">
                <Label htmlFor="expected">Expected Behavior *</Label>
                <textarea
                  id="expected"
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.expectedBehavior}
                  onChange={(e) => updateField('expectedBehavior', e.target.value)}
                  placeholder="What should have happened?"
                />
              </div>

              {/* Actual Behavior */}
              <div className="space-y-2">
                <Label htmlFor="actual">Actual Behavior</Label>
                <textarea
                  id="actual"
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.actualBehavior}
                  onChange={(e) => updateField('actualBehavior', e.target.value)}
                  placeholder="What actually happened? (optional but helpful)"
                />
              </div>

              {/* Version */}
              <div className="space-y-2">
                <Label htmlFor="version">Downloadarr Version</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => updateField('version', e.target.value)}
                  placeholder="e.g., v1.0.0, latest, commit hash (optional but helpful)"
                />
              </div>

              {/* Deployment Method */}
              <div className="space-y-2">
                <Label htmlFor="deployment">Deployment Method</Label>
                <Select value={formData.deployment} onValueChange={(value) => updateField('deployment', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="How are you running Downloadarr? (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="docker-compose">Docker Compose (recommended)</SelectItem>
                    <SelectItem value="docker">Docker</SelectItem>
                    <SelectItem value="manual">Manual/Development</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Browser */}
              <div className="space-y-2">
                <Label htmlFor="browser">Browser (if applicable)</Label>
                <Input
                  id="browser"
                  value={formData.browser}
                  onChange={(e) => updateField('browser', e.target.value)}
                  placeholder="e.g., Chrome 120, Firefox 121, Safari 17"
                />
              </div>

              {/* Operating System */}
              <div className="space-y-2">
                <Label htmlFor="os">Operating System</Label>
                <Input
                  id="os"
                  value={formData.operatingSystem}
                  onChange={(e) => updateField('operatingSystem', e.target.value)}
                  placeholder="e.g., Ubuntu 22.04, Windows 11, macOS 14"
                />
              </div>
            </>
          )}

          {formData.type === 'feature' && (
            <>
              {/* Proposed Solution */}
              <div className="space-y-2">
                <Label htmlFor="solution">Proposed Solution *</Label>
                <textarea
                  id="solution"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.expectedBehavior}
                  onChange={(e) => updateField('expectedBehavior', e.target.value)}
                  placeholder="Describe the solution you'd like..."
                />
              </div>

              {/* Use Case */}
              <div className="space-y-2">
                <Label htmlFor="usecase">Use Case</Label>
                <textarea
                  id="usecase"
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.stepsToReproduce}
                  onChange={(e) => updateField('stepsToReproduce', e.target.value)}
                  placeholder="How would you use this feature?"
                />
              </div>

              {/* Component */}
              <div className="space-y-2">
                <Label htmlFor="component">Component *</Label>
                <Select value={formData.component} onValueChange={(value) => updateField('component', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Which part would this affect?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="frontend">Frontend/UI</SelectItem>
                    <SelectItem value="api">API/Backend</SelectItem>
                    <SelectItem value="docker">Docker/Deployment</SelectItem>
                    <SelectItem value="vpn">VPN Integration</SelectItem>
                    <SelectItem value="media">Media Discovery</SelectItem>
                    <SelectItem value="games">ROM/Game Discovery</SelectItem>
                    <SelectItem value="downloads">Download Management</SelectItem>
                    <SelectItem value="organization">Organization/File Management</SelectItem>
                    <SelectItem value="settings">Settings/Configuration</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority">Priority *</Label>
                <Select value={formData.priority} onValueChange={(value) => updateField('priority', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="How important is this?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Nice to have</SelectItem>
                    <SelectItem value="medium">Medium - Would improve my workflow</SelectItem>
                    <SelectItem value="high">High - Essential for my use case</SelectItem>
                    <SelectItem value="critical">Critical - Blocking my usage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Additional Context */}
          <div className="space-y-2">
            <Label htmlFor="additional">Additional Context</Label>
            <textarea
              id="additional"
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.additionalContext}
              onChange={(e) => updateField('additionalContext', e.target.value)}
              placeholder="Any additional information..."
            />
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="searched"
                checked={formData.hasSearched}
                onCheckedChange={(checked) => updateField('hasSearched', checked as boolean)}
              />
              <Label htmlFor="searched" className="text-sm">
                I have searched existing issues to ensure this is not a duplicate *
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="provided"
                checked={formData.hasProvidedInfo}
                onCheckedChange={(checked) => updateField('hasProvidedInfo', checked as boolean)}
              />
              <Label htmlFor="provided" className="text-sm">
                I have provided all the requested information above *
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="supported"
                checked={formData.isSupported}
                onCheckedChange={(checked) => updateField('isSupported', checked as boolean)}
              />
              <Label htmlFor="supported" className="text-sm">
                I am running a supported version of Downloadarr *
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col space-y-2">
          {!isFormValid() && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <p className="font-medium">Please complete the following required fields:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                {getValidationErrors().map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid()}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open GitHub Issue
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
