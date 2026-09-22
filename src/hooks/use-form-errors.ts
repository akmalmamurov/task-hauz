import { useCallback } from 'react'
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'

import type { ActionError } from '@/types/action-error'

/**
 * Puts a failure's field issues back on the form. Anything the form has no
 * field for is returned, so the caller can show it above the submit button
 * instead of dropping it.
 */
export const useFormErrors = <TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
  fields: ReadonlyArray<Path<TFieldValues>>,
) =>
  useCallback(
    (error: ActionError): { unmatched: boolean } => {
      if (!error.issues?.length) return { unmatched: true }

      let matched = 0
      error.issues.forEach((issue) => {
        const field = issue.field as Path<TFieldValues>
        if (!fields.includes(field)) return

        matched += 1
        form.setError(field, { type: 'server', message: issue.message })
      })

      return { unmatched: matched === 0 }
    },
    [form, fields],
  )
