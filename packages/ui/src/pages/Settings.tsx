import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  FolderTree,
  Gauge,
  HardDrive,
  KeyRound,
  Radar,
  ShieldCheck,
  SlidersHorizontal,
  Wand2,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Page, PageHeader, PageSection } from '@/components/ds/Page'
import { SidebarNav, type SidebarGroup } from '@/components/ds/SidebarNav'
import { StatusBadge } from '@/components/ds/StatusBadge'
import ApiKeysSettings from '@/components/settings/ApiKeysSettings'
import ProwlarrSettings from '@/components/settings/ProwlarrSettings'
import { OrganizationSection } from '@/components/settings/OrganizationSection'
import { QualityRulesSettings } from '@/components/settings/QualityRulesSettings'
import { ServiceLinks } from '@/components/settings/ServiceLinks'
import { useToast } from '@/hooks/use-toast'
import {
  useOrganizationSettings,
  useOrganizeQueueStats,
  useReverseIndexingStatus,
  useSystemInfo,
  useTriggerReverseIndexing,
  useUpdateOrganizationSettings,
  useVpnStatus,
} from '@/hooks/useApi'
import {
  useAppConfiguration,
  useTestProwlarrConnection,
  useUpdateAppConfiguration,
} from '@/hooks/useOnboarding'
import type { OrganizationSettings } from '@/services/api'

type SectionId =
  | 'general'
  | 'indexing'
  | 'discovery'
  | 'quality'
  | 'organization'
  | 'paths'
  | 'vpn'
  | 'setup'

const SECTION_TITLES: Record<SectionId, { title: string; description: string }> = {
  general: { title: 'General', description: 'How this instance is configured and what version it runs' },
  indexing: { title: 'Indexing', description: 'Prowlarr and the Cloudflare bypass your indexers need' },
  discovery: { title: 'Discovery keys', description: 'API keys for movie, TV and game metadata' },
  quality: { title: 'Quality rules', description: 'Defaults applied to every new request' },
  organization: {
    title: 'Organization',
    description: 'Naming rules, and folders that need manual organization',
  },
  paths: { title: 'Paths & storage', description: 'Where your library lives and how files get filed' },
  vpn: { title: 'VPN', description: 'Download traffic routing and connection health' },
  setup: { title: 'Setup wizard', description: 'Re-run onboarding from the beginning' },
}

const SECTION_IDS = Object.keys(SECTION_TITLES) as SectionId[]

