import { useSend } from '@/hooks/use-send'
import { verifyEmailCode } from '@/server/auth'
import { ActionError } from '@/types/action-error'

import type { CodeFormValues } from '../schemas'

export const useVerifyEmailCode = () =>
  useSend(
    async (data: CodeFormValues) => {
      const result = await verifyEmailCode({ data })

      // A wrong or expired code is the visitor's to fix, so the server answers
      // with a message rather than throwing. Raising it here keeps one error
      // path for the form.
      if (!result.ok) {
        throw new ActionError({
          code: 'invalid_request',
          message: result.message,
          issues: [{ field: 'code', message: result.message }],
        })
      }
    },
    { errorMessage: 'We could not check that code. Try again.' },
  )
