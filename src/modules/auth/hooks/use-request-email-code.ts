import { useSend } from '@/hooks/use-send'
import { requestEmailCode } from '@/server/auth'

import type { EmailFormValues } from '../schemas'

export const useRequestEmailCode = () =>
  useSend((data: EmailFormValues) => requestEmailCode({ data }), {
    errorMessage: 'We could not send a code to that address. Check it and retry.',
  })