export default function Settings() {
  const { section } = useParams<{ section?: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const activeSection: SectionId =
    section && SECTION_IDS.includes(section as SectionId) ? (section as SectionId) : 'general'

  const { data: settings, isLoading: settingsLoading } = useOrganizationSettings()
  const { data: reverseIndexingStatus } = useReverseIndexingStatus()
  const { data: appConfig, isLoading: appConfigLoading } = useAppConfiguration()
  const { data: queueStats } = useOrganizeQueueStats()
  const { data: systemInfo } = useSystemInfo()
  const { data: vpnStatus } = useVpnStatus()
  const updateSettings = useUpdateOrganizationSettings()
  const updateAppConfig = useUpdateAppConfiguration()
  const testProwlarrConnection = useTestProwlarrConnection()
  const triggerReverseIndexing = useTriggerReverseIndexing()

  const [formData, setFormData] = useState<Partial<OrganizationSettings>>({})
  const [appConfigData, setAppConfigData] = useState({
    prowlarrApiKey: '',
    prowlarrUrl: '',
    flaresolverrUrl: '',
    omdbApiKey: '',
    tmdbApiKey: '',
    igdbClientId: '',
    igdbClientSecret: '',
  })

  useEffect(() => {
    if (settings) setFormData(settings)
  }, [settings])

  useEffect(() => {
    if (appConfig) {
      setAppConfigData({
        prowlarrApiKey: appConfig.prowlarrApiKey || '',
        prowlarrUrl: appConfig.prowlarrUrl || '',
        flaresolverrUrl: appConfig.flaresolverrUrl || '',
        omdbApiKey: appConfig.omdbApiKey || '',
        tmdbApiKey: appConfig.tmdbApiKey || '',
        igdbClientId: appConfig.igdbClientId || '',
        igdbClientSecret: appConfig.igdbClientSecret || '',
      })
    }
  }, [appConfig])

  const groups: SidebarGroup[] = useMemo(
    () => [
      {
        label: 'Configuration',
        items: [
          { id: 'general', label: 'General', icon: SlidersHorizontal },
          { id: 'indexing', label: 'Indexing', icon: Radar },
          { id: 'discovery', label: 'Discovery keys', icon: KeyRound },
          { id: 'quality', label: 'Quality rules', icon: Gauge },
        ],
      },
      {
        label: 'Library',
        items: [
          {
            id: 'organization',
            label: 'Organization',
            icon: FolderTree,
            count: queueStats?.pending || undefined,
          },
          { id: 'paths', label: 'Paths & storage', icon: HardDrive },
        ],
      },
      {
        label: 'System',
        items: [
          { id: 'vpn', label: 'VPN', icon: ShieldCheck },
          { id: 'setup', label: 'Setup wizard', icon: Wand2 },
        ],
      },
    ],
    [queueStats]
  )

  const handleAppConfigChange = (updates: Partial<typeof appConfigData>) =>
    setAppConfigData((prev) => ({ ...prev, ...updates }))

  const handleInputChange = (field: keyof OrganizationSettings, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }))

  const handleSwitchChange = (field: keyof OrganizationSettings, checked: boolean) =>
    setFormData((prev) => ({ ...prev, [field]: checked }))

  const handleTestProwlarrConnection = async () => {
    try {
      const result = await testProwlarrConnection.mutateAsync({
        url: appConfigData.prowlarrUrl || undefined,
        apiKey: appConfigData.prowlarrApiKey || undefined,
      })
      toast({
        title: result.success ? 'Prowlarr reachable' : 'Prowlarr unreachable',
        description: result.message,
        variant: result.success ? undefined : 'destructive',
      })
    } catch {
      toast({
        title: 'Test failed',
        description: 'Could not reach the Downloadarr API to run the test.',
        variant: 'destructive',
      })
    }
  }

  const handleSaveProwlarrConfig = async () => {
    try {
      await updateAppConfig.mutateAsync({
        prowlarrApiKey: appConfigData.prowlarrApiKey || undefined,
        prowlarrUrl: appConfigData.prowlarrUrl || undefined,
        flaresolverrUrl: appConfigData.flaresolverrUrl || undefined,
      })
      toast({
        title: 'Indexing settings saved',
        description: 'Prowlarr configuration has been updated successfully.',
      })
    } catch {
      toast({
        title: 'Save failed',
        description: 'Failed to save indexing settings. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleSaveApiKeys = async () => {
    try {
      await updateAppConfig.mutateAsync({
        omdbApiKey: appConfigData.omdbApiKey || undefined,
        tmdbApiKey: appConfigData.tmdbApiKey || undefined,
        igdbClientId: appConfigData.igdbClientId || undefined,
        igdbClientSecret: appConfigData.igdbClientSecret || undefined,
      })
      toast({
        title: 'API keys saved',
        description: 'External API keys have been updated successfully.',
      })
    } catch {
      toast({
        title: 'Save failed',
        description: 'Failed to save API keys. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleSaveSettings = async () => {
    try {
      await updateSettings.mutateAsync({
        libraryPath: formData.libraryPath,
        moviesPath: formData.moviesPath,
        tvShowsPath: formData.tvShowsPath,
        gamesPath: formData.gamesPath,
        organizeOnComplete: formData.organizeOnComplete,
        replaceExistingFiles: formData.replaceExistingFiles,
        extractArchives: formData.extractArchives,
        deleteAfterExtraction: formData.deleteAfterExtraction,
        enableReverseIndexing: formData.enableReverseIndexing,
        reverseIndexingCron: formData.reverseIndexingCron,
      })
      toast({
        title: 'Settings saved',
        description: 'Organization settings have been updated successfully.',
      })
    } catch {
      toast({
        title: 'Save failed',
        description: 'Failed to save organization settings. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleTriggerReverseIndexing = async () => {
    try {
      const result = await triggerReverseIndexing.mutateAsync()
      toast({ title: 'Reverse indexing started', description: result.message })
    } catch {
      toast({
        title: 'Scan failed',
        description: 'Failed to start reverse indexing. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleResetToDefaults = () => {
    setFormData({
      libraryPath: '/library',
      moviesPath: '',
      tvShowsPath: '',
      gamesPath: '',
      organizeOnComplete: true,
      replaceExistingFiles: true,
      extractArchives: true,
      deleteAfterExtraction: true,
      enableReverseIndexing: true,
      reverseIndexingCron: '0 * * * *',
    })
  }

  const isLoading = settingsLoading || appConfigLoading
  const meta = SECTION_TITLES[activeSection]

  return (
    <Page className="pt-8">
      <PageSection>
        <PageHeader
          eyebrow="System"
          title="Settings"
          description="Configure your download preferences and system settings"
        />

        {/* Two panes: a sticky 232px sub-nav beside one pane per section. */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="w-full shrink-0 lg:sticky lg:top-[calc(var(--topbar-h)+24px)] lg:w-settings-nav">
            <SidebarNav
              bare
              aria-label="Settings sections"
              groups={groups}
              active={activeSection}
              onNavigate={(id) => navigate(`/settings/${id}`)}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-6 flex flex-col gap-1">
              <h2 className="text-2xl font-bold leading-tight tracking-tight text-fg-primary">
                {meta.title}
              </h2>
              <p className="text-sm text-fg-secondary">{meta.description}</p>
            </div>

            {isLoading ? (
              <SectionSkeleton />
            ) : (
              <>
                {activeSection === 'general' && (
                  <div className="flex flex-col gap-6">
                    <Alert>
                      <AlertTitle>Settings are stored in the database</AlertTitle>
                      <AlertDescription>
                        Everything on this screen persists to Downloadarr's database, not to env
                        files — env values are only a fallback for a fresh install.
                      </AlertDescription>
                    </Alert>

                    <Card>
                      <CardHeader>
                        <CardTitle>Instance</CardTitle>
                        <CardDescription>What this Downloadarr is running</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4 sm:grid-cols-2">
                        <Field label="Version" value={systemInfo?.version ?? '—'} mono />
                        <Field label="Environment" value={systemInfo?.environment ?? '—'} mono />
                        <Field
                          label="Uptime"
                          value={
                            systemInfo?.uptime
                              ? `${Math.floor(systemInfo.uptime / 3600)}h ${Math.floor(
                                  (systemInfo.uptime % 3600) / 60
                                )}m`
                              : '—'
                          }
                          mono
                        />
                        <Field
                          label="VPN"
                          value={systemInfo?.vpnEnabled ? 'Enabled' : 'Disabled'}
                          mono
                        />
                      </CardContent>
                    </Card>

                    <ServiceLinks
                      configuredProwlarrUrl={appConfigData.prowlarrUrl}
                      configuredFlaresolverrUrl={appConfigData.flaresolverrUrl}
                    />

                    <Card>
                      <CardHeader>
                        <CardTitle>Organization</CardTitle>
                        <CardDescription>
                          Naming rules and the organize queue moved into Library → Organization
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button variant="secondary" onClick={() => navigate('/settings/organization')}>
                          <FolderTree className="h-4 w-4" />
                          Open organization
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {activeSection === 'indexing' && (
                  <div className="flex flex-col gap-6">
                    <ServiceLinks
                      variant="self-hosted"
                      configuredProwlarrUrl={appConfigData.prowlarrUrl}
                      configuredFlaresolverrUrl={appConfigData.flaresolverrUrl}
                    />
                    <ProwlarrSettings
                      data={{
                        prowlarrApiKey: appConfigData.prowlarrApiKey,
                        prowlarrUrl: appConfigData.prowlarrUrl,
                        flaresolverrUrl: appConfigData.flaresolverrUrl,
                      }}
                      onUpdate={handleAppConfigChange}
                      onSave={handleSaveProwlarrConfig}
                      onTest={handleTestProwlarrConnection}
                      isLoading={updateAppConfig.isPending}
                      isTesting={testProwlarrConnection.isPending}
                    />
                  </div>
                )}

                {activeSection === 'discovery' && (
                  <div className="flex flex-col gap-6">
                    <ApiKeysSettings
                      data={{
                        omdbApiKey: appConfigData.omdbApiKey,
                        tmdbApiKey: appConfigData.tmdbApiKey,
                        igdbClientId: appConfigData.igdbClientId,
                        igdbClientSecret: appConfigData.igdbClientSecret,
                      }}
                      onUpdate={handleAppConfigChange}
                      onSave={handleSaveApiKeys}
                      isLoading={updateAppConfig.isPending}
                    />
                    <ServiceLinks variant="providers" />
                  </div>
                )}

                {activeSection === 'quality' && <QualityRulesSettings />}

                {activeSection === 'organization' && <OrganizationSection />}

                {activeSection === 'paths' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>File organization</CardTitle>
                      <CardDescription>
                        Configure how downloaded files are organized and renamed
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-8">
                      <div className="flex flex-col gap-4">
                        <h4 className="font-condensed text-2xs font-bold uppercase tracking-eyebrow text-fg-muted">
                          Library paths
                        </h4>

                        <div className="flex flex-col gap-2">
                          <Label htmlFor="libraryPath">Base library path</Label>
                          <Input
                            id="libraryPath"
                            placeholder="/library"
                            className="font-mono"
                            value={formData.libraryPath || ''}
                            onChange={(e) => handleInputChange('libraryPath', e.target.value)}
                          />
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="moviesPath">Movies path</Label>
                            <Input
                              id="moviesPath"
                              placeholder="/library/movies"
                              className="font-mono"
                              value={formData.moviesPath || ''}
                              onChange={(e) => handleInputChange('moviesPath', e.target.value)}
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="tvShowsPath">TV shows path</Label>
                            <Input
                              id="tvShowsPath"
                              placeholder="/library/tv-shows"
                              className="font-mono"
                              value={formData.tvShowsPath || ''}
                              onChange={(e) => handleInputChange('tvShowsPath', e.target.value)}
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="gamesPath">Games path</Label>
                            <Input
                              id="gamesPath"
                              placeholder="/library/games"
                              className="font-mono"
                              value={formData.gamesPath || ''}
                              onChange={(e) => handleInputChange('gamesPath', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4">
                        <h4 className="font-condensed text-2xs font-bold uppercase tracking-eyebrow text-fg-muted">
                          Organization behaviour
                        </h4>
                        <SettingSwitch
                          label="Organize on download complete"
                          description="Automatically organize files when downloads finish"
                          checked={formData.organizeOnComplete || false}
                          onChange={(checked) => handleSwitchChange('organizeOnComplete', checked)}
                        />
                        <SettingSwitch
                          label="Replace existing files"
                          description="Replace files if they already exist in the library"
                          checked={formData.replaceExistingFiles || false}
                          onChange={(checked) => handleSwitchChange('replaceExistingFiles', checked)}
                        />
                        <SettingSwitch
                          label="Extract archives"
                          description="Automatically extract ZIP, RAR and other archives"
                          checked={formData.extractArchives || false}
                          onChange={(checked) => handleSwitchChange('extractArchives', checked)}
                        />
                        <SettingSwitch
                          label="Delete after extraction"
                          description="Delete archive files after successful extraction"
                          checked={formData.deleteAfterExtraction || false}
                          onChange={(checked) => handleSwitchChange('deleteAfterExtraction', checked)}
                        />
                      </div>

                      <div className="flex flex-col gap-4">
                        <h4 className="font-condensed text-2xs font-bold uppercase tracking-eyebrow text-fg-muted">
                          Reverse indexing
                        </h4>
                        <SettingSwitch
                          label="Enable reverse indexing"
                          description="Scan library directories and add existing files to the database"
                          checked={formData.enableReverseIndexing || false}
                          onChange={(checked) => handleSwitchChange('enableReverseIndexing', checked)}
                        />

                        <div className="flex flex-col gap-2">
                          <Label htmlFor="reverseIndexingCron">Scan schedule</Label>
                          <Select
                            value={formData.reverseIndexingCron || '0 * * * *'}
                            onValueChange={(value) => handleInputChange('reverseIndexingCron', value)}
                          >
                            <SelectTrigger id="reverseIndexingCron" className="max-w-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0 * * * *">Every hour</SelectItem>
                              <SelectItem value="0 */6 * * *">Every 6 hours</SelectItem>
                              <SelectItem value="0 0 * * *">Daily</SelectItem>
                              <SelectItem value="0 0 * * 0">Weekly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            onClick={handleTriggerReverseIndexing}
                            disabled={
                              triggerReverseIndexing.isPending || reverseIndexingStatus?.isRunning
                            }
                          >
                            {reverseIndexingStatus?.isRunning ? 'Scanning…' : 'Scan now'}
                          </Button>
                          <StatusBadge
                            status={reverseIndexingStatus?.isRunning ? 'PROCESSING' : 'PENDING'}
                            label={reverseIndexingStatus?.isRunning ? 'Running' : 'Idle'}
                            size="sm"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={handleSaveSettings} disabled={updateSettings.isPending}>
                          {updateSettings.isPending ? 'Saving…' : 'Save organization settings'}
                        </Button>
                        <Button variant="outline" onClick={handleResetToDefaults}>
                          Reset to defaults
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {activeSection === 'vpn' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>VPN</CardTitle>
                      <CardDescription>
                        With the VPN overlay only aria2 routes through the tunnel; the API, frontend
                        and Prowlarr keep normal networking.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <StatusBadge
                          status={
                            !vpnStatus?.enabled
                              ? 'CANCELLED'
                              : vpnStatus.connected
                                ? 'COMPLETED'
                                : 'FAILED'
                          }
                          label={
                            !vpnStatus?.enabled
                              ? 'Disabled'
                              : vpnStatus.connected
                                ? 'Connected'
                                : 'Disconnected'
                          }
                        />
                        <span className="text-sm text-fg-secondary">
                          {vpnStatus?.message || 'Status unknown'}
                        </span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Public IP" value={vpnStatus?.publicIP ?? '—'} mono />
                        <Field
                          label="Container"
                          value={
                            vpnStatus?.containerRunning
                              ? vpnStatus.containerHealthy
                                ? 'Running, healthy'
                                : 'Running'
                              : 'Not running'
                          }
                          mono
                        />
                      </div>
                      <p className="text-sm text-fg-muted">
                        VPN credentials live in <code className="font-mono">config.ovpn</code> and{' '}
                        <code className="font-mono">credentials.txt</code> on the host, and are read
                        by the vpn container at start-up.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {activeSection === 'setup' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Setup wizard</CardTitle>
                      <CardDescription>
                        Walk through Prowlarr, organization and discovery keys again
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <p className="text-sm text-fg-secondary">
                        Re-running the wizard does not erase anything — each step is pre-filled with
                        your current configuration, and saving overwrites only what you change.
                      </p>
                      <div>
                        <Button onClick={() => navigate('/onboarding')}>
                          <Wand2 className="h-4 w-4" />
                          Re-run setup wizard
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </PageSection>
    </Page>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-condensed text-2xs font-bold uppercase tracking-eyebrow text-fg-muted">
        {label}
      </span>
      <span className={mono ? 'font-mono text-sm text-fg-primary' : 'text-sm text-fg-primary'}>
        {value}
      </span>
    </div>
  )
}

function SettingSwitch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg-primary">{label}</p>
        <p className="text-xs text-fg-muted">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

/** Per-card skeleton, so a slow section never blanks the whole screen. */
function SectionSkeleton() {
  return (
    <Card>
      <CardHeader className="gap-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-80" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-40" />
      </CardContent>
    </Card>
  )
}
