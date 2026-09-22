import { z } from 'zod'

import { BIO_MAX, EMAIL_MAX, NAME_MAX } from '@/constants'
import { PERSONAL_ROLES } from '@/types/personal-account'

const requiredName = (label: string) =>
  z.string().trim().min(1, `${label} is required.`).max(NAME_MAX, `Keep ${label.toLowerCase()} to ${NAME_MAX} characters or fewer.`)

export const onboardingFormSchema = z.object({
  firstName: requiredName('First name'),
  lastName: requiredName('Last name'),
  role: z.enum(PERSONAL_ROLES, { message: 'Choose one.' }),
})

/**
 * The optional fields accept "" because that is how the visitor clears them.
 * toProfilePatch is what turns "" into the null the Function expects; an
 * empty string sent as-is is a 400.
 */
export const profileFormSchema = z.object({
  firstName: requiredName('First name'),
  lastName: requiredName('Last name'),
  // Trimmed before it is checked, not after: "   " is how someone clears a
  // field, and validating first would call that an invalid email address.
  contactEmail: z
    .string()
    .trim()
    .pipe(
      z.union([
        z.literal(''),
        z.email('Enter a valid email address, or clear the field.').max(EMAIL_MAX),
      ]),
    ),
  bio: z.string().trim().max(BIO_MAX, `Keep your bio to ${BIO_MAX} characters or fewer.`),
})

export type OnboardingFormValues = z.infer<typeof onboardingFormSchema>
export type ProfileFormValues = z.infer<typeof profileFormSchema>

/** Exactly what goes over the wire. Nullable where the Function allows null. */
export type ProfilePatch = {
  firstName: string
  lastName: string
  contactEmail: string | null
  bio: string | null
}

const orNull = (value: string) => (value === '' ? null : value)

/**
 * The form is a complete picture of the profile, so all four fields are sent
 * every time and the Function's "at least one field" check can never fire.
 *
 * The one thing to reconcile: the Function reads three inputs per field —
 * omitted means unchanged, null clears, "" is rejected — while an HTML input
 * only ever produces a string.
 */
export const toProfilePatch = (values: ProfileFormValues): ProfilePatch => ({
  firstName: values.firstName,
  lastName: values.lastName,
  contactEmail: orNull(values.contactEmail),
  bio: orNull(values.bio),
})
