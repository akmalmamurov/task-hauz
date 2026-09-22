import { useSend } from '@/hooks/use-send'
import { logout } from '@/server/auth'

export const useLogout = () =>
  useSend(() => logout(), { errorMessage: 'Could not log you out. Try again.' })
