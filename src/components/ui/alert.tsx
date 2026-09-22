import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

import type { ComponentPropsWithoutRef } from 'react'

const alertVariants = cva(
  'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive: 'text-destructive bg-card [&>svg]:text-current',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

type Props = ComponentPropsWithoutRef<'div'> & VariantProps<typeof alertVariants>

export const Alert = ({ className, variant, ...props }: Props) => (
  <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
)

export const AlertTitle = ({ className, ...props }: ComponentPropsWithoutRef<'div'>) => (
  <div
    className={cn('col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight', className)}
    {...props}
  />
)

export const AlertDescription = ({ className, ...props }: ComponentPropsWithoutRef<'div'>) => (
  <div
    className={cn('text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm', className)}
    {...props}
  />
)
