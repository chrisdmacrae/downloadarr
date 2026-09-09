import * as React from 'react'

import { cn } from '@/lib/utils'

interface HeroBannerProps {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  meta?: React.ReactNode[]
  badges?: React.ReactNode
  description?: string
  backdrop?: string
  actions?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

/**
 * A full-bleed backdrop with a left-to-right protection wash and a floor
 * gradient into the page. The top nav's glass sits over it.
 */
export function HeroBanner({
  eyebrow,
  title,
  meta = [],
  badges,
  description,
  backdrop,
  actions,
  className,
  children,
}: HeroBannerProps) {
  return (
    <section
      className={cn(
        'relative flex min-h-[420px] items-end overflow-hidden bg-ink-850 md:min-h-[520px]',
        className
      )}
    >
      <div
        aria-hidden
        className={cn(
          'absolute inset-0',
          !backdrop &&
            'bg-[radial-gradient(120%_90%_at_78%_20%,var(--ink-700),var(--ink-900)_60%,var(--ink-950))]'
        )}
      >
        {backdrop && <img src={backdrop} alt="" className="h-full w-full object-cover" />}
      </div>
      <div aria-hidden className="hero-wash absolute inset-0" />
      <div aria-hidden className="hero-floor absolute inset-0" />

      <div className="relative flex max-w-[620px] flex-col gap-4 px-gutter py-10 animate-fade-up">
        {eyebrow && (
          <span className="flex items-center gap-2.5 font-condensed text-2xs font-bold uppercase leading-none tracking-eyebrow text-brand-500">
            {eyebrow}
          </span>
        )}

        <h1 className="font-condensed text-4xl font-extrabold uppercase leading-none tracking-tighter text-white text-balance md:text-5xl lg:text-6xl">
          {title}
        </h1>

        {meta.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs font-medium text-ink-200">
            {meta.map((item, i) => (
              <React.Fragment key={i}>
                {i > 0 && <i aria-hidden className="h-[3px] w-[3px] shrink-0 rounded-pill bg-ink-500" />}
                <span>{item}</span>
              </React.Fragment>
            ))}
          </div>
        )}

        {badges && <div className="flex flex-wrap items-center gap-2">{badges}</div>}

        {description && (
          <p className="line-clamp-3 max-w-[52ch] text-base leading-relaxed text-ink-100 text-pretty">
            {description}
          </p>
        )}

        {actions && <div className="flex flex-wrap items-center gap-2.5 pt-1">{actions}</div>}

        {children}
      </div>
    </section>
  )
}

/** Placeholder while the featured item is still loading. */
export function HeroBannerSkeleton() {
  return (
    <section className="relative flex min-h-[420px] items-end overflow-hidden bg-ink-850 md:min-h-[520px]">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(120%_90%_at_78%_20%,var(--ink-800),var(--ink-900)_60%,var(--ink-950))]"
      />
      <div aria-hidden className="hero-floor absolute inset-0" />
      <div className="relative flex w-full max-w-[620px] flex-col gap-4 px-gutter py-10">
        <div className="skeleton h-3 w-24 rounded-pill" />
        <div className="skeleton h-12 w-3/4 rounded-md" />
        <div className="skeleton h-3 w-48 rounded-pill" />
        <div className="skeleton h-16 w-full rounded-md" />
        <div className="flex gap-2.5">
          <div className="skeleton h-11 w-36 rounded-control" />
          <div className="skeleton h-11 w-32 rounded-control" />
        </div>
      </div>
    </section>
  )
}
