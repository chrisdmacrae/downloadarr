import { Check, ChevronDown, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useProfile } from '@/contexts/ProfileContext'

/** Picks whose recommendations to show. Hidden until there are two profiles. */
export function ProfileSwitcher() {
  const { profiles, profileId, profile, select } = useProfile()
  if (profiles.length < 2) return null

  const option = (id: string | undefined, name: string) => (
    <DropdownMenuItem key={id ?? 'all'} onSelect={() => select(id)} className="gap-2">
      <Check className={profileId === id ? 'h-4 w-4' : 'h-4 w-4 opacity-0'} />
      {name}
    </DropdownMenuItem>
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="shrink-0" aria-label="Whose recommendations to show">
          <Users className="h-3.5 w-3.5" />
          <span className="max-w-[120px] truncate max-[1040px]:sr-only">{profile?.name ?? 'Everyone'}</span>
          <ChevronDown className="h-3.5 w-3.5 text-fg-muted" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Recommendations for</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {option(undefined, 'Everyone')}
        {profiles.map((p) => option(p.id, p.name))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
