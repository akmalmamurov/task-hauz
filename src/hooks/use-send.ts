import { useMutation, type UseMutationOptions } from '@tanstack/react-query'

import { showError, showSuccess } from '@/lib/message'
import { toActionError, type ActionError } from '@/types/action-error'

type UseSendOptions<TData, TBody> = Omit<
  UseMutationOptions<TData, ActionError, TBody>,
  'mutationFn'
> & {
  successMessage?: string | ((data: TData, body: TBody) => string)
  errorMessage?: string
  silent?: boolean
}

const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Try again.'

/**
 * The mutation wrapper for TanStack Start server functions. There is no axios
 * layer here: a server function is already the typed verb, so `send` is just
 * the call, and this owns the normalised error and the messages.
 */
export const useSend = <TData = void, TBody = void>(
  send: (body: TBody) => Promise<TData>,
  {
    successMessage,
    errorMessage = DEFAULT_ERROR_MESSAGE,
    silent = false,
    onSuccess,
    onError,
    ...options
  }: UseSendOptions<TData, TBody> = {},
) =>
  useMutation<TData, ActionError, TBody>({
    ...options,

    mutationFn: async (body) => {
      try {
        return await send(body)
      } catch (error) {
        throw toActionError(error, errorMessage)
      }
    },

    onSuccess: (data, body, onMutateResult, context) => {
      if (!silent && successMessage) {
        showSuccess(
          typeof successMessage === 'function' ? successMessage(data, body) : successMessage,
        )
      }
      onSuccess?.(data, body, onMutateResult, context)
    },

    onError: (error, body, onMutateResult, context) => {
      // Field-level problems belong under the inputs, not in a toast on top
      // of them. The form reads error.issues through useFormErrors.
      const hasFieldIssues = Boolean(error.issues?.length)
      if (!silent && !hasFieldIssues) showError(error.message)
      onError?.(error, body, onMutateResult, context)
    },
  })
