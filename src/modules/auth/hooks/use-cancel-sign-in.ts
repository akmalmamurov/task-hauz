import { useSend } from '@/hooks/use-send'
import { cancelSignIn } from '@/server/auth'

export const useCancelSignIn = () =>
  useSend(() => cancelSignIn(), { errorMessage: 'Could not start again. Reload the page.' })
