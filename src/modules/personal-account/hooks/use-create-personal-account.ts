import { useSend } from '@/hooks/use-send'
import { createPersonalAccount } from '@/server/personal-account'
import { ActionError } from '@/types/action-error'

import type { OnboardingFormValues } from '../schemas'
import type { PersonalAccount } from '@/types/personal-account'

export const useCreatePersonalAccount = () =>
  useSend<PersonalAccount, OnboardingFormValues>(
    async (data) => {
      const result = await createPersonalAccount({ data })

      if (!result.ok) {
        throw new ActionError({
          code: result.code,
          message: result.message,
          issues: 'issues' in result ? result.issues : undefined,
        })
      }

      return result.account
    },
    { errorMessage: 'We could not finish setting up your account. Try again.' },
  )
