import * as LabelPrimitive from '@radix-ui/react-label'

import { cn } from '@/lib/utils'

import type { ComponentPropsWithoutRef } from 'react'

type Props = ComponentPropsWithoutRef<typeof LabelPrimitive.Root>

export const Label = ({ className, ...props }: Props) => (
  <LabelPrimitive.Root
    className={cn(
      'flex items-center gap-2 text-sm leading-none font-medium select-none',
      'group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50',
      className,
    )}
    {...props}
  />
)
