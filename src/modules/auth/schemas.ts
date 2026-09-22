import { z } from 'zod'

import { EMAIL_CODE_LENGTH, EMAIL_MAX } from '@/constants'

export const emailFormSchema = z.object({
  email: z.email('Enter a valid email address.').max(EMAIL_MAX),
})

export const codeFormSchema = z.object({
  code: z
    .string()
    .regex(
      new RegExp(`^[0-9]{${EMAIL_CODE_LENGTH}}$`),
      `Enter the ${EMAIL_CODE_LENGTH} digit code from your email.`,
    ),
})

export type EmailFormValues = z.infer<typeof emailFormSchema>
export type CodeFormValues = z.infer<typeof codeFormSchema>
