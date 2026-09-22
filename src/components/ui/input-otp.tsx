import { OTPInput, OTPInputContext } from 'input-otp'
import { MinusIcon } from 'lucide-react'
import { useContext } from 'react'

import { cn } from '@/lib/utils'

import type { ComponentPropsWithoutRef } from 'react'

export const InputOTP = ({
  className,
  containerClassName,
  ...props
}: ComponentPropsWithoutRef<typeof OTPInput> & { containerClassName?: string }) => (
  <OTPInput
    containerClassName={cn(
      'flex items-center gap-2 has-disabled:opacity-50',
      containerClassName,
    )}
    className={cn('disabled:cursor-not-allowed', className)}
    {...props}
  />
)

export const InputOTPGroup = ({ className, ...props }: ComponentPropsWithoutRef<'div'>) => (
  <div className={cn('flex items-center', className)} {...props} />
)

type SlotProps = ComponentPropsWithoutRef<'div'> & { index: number }

export const InputOTPSlot = ({ index, className, ...props }: SlotProps) => {
  const context = useContext(OTPInputContext)
  const slot = context.slots[index]

  return (
    <div
      data-active={slot?.isActive}
      className={cn(
        'relative flex h-12 w-11 items-center justify-center border-y border-r text-base font-medium shadow-xs transition-all outline-none',
        'first:rounded-l-md first:border-l last:rounded-r-md',
        'data-[active=true]:border-ring data-[active=true]:ring-[3px] data-[active=true]:ring-ring/50 data-[active=true]:z-10',
        'aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20',
        className,
      )}
      {...props}
    >
      {slot?.char}
      {slot?.hasFakeCaret ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      ) : null}
    </div>
  )
}

export const InputOTPSeparator = (props: ComponentPropsWithoutRef<'div'>) => (
  <div role="separator" {...props}>
    <MinusIcon className="text-muted-foreground size-4" />
  </div>
)
