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
 */

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

/** "" and whitespace-only both mean "the visitor cleared this field". */
function orNull(value: string): string | null {
  const trimmed = value.trim()

  return trimmed === '' ? null : trimmed
}

export function buildProfilePatch(values: ProfileFormValues): ProfilePatchResult {
  const firstName = values.firstName.trim()
  const lastName = values.lastName.trim()

  // These two are required columns, so there is no way to express "cleared".
  // Caught here rather than sent, because the Function's 400 for this case is
  // worded for an API caller, not for someone filling in a form.
  const errors: ProfileFieldErrors = {}
  if (firstName === '') {
    errors.firstName = REQUIRED_MESSAGE
  }
  if (lastName === '') {
    errors.lastName = REQUIRED_MESSAGE
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    patch: {
      firstName,
      lastName,
      contactEmail: orNull(values.contactEmail),
      bio: orNull(values.bio),
    },
  }
}
