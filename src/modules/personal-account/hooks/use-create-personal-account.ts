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
    {
      errorMessage: 'We could not finish setting up your account. Try again.',
      // Onboarding is a page, not a dialog: whatever goes wrong there is shown
      // on the page itself, either under the field or above the button. A
      // toast that slides away would be the wrong shape for the one failure
      // that has no retry — the account already existing with the other role.
      silent: true,
    },
  )
