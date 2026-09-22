/**
 * Turning the profile form into a PATCH body for the Function.
 *
 * The form is a complete representation of the profile: all four editable
 * fields are on screen, so whatever the visitor is looking at when they press
 * Save is the profile they mean to have. We send all four every time.
 *
 * That leaves one thing to reconcile. The Function distinguishes three inputs
 * per field (omitted means unchanged, null means clear, "" is rejected with a
 * 400), and an HTML input only ever produces a string. So the single job here
 * is to map "" onto the right one of those:
 *
 *   contactEmail, bio    optional, nullable    ""  ->  null   (clear it)
 *   firstName, lastName  required, not nullable  ""  ->  a field error,
 *                                                      never sent
 *
 * An empty string therefore never reaches the Function, and the body always
 * has all four keys, so the Function's "at least one field" check can never
 * fire. Both of those are asserted in the tests.
 *
 * Every value is trimmed, including contactEmail. The Function does not trim
 * the email itself, and its email check would reject " a@b.com ", so trimming
 * here removes a 400 the visitor could not otherwise explain.
 *
 * The Function's other rules, the email format and the column lengths, are
 * checked here too. Not for safety: the Function and the server function both
 * enforce them again, and this code runs in the browser where nothing can be
 * trusted. It is so a typo comes back as a message under the field. Without
 * it the server function's own zod validator rejects the call before the
 * Function is ever reached, and a rejected server function throws rather than
 * returning the { issues } shape the form knows how to display.
 */

import { z } from 'zod'

export type ProfileFormValues = {
  firstName: string
  lastName: string
  contactEmail: string
  bio: string
}

/** Exactly what goes over the wire. Nullable where the Function allows null. */
export type ProfilePatch = {
  firstName: string
  lastName: string
  contactEmail: string | null
  bio: string | null
}

export type ProfileFieldErrors = Partial<Record<keyof ProfileFormValues, string>>

export type ProfilePatchResult =
  | { ok: true; patch: ProfilePatch }
  | { ok: false; errors: ProfileFieldErrors }

const REQUIRED_MESSAGE = 'This field is required.'
const EMAIL_MESSAGE = 'Enter a valid email address, or clear the field.'

/** The column sizes from appwrite.config.json, which the Function enforces. */
const NAME_MAX = 100
const EMAIL_MAX = 254
const BIO_MAX = 2000

const emailSchema = z.email().max(EMAIL_MAX)

function tooLong(max: number): string {
  return `Keep this to ${max} characters or fewer.`
}

/** "" and whitespace-only both mean "the visitor cleared this field". */
function orNull(value: string): string | null {
  const trimmed = value.trim()

  return trimmed === '' ? null : trimmed
}

export function buildProfilePatch(values: ProfileFormValues): ProfilePatchResult {
  const firstName = values.firstName.trim()
  const lastName = values.lastName.trim()
  const contactEmail = orNull(values.contactEmail)
  const bio = orNull(values.bio)

  const errors: ProfileFieldErrors = {}

  // firstName and lastName are required columns, so there is no way to
  // express "cleared". Caught here rather than sent, because the Function's
  // 400 for this case is worded for an API caller, not for someone filling in
  // a form.
  if (firstName === '') {
    errors.firstName = REQUIRED_MESSAGE
  } else if (firstName.length > NAME_MAX) {
    errors.firstName = tooLong(NAME_MAX)
  }

  if (lastName === '') {
    errors.lastName = REQUIRED_MESSAGE
  } else if (lastName.length > NAME_MAX) {
    errors.lastName = tooLong(NAME_MAX)
  }

  // null is a cleared field and always allowed. Only a value has to be valid.
  if (contactEmail !== null && !emailSchema.safeParse(contactEmail).success) {
    errors.contactEmail = EMAIL_MESSAGE
  }

  if (bio !== null && bio.length > BIO_MAX) {
    errors.bio = tooLong(BIO_MAX)
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, patch: { firstName, lastName, contactEmail, bio } }
}
