import { Toaster as Sonner } from 'sonner'

import type { ComponentPropsWithoutRef } from 'react'

export const Toaster = (props: ComponentPropsWithoutRef<typeof Sonner>) => (
  <Sonner className="toaster group" position="top-center" richColors {...props} />
)
