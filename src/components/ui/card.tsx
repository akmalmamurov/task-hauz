import { cn } from '@/lib/utils'

import type { ComponentPropsWithoutRef } from 'react'

type Props = ComponentPropsWithoutRef<'div'>

export const Card = ({ className, ...props }: Props) => (
  <div
    className={cn(
      'bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm',
      className,
    )}
    {...props}
  />
)

export const CardHeader = ({ className, ...props }: Props) => (
  <div className={cn('flex flex-col gap-1.5 px-6', className)} {...props} />
)

export const CardTitle = ({ className, ...props }: Props) => (
  <div className={cn('text-lg leading-none font-semibold', className)} {...props} />
)

export const CardDescription = ({ className, ...props }: Props) => (
  <div className={cn('text-muted-foreground text-sm', className)} {...props} />
)

export const CardContent = ({ className, ...props }: Props) => (
  <div className={cn('px-6', className)} {...props} />
)

export const CardFooter = ({ className, ...props }: Props) => (
  <div className={cn('flex items-center px-6', className)} {...props} />
)
