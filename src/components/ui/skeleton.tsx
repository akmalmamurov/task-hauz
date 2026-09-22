import { cn } from '@/lib/utils'

import type { ComponentPropsWithoutRef } from 'react'

export const Skeleton = ({ className, ...props }: ComponentPropsWithoutRef<'div'>) => (
  <div className={cn('bg-accent animate-pulse rounded-md', className)} {...props} />
)
