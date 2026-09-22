import { Slot } from '@radix-ui/react-slot'
import { createContext, useContext, useId } from 'react'
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import type { ComponentPropsWithoutRef } from 'react'

export const Form = FormProvider

type FieldContextValue = { name: string }

const FieldContext = createContext<FieldContextValue | null>(null)
const ItemContext = createContext<{ id: string } | null>(null)

export const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  props: ControllerProps<TFieldValues, TName>,
) => (
  <FieldContext.Provider value={{ name: props.name }}>
    <Controller {...props} />
  </FieldContext.Provider>
)

const useFormField = () => {
  const field = useContext(FieldContext)
  const item = useContext(ItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: field?.name as string })

  if (!field) throw new Error('useFormField must be used inside <FormField>')
  if (!item) throw new Error('useFormField must be used inside <FormItem>')

  return {
    name: field.name,
    formItemId: `${item.id}-item`,
    formDescriptionId: `${item.id}-description`,
    formMessageId: `${item.id}-message`,
    ...getFieldState(field.name, formState),
  }
}

export const FormItem = ({ className, ...props }: ComponentPropsWithoutRef<'div'>) => {
  const id = useId()

  return (
    <ItemContext.Provider value={{ id }}>
      <div className={cn('grid gap-2', className)} {...props} />
    </ItemContext.Provider>
  )
}

export const FormLabel = ({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Label>) => {
  const { error, formItemId } = useFormField()

  return (
    <Label
      htmlFor={formItemId}
      className={cn(error && 'text-destructive', className)}
      {...props}
    />
  )
}

export const FormControl = (props: ComponentPropsWithoutRef<typeof Slot>) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  return (
    <Slot
      id={formItemId}
      aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
      aria-invalid={Boolean(error)}
      {...props}
    />
  )
}

export const FormDescription = ({ className, ...props }: ComponentPropsWithoutRef<'p'>) => {
  const { formDescriptionId } = useFormField()

  return (
    <p
      id={formDescriptionId}
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export const FormMessage = ({ className, children, ...props }: ComponentPropsWithoutRef<'p'>) => {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error.message ?? '') : children

  if (!body) return null

  return (
    <p id={formMessageId} className={cn('text-destructive text-sm', className)} {...props}>
      {body}
    </p>
  )
}
