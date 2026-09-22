import { useSend } from '@/hooks/use-send'
import { updatePersonalAccount } from '@/server/personal-account'
import { ActionError } from '@/types/action-error'

import { toProfilePatch, type ProfileFormValues } from '../schemas'

import type { PersonalAccount } from '@/types/personal-account'

export const useUpdatePersonalAccount = () =>
  useSend<PersonalAccount, ProfileFormValues>(
    async (values) => {
      const result = await updatePersonalAccount({ data: toProfilePatch(values) })

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
      successMessage: 'Profile saved.',
      errorMessage: 'We could not save your changes. Try again.',
    },
  )
