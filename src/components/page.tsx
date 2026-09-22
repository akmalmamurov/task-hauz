import { cn } from '@/lib/utils'

import type { ComponentPropsWithoutRef } from 'react'

/** The one column every page is laid out in, so four routes agree on it. */
export const Page = ({ className, ...props }: ComponentPropsWithoutRef<'main'>) => (
  <main className={cn('mx-auto w-full max-w-2xl px-4 py-10', className)} {...props} />
)

/**
 * A page that is a single card and nothing else. Narrower, and centred in what
 * the header leaves behind (3.5rem of header plus the page's own 5rem of
 * padding), so sign-in does not sit pinned to the top of an empty screen.
 */
export const CardPage = ({ className, ...props }: ComponentPropsWithoutRef<'main'>) => (
  <Page
    className={cn(
      'flex min-h-[calc(100dvh-8.5rem)] max-w-md flex-col justify-center gap-8',
      className,
    )}
    {...props}
  />
)
