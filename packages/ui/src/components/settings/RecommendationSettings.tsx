import { useEffect, useState } from 'react'
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useProfile } from '@/contexts/ProfileContext'
import {
  useCreateProfile,
  useDeleteProfile,
  useRecommendationSources,
  useRecommendationSyncStatus,
  useRenameProfile,
  useStartRecommendationSync,
  useUndoVideoDismissal,
  useVideoDismissals,
} from '@/hooks/useRecommendations'
import { useMusicDismissals, useUndoMusicDismissal } from '@/hooks/useMusic'
import type { RecommendationProfile } from '@/services/recommendations'
import { AppCredentialsCard } from './AppCredentialsCard'
import { SourceCard, USERNAME_PROVIDERS } from './SourceCard'
import { SpotifySourceCard } from './SpotifySourceCard'
import { TraktSourceCard } from './TraktSourceCard'

/**
 * Settings › Recommendations: the apps profiles sign in through, each
 * profile's accounts, syncing, and hidden items.
 */
export function RecommendationSettings() {
  const { profiles, profileId: globalProfileId } = useProfile()
  const [editingId, setEditingId] = useState<string | undefined>(globalProfileId)

  // Edit the profile the switcher shows, else the first; follow deletions.
  useEffect(() => {
    if (!profiles.length) return
    if (!editingId || !profiles.some((p) => p.id === editingId)) setEditingId(globalProfileId ?? profiles[0].id)
  }, [profiles, editingId, globalProfileId])

  const editing = profiles.find((p) => p.id === editingId)

  return (
    <div className="flex flex-col gap-6">
      <AppCredentialsCard />
      <ProfilesCard profiles={profiles} editingId={editingId} onEdit={setEditingId} />
      {editing && <ProfileAccounts key={editing.id} profile={editing} canDelete={profiles.length > 1} />}
      <SyncCard />
      <HiddenItemsCard />
    </div>
  )
}

function ProfilesCard({
  profiles,
  editingId,
  onEdit,
}: {
  profiles: RecommendationProfile[]
  editingId?: string
  onEdit: (id: string) => void
}) {
  const { toast } = useToast()
  const create = useCreateProfile()
  const [name, setName] = useState('')

  const onCreate = () =>
    create.mutate(name, {
      onSuccess: (profile) => {
        setName('')
        onEdit(profile.id)
      },
      onError: (error: any) =>
        toast({
          title: 'Couldn’t add profile',
          description: error?.response?.data?.message ?? error?.message,
          variant: 'destructive',
        }),
    })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Profiles</CardTitle>
        <CardDescription>
          One per person. Each connects their own accounts, and the switcher in the top bar filters the Music, Movies and
          TV pages to their recommendations — or shows everyone's together.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Profile to edit">
          {profiles.map((p) => (
            <Button
              key={p.id}
              role="tab"
              aria-selected={p.id === editingId}
              variant={p.id === editingId ? 'default' : 'outline'}
              size="sm"
              className="rounded-pill"
              onClick={() => onEdit(p.id)}
            >
              {p.name}
            </Button>
          ))}
        </div>
        <form
          className="flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) onCreate()
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New profile name" maxLength={60} />
          <Button type="submit" variant="secondary" disabled={!name.trim() || create.isPending}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function ProfileAccounts({ profile, canDelete }: { profile: RecommendationProfile; canDelete: boolean }) {
  const { toast } = useToast()
  const { data: sources } = useRecommendationSources()
  const rename = useRenameProfile()
  const remove = useDeleteProfile()
  const [name, setName] = useState(profile.name)
  const own = (sources ?? []).filter((s) => s.profileId === profile.id)

  const onRename = () =>
    rename.mutate(
      { id: profile.id, name },
      {
        onError: (error: any) =>
          toast({
            title: 'Couldn’t rename profile',
            description: error?.response?.data?.message ?? error?.message,
            variant: 'destructive',
          }),
      }
    )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Profile name</Label>
          <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="w-64" />
        </div>
        <Button
          variant="secondary"
          disabled={!name.trim() || name.trim() === profile.name || rename.isPending}
          onClick={onRename}
        >
          Rename
        </Button>
        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="text-brand-400">
                <Trash2 className="h-4 w-4" />
                Delete profile
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {profile.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This disconnects {profile.name}'s accounts and removes their recommendations and hidden items.
                  Downloads and requests aren't affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction onClick={() => remove.mutate(profile.id)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {USERNAME_PROVIDERS.map((copy) => (
        <SourceCard
          key={copy.provider}
          profileId={profile.id}
          copy={copy}
          source={own.find((s) => s.provider === copy.provider)}
        />
      ))}
      <SpotifySourceCard profileId={profile.id} source={own.find((s) => s.provider === 'SPOTIFY')} />
      <TraktSourceCard profileId={profile.id} source={own.find((s) => s.provider === 'TRAKT')} />
    </div>
  )
}

function SyncCard() {
  const { data: sources } = useRecommendationSources()
  const { data: syncStatus } = useRecommendationSyncStatus()
  const startSync = useStartRecommendationSync()
  const syncing = Boolean(syncStatus?.running) || startSync.isPending

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Refresh</CardTitle>
        <CardDescription>
          Every profile's recommendations are rebuilt nightly at 4am. Related artists and 30-second previews come from
          Deezer's public catalog; no Deezer account is needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-0">
        <div className="flex items-center gap-3">
          <Button variant="outline" disabled={syncing || !sources?.length} onClick={() => startSync.mutate(undefined)}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing
              ? syncStatus?.currentProfile
                ? `Updating ${syncStatus.currentProfile}…`
                : 'Updating…'
              : 'Refresh everyone now'}
          </Button>
        </div>
        {syncStatus?.error && !syncing && (
          <p className="whitespace-pre-line text-sm text-brand-400">{syncStatus.error}</p>
        )}
      </CardContent>
    </Card>
  )
}

function HiddenItemsCard() {
  const { profileId, profiles, label } = useProfile()
  const { data: musicDismissals } = useMusicDismissals(profileId)
  const { data: videoDismissals } = useVideoDismissals(profileId)
  const undoMusic = useUndoMusicDismissal()
  const undoVideo = useUndoVideoDismissal()
  const showOwner = !profileId && profiles.length > 1
  const items = [
    ...(videoDismissals ?? []).map((d) => ({
      id: d.id,
      label: `${d.title} (${d.kind === 'MOVIE' ? 'movie' : 'show'})`,
      profileName: d.profileName,
      undo: () => undoVideo.mutate(d.id),
    })),
    ...(musicDismissals ?? []).map((d) => ({
      id: d.id,
      label: d.label,
      profileName: d.profileName,
      undo: () => undoMusic.mutate(d.id),
    })),
  ]
  const busy = undoMusic.isPending || undoVideo.isPending

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Hidden items</CardTitle>
        <CardDescription>
          {profiles.length > 1 ? `Showing ${label === 'everyone' ? 'everyone’s' : `${label}’s`}. ` : ''}Anything you show
          again returns at the next refresh.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length ? (
          <ul className="flex flex-col divide-y divide-[color:var(--border-hairline)] rounded-card border border-hairline">
            {items.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate text-sm text-fg-primary">
                  {d.label}
                  {showOwner && <span className="text-fg-muted"> · {d.profileName}</span>}
                </span>
                <Button variant="ghost" size="sm" disabled={busy} onClick={d.undo}>
                  Show again
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-muted">
            Nothing hidden. Hide albums and artists from their menu on the Music page, and movies and shows with “Not
            interested” on their recommendation rails.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
