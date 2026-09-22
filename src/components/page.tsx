import { cn } from '@/lib/utils'

import type { ComponentPropsWithoutRef } from 'react'

/** The one column every page is laid out in, so four routes agree on it. */
export const Page = ({ className, ...props }: ComponentPropsWithoutRef<'main'>) => (
  <main className={cn('mx-auto w-full max-w-2xl px-4 py-10', className)} {...props} />
)
